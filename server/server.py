#!/usr/bin/env python3
"""
OrcaSlicer Engine REST API Server
Bridge between OrcaWeb browser frontend and native OrcaSlicer / PrusaSlicer CLI engine.
Accepts 3D STL/3MF files + model orientation specs (rotation, position, scale) + slicing settings JSON,
runs native OrcaSlicer CLI, and returns genuine sliced G-code + statistics.
"""

import os
import sys
import json
import tempfile
import traceback
import urllib.parse
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.exceptions import HTTPException
from slicer_engine import find_slicer_binary, slice_model_with_orca

app = Flask(__name__)
CORS(app)

def normalize_url(url_str):
    """Ensures URL starts with http:// or https://."""
    if not url_str:
        return ""
    url_str = url_str.strip()
    if "/api/printer/upload" in url_str:
        url_str = url_str.split("/api/printer/upload")[0]
    if not url_str.startswith("http://") and not url_str.startswith("https://"):
        url_str = "http://" + url_str
    return url_str

@app.errorhandler(Exception)
def handle_exception(e):
    """Catch-all Flask error handler returning JSON errors instead of HTML pages."""
    if isinstance(e, HTTPException):
        print(f"[OrcaAPI HTTP {e.code}] {request.method} {request.path}: {e.description}", flush=True)
        return jsonify({"error": e.description}), e.code

    tb = traceback.format_exc()
    print(f"[OrcaAPI Exception] {request.method} {request.path}: {e}\n{tb}", flush=True)
    return jsonify({
        "error": str(e),
        "details": tb
    }), 500

@app.route("/api/health", methods=["GET"])
def health():
    binary = find_slicer_binary()
    klipper_url = normalize_url(os.environ.get("KLIPPER_URL") or os.environ.get("PRINTER_URL", ""))
    return jsonify({
        "status": "online",
        "slicer_binary": binary or "OrcaSlicer CLI (Bridge mode)",
        "arachne_engine_supported": True,
        "tree_supports_supported": True,
        "klipper_url": klipper_url or None
    })

@app.route("/api/settings/default", methods=["GET"])
def get_default_settings():
    """
    Returns custom profile default settings.
    Users can mount a custom default_settings.json file into /app/default_settings.json
    via Docker Compose to customize default settings for fresh browser sessions.
    """
    candidates = [
        "/app/default_settings.json",
        "/etc/orca/default_settings.json",
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "default_settings.json")
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return jsonify(data)
            except Exception as e:
                print(f"[Settings] Error reading custom default settings from {path}: {e}", flush=True)

    return jsonify({
        "layerHeight": 0.2,
        "firstLayerHeight": 0.24,
        "wallPerimeters": 3,
        "topSolidLayers": 4,
        "bottomSolidLayers": 3,
        "infillDensity": 15,
        "infillPattern": "gyroid",
        "outerWallSpeed": 60,
        "infillSpeed": 120,
        "travelSpeed": 200,
        "retractionDistance": 0.8,
        "retractionSpeed": 40,
        "nozzleTemp": 210,
        "bedTemp": 60,
        "enableSupports": False,
        "supportStyle": "normal",
        "supportAngle": 45,
        "startGCode": "PRINT_START EXTRUDER={nozzleTemp} BED={bedTemp}",
        "endGCode": "PRINT_END",
        "layerChangeGCode": ";AFTER_LAYER_CHANGE"
    })

@app.route("/api/slice", methods=["POST"])
def slice_file():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]

    # Parse JSON settings
    settings_json = request.form.get("settings", "{}")
    try:
        settings = json.loads(settings_json)
    except Exception:
        settings = {}

    # Parse JSON model orientation (position, rotation, scale)
    position_json = request.form.get("position", "{}")
    rotation_json = request.form.get("rotation", "{}")
    scale_json = request.form.get("scale", "{}")

    try:
        position = json.loads(position_json)
        rotation = json.loads(rotation_json)
        scale = json.loads(scale_json)
    except Exception:
        position = {"x": 122.5, "y": 122.5, "z": 0}
        rotation = {"x": 0, "y": 0, "z": 0}
        scale = {"x": 1, "y": 1, "z": 1}

    print(f"[OrcaAPI] Slicing '{file.filename}' for {settings.get('bed', {}).get('name', 'Printer')}")
    print(f"[OrcaAPI] Position: {position}, Rotation: {rotation}, Scale: {scale}")

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            input_stl_path = os.path.join(tmpdir, file.filename or "model.stl")
            file.save(input_stl_path)

            result = slice_model_with_orca(input_stl_path, settings, position, rotation, scale)
            return jsonify(result)
    except Exception as e:
        err_msg = str(e)
        print(f"[OrcaAPI Exception] Slicing failed: {err_msg}")
        return jsonify({
            "error": f"Slicing Failed: {err_msg}"
        }), 500

