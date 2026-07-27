# OrcaWeb Slicer - Headless Backend Service

This directory contains a lightweight, headless backend service for **OrcaWeb**.
It accepts 3D model files (`.stl` / `.3mf`) + slicing settings via REST API, executes native `orcaslicer` or `prusa-slicer` in CLI mode, and returns sliced G-code directly to your browser frontend.

## Quick Start with Docker (ARM64 & x86)

```bash
cd server
docker compose up -d --build
```

The backend server will start on `http://localhost:8080`.

## API Endpoints

- `GET /api/health` -> Returns backend status and installed CLI slicer binary.
- `POST /api/slice` -> Accepts `multipart/form-data`:
  - `file`: STL or 3MF file blob
  - `settings`: JSON string of slicing parameters

## Connecting to OrcaWeb Frontend

In the OrcaWeb frontend:
1. Open the **Engine** tab in the right sidebar.
2. Select **Remote OrcaSlicer / PrusaSlicer API**.
3. Set your server endpoint (e.g. `http://localhost:8080` or `http://192.168.1.100:8080`).
4. Click **SLICE NOW**!
