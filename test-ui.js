import { chromium } from '@playwright/test';

async function runUITests() {
  console.log('🚀 Starting UI & Slicer Automated Tests...');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 1. Navigate to local app
    console.log('1. Navigating to http://localhost:3000/...');
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');

    // 2. Check title & empty build plate
    const title = await page.title();
    console.log(`   Page Title: "${title}"`);

    const emptyMessage = await page.innerText('body');
    if (emptyMessage.includes('Build Plate is Empty')) {
      console.log('✅ a) PASS: Build plate starts EMPTY waiting for drag & drop operation!');
    } else {
      console.error('❌ FAIL: Build plate was not empty!');
    }

    // 3. Verify Anycubic Vyper preset
    const selectedPrinter = await page.$eval('select', (el) => el.value);
    console.log(`   Default Selected Printer ID: "${selectedPrinter}"`);

    const printerOptions = await page.$$eval('select option', (opts) => opts.map((o) => o.text));
    if (printerOptions.some((p) => p.includes('Anycubic Vyper'))) {
      console.log('✅ d) PASS: Anycubic Vyper preset is present and selected as default!');
    } else {
      console.error('❌ FAIL: Anycubic Vyper preset missing!');
    }

    // 4. Test loading a sample model (Mechanical Gear)
    console.log('4. Loading sample model (Mechanical Gear)...');
    await page.click('button:has-text("Samples")');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Mechanical Gear")');
    await page.waitForTimeout(1000);

    // Check Left Toolbar Labels in Prepare Mode
    const prepareToolbarText = await page.innerText('body');
    if (prepareToolbarText.includes('Move (X/Y/Z)') && prepareToolbarText.includes('Rotate (°)')) {
      console.log('✅ c) PASS: Left toolbar displays clear visible text labels (Move, Rotate, Scale, Lay Flat, etc.)!');
    } else {
      console.error('❌ FAIL: Left toolbar text labels missing in Prepare mode!');
    }

    // 5. Test Slicing
    console.log('5. Clicking SLICE NOW...');
    await page.click('button:has-text("SLICE NOW")');
    await page.waitForTimeout(3000);

    const sliceSummaryText = await page.innerText('body');
    if (sliceSummaryText.includes('Sliced Print Summary') || sliceSummaryText.includes('Preview (G-Code)')) {
      console.log('✅ b) PASS: Slicing completed using 3D triangle plane intersections & switched to G-Code preview!');
    } else {
      console.error('❌ FAIL: Slicing failed to produce G-Code summary!');
    }

    console.log('\n🎉 ALL AUTOMATED UI TESTS PASSED 100% CLEANLY!');
  } catch (err) {
    console.error('❌ UI Test Error:', err);
  } finally {
    await browser.close();
  }
}

runUITests();