@app.route("/api/printer/info", methods=["GET"])
@app.route("/api/printer/upload/printer/info", methods=["GET"])
def proxy_printer_info():
    """Proxies connection test to downstream Klipper / Moonraker."""
    printer_url = request.args.get("printer_url", "").strip()
    if not printer_url or "/api/printer/upload" in printer_url:
        printer_url = os.environ.get("KLIPPER_URL") or os.environ.get("PRINTER_URL", "").strip()

    printer_url = normalize_url(printer_url)
    if not printer_url:
        return jsonify({"ok": False, "statusText": "No printer URL configured. Set KLIPPER_URL=http://your-klipper-ip:7125 in environment."}), 400

    headers = {}
    try:
        parsed_url = urllib.parse.urlparse(printer_url)
        if parsed_url.username or parsed_url.password:
            user = urllib.parse.unquote(parsed_url.username or "")
            pwd = urllib.parse.unquote(parsed_url.password or "")
            creds = base64.b64encode(f"{user}:{pwd}".encode()).decode()
            headers["Authorization"] = f"Basic {creds}"
            clean_netloc = parsed_url.netloc.split("@")[-1]
            clean_url = urllib.parse.urlunparse((parsed_url.scheme, clean_netloc, parsed_url.path, parsed_url.params, parsed_url.query, parsed_url.fragment))
        else:
            clean_url = printer_url
    except Exception:
        clean_url = printer_url

    clean_url = clean_url.rstrip("/")
    import requests
    print(f"[PrinterProxy Info] Testing connection to {clean_url}/printer/info...", flush=True)
    try:
        resp = requests.get(f"{clean_url}/printer/info", headers=headers, timeout=10, verify=False)
        if resp.status_code == 200:
            return jsonify({"ok": True, "statusText": f"Connected to Klipper at {clean_url}!"})
        else:
            return jsonify({"ok": False, "statusText": f"HTTP {resp.status_code} from {clean_url}"})
    except Exception as e:
        print(f"[PrinterProxy Info Error] {e}", flush=True)
        return jsonify({"ok": False, "statusText": f"Connection error to {clean_url}: {str(e)}"})

@app.route("/api/printer/upload", methods=["POST"])
def proxy_printer_upload():
    """
    Proxies G-code / UFP uploads from backend to Klipper / Moonraker or OctoPrint API.
    Uses environment variable KLIPPER_URL or PRINTER_URL if printer_url is omitted.
    Bypasses browser CORS restrictions, HTTPS/HTTP mixed content blocks,
    and embedded credential fetch errors (https://user:pass@printer.domain.de).
    """
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]

    # Read target printer URL from form request or fallback to env KLIPPER_URL / PRINTER_URL
    printer_url = request.form.get("printer_url", "").strip()
    if not printer_url or "/api/printer/upload" in printer_url:
        printer_url = os.environ.get("KLIPPER_URL") or os.environ.get("PRINTER_URL", "").strip()

    printer_url = normalize_url(printer_url)

    printer_type = request.form.get("printer_type", os.environ.get("PRINTER_TYPE", "moonraker")).lower()
    api_key = request.form.get("api_key", os.environ.get("PRINTER_API_KEY", "")).strip()
    start_print = request.form.get("print", "false").lower() == "true"

    if not printer_url:
        return jsonify({"error": "No printer URL configured. Specify printer_url or set KLIPPER_URL environment variable."}), 400

    headers = {}
    try:
        parsed_url = urllib.parse.urlparse(printer_url)
        if parsed_url.username or parsed_url.password:
            user = urllib.parse.unquote(parsed_url.username or "")
            pwd = urllib.parse.unquote(parsed_url.password or "")
            creds = base64.b64encode(f"{user}:{pwd}".encode()).decode()
            headers["Authorization"] = f"Basic {creds}"

            # Strip embedded user:pass@ from host URL
            clean_netloc = parsed_url.netloc.split("@")[-1]
            clean_url = urllib.parse.urlunparse((
                parsed_url.scheme,
                clean_netloc,
                parsed_url.path,
                parsed_url.params,
                parsed_url.query,
                parsed_url.fragment
            ))
        else:
            clean_url = printer_url
    except Exception:
        clean_url = printer_url

    clean_url = clean_url.rstrip("/")

    if api_key:
        if api_key.startswith("Basic ") or api_key.startswith("Bearer "):
            headers["Authorization"] = api_key
        else:
            headers["X-Api-Key"] = api_key

    file_bytes = file.read()
    filename = file.filename or "model.gcode"

    import requests
    target_endpoint = f"{clean_url}/server/files/upload" if printer_type == "moonraker" else f"{clean_url}/api/files/local"
    files = {"file": (filename, file_bytes, "text/plain")}
    data = {"print": "true"} if start_print else {}

    print(f"[PrinterProxy Upload] Proxying '{filename}' ({len(file_bytes)} bytes) to {target_endpoint}...", flush=True)
    try:
        resp = requests.post(target_endpoint, headers=headers, files=files, data=data, timeout=60, verify=False)
        if resp.status_code in [200, 201, 202, 204]:
            return jsonify({"status": "success", "message": f"Successfully uploaded {filename} to Klipper ({clean_url})!"})
        else:
            return jsonify({"error": f"Printer API returned HTTP {resp.status_code}: {resp.text}"}), resp.status_code
    except Exception as e:
        print(f"[PrinterProxy Upload Error] {e}", flush=True)
        return jsonify({"error": f"Failed to connect to printer at {clean_url}: {str(e)}"}), 502

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"🚀 OrcaSlicer Headless API Server running on port {port}...")
    app.run(host="0.0.0.0", port=port)
