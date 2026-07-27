# OrcaWeb — Web-Based 3D Printer Slicer

OrcaWeb is a modern, responsive web application for slicing 3D models directly in your browser from any device. It combines an interactive React + Three.js 3D prepare viewport with a dual-engine slicing architecture (WASM Local Engine + Headless OrcaSlicer/PrusaSlicer CLI Engine).

---

## 🌟 Key Features

- 🎨 **3D Prepare Viewport:** Interactive 3D transform controls (Move, Rotate, Scale, Snap to Bed Z=0, Auto-Orient & Arrange).
- ⚙️ **Dual Slicing Engine Architecture:**
  - **WASM Local Engine:** Slices 100% in browser using ClipperLib WebAssembly.
  - **Remote OrcaSlicer / PrusaSlicer CLI:** Submits 3D model orientation & profile config to native C++ slicer engine (Arachne variable line width, organic tree supports).
- 📦 **Fluidd / Mainsail Print Preview Cards:**
  - **Export `.ufp` (Ultimaker Format Package):** Generates `.ufp` ZIP packages containing `model.gcode` and 300x300 PNG render cards.
  - **Embedded Klipper Base64 PNG Thumbnails:** Direct Moonraker uploads and `.gcode` exports include standard Klipper `; thumbnail begin 300x300` headers.
- 🖨️ **Klipper G-Code Macro Support:** Configurable Start (`PRINT_START`), End (`PRINT_END`), and Layer Change macros with variable substitution (`{nozzleTemp}`, `{bedTemp}`).
- 🚀 **Direct 3D Printer Dispatch:** One-click print upload to Moonraker (Klipper) or OctoPrint REST APIs.

---

## 📦 Pull Pre-built Image from GitHub Container Registry (GHCR)

Multiarchitecture Docker images (`linux/amd64` and `linux/arm64`) are automatically published to **GHCR**:

```bash
# Pull and run directly from GHCR:
docker run -d \
  --name web-slicer \
  -p 3000:80 \
  -p 8080:8080 \
  --restart unless-stopped \
  ghcr.io/sbaier1/web-slicer:latest
```

---

## 🐳 Run via Docker Compose

```bash
# 1. Clone repository
git clone https://github.com/sbaier1/web-slicer.git
cd web-slicer

# 2. Build and launch container
docker compose up -d --build

# 3. Access OrcaWeb in your browser:
# 👉 Web Interface: http://localhost:3000
# 👉 Slicer API:    http://localhost:8080
```

---

## 💻 Local Development Setup

```bash
# Install frontend dependencies
npm install

# Run frontend dev server
npm run dev

# (Optional) Run local Python OrcaSlicer API bridge
python3 -m venv server/venv
server/venv/bin/pip install -r server/requirements.txt
PYTHONPATH=server server/venv/bin/python3 server/server.py
```
