#!/usr/bin/env python3
"""
OrcaSlicer / PrusaSlicer Engine CLI Bridge
Applies 3D model orientation (Rotation X/Y/Z, Scale, Position),
generates profile config.ini, runs native PrusaSlicer / OrcaSlicer CLI,
and extracts sliced G-code and print statistics.
"""

import os
import sys
import json
import math
import subprocess
import tempfile

def find_slicer_binary():
    """Finds installed OrcaSlicer, PrusaSlicer, or Slic3r executable across system paths."""
    candidates = [
        "/usr/local/bin/orcaslicer",
        "/usr/local/bin/orca-slicer",
        "/opt/orcaslicer/AppRun",
        "/usr/bin/prusa-slicer",
        "/Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer",
        "/Applications/PrusaSlicer.app/Contents/MacOS/PrusaSlicer",
        "orcaslicer",
        "orca-slicer",
        "prusa-slicer",
        "slic3r",
    ]
    for b in candidates:
        if os.path.exists(b):
            return b
        if subprocess.call(["which", b], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) == 0:
            return b
    return None

def apply_mesh_transform(input_path, output_path, position, rotation, scale):
    """
    Applies exact browser 3D rotation, scale, and position to the STL mesh
    using trimesh/numpy.
    """
    try:
        import trimesh
        import numpy as np

        mesh = trimesh.load(input_path)

        # 1. Apply Scale
        sx, sy, sz = scale.get("x", 1.0), scale.get("y", 1.0), scale.get("z", 1.0)
        if sx != 1.0 or sy != 1.0 or sz != 1.0:
            mesh.apply_scale([sx, sy, sz])

        # 2. Apply Rotation (Euler XYZ)
        rx, ry, rz = rotation.get("x", 0.0), rotation.get("y", 0.0), rotation.get("z", 0.0)
        if rx != 0.0 or ry != 0.0 or rz != 0.0:
            matrix_x = trimesh.transformations.rotation_matrix(rx, [1, 0, 0])
            matrix_y = trimesh.transformations.rotation_matrix(ry, [0, 1, 0])
            matrix_z = trimesh.transformations.rotation_matrix(rz, [0, 0, 1])
            rot_matrix = trimesh.transformations.concatenate_matrices(matrix_z, matrix_y, matrix_x)
            mesh.apply_transform(rot_matrix)

        # 3. Ground lowest Z vertex to Z=0
        bounds = mesh.bounds
        z_offset = -bounds[0][2]
        mesh.apply_translation([0, 0, z_offset])

        # 4. Translate to target bed coordinates
        px, py = position.get("x", 122.5), position.get("y", 122.5)
        if px != 0.0 or py != 0.0:
            mesh.apply_translation([px, py, 0])

        mesh.export(output_path)
        return True
    except Exception as e:
        print(f"[Warning] Trimesh transformation warning: {e}. Using raw file.")
        with open(input_path, "rb") as f_in, open(output_path, "wb") as f_out:
            f_out.write(f_in.read())
        return False

def generate_config_ini(settings, config_path):
    """Generates PrusaSlicer / OrcaSlicer config.ini file."""
    bed = settings.get("bed", {})
    filament = settings.get("filament", {})

    nozzle_temp = settings.get("nozzleTemp", 210)
    bed_temp = settings.get("bedTemp", 60)

    start_macro = settings.get("startGCode", f"PRINT_START EXTRUDER={nozzle_temp} BED={bed_temp}")
    end_macro = settings.get("endGCode", "PRINT_END")
    layer_macro = settings.get("layerChangeGCode", ";AFTER_LAYER_CHANGE\\n;[layer_z]")

    start_macro = start_macro.replace("{nozzleTemp}", str(nozzle_temp)).replace("{bedTemp}", str(bed_temp)).replace("\n", "\\n")
    end_macro = end_macro.replace("\n", "\\n")
    layer_macro = layer_macro.replace("\n", "\\n")

    lines = [
        "# Generated Profile Config",
        f"layer_height = {settings.get('layerHeight', 0.2)}",
        f"first_layer_height = {settings.get('firstLayerHeight', 0.24)}",
        f"perimeters = {settings.get('wallPerimeters', 3)}",
        f"top_solid_layers = {settings.get('topSolidLayers', 4)}",
        f"bottom_solid_layers = {settings.get('bottomSolidLayers', 3)}",
        f"fill_density = {settings.get('infillDensity', 15)}%",
        f"fill_pattern = {settings.get('infillPattern', 'gyroid')}",
        f"temperature = {nozzle_temp}",
        f"first_layer_temperature = {nozzle_temp}",
        f"bed_temperature = {bed_temp}",
        f"first_layer_bed_temperature = {bed_temp}",
        f"nozzle_diameter = {bed.get('nozzleDiameter', 0.4)}",
        f"filament_diameter = {filament.get('diameter', 1.75)}",
        f"filament_density = {filament.get('density', 1.24)}",
        f"perimeter_speed = {settings.get('outerWallSpeed', 60)}",
        f"infill_speed = {settings.get('infillSpeed', 120)}",
        f"travel_speed = {settings.get('travelSpeed', 200)}",
        f"retract_length = {settings.get('retractionDistance', 0.8)}",
        f"retract_speed = {settings.get('retractionSpeed', 40)}",
        f"supports = {1 if settings.get('enableSupports') else 0}",
        f"support_material = {1 if settings.get('enableSupports') else 0}",
        f"support_material_style = {settings.get('supportStyle', 'normal')}",
        f"start_gcode = {start_macro}",
        f"end_gcode = {end_macro}",
        f"layer_gcode = {layer_macro}",
        f"bed_shape = 0x0,{bed.get('width', 245)}x0,{bed.get('width', 245)}x{bed.get('depth', 245)},0x{bed.get('depth', 245)}",
        f"max_print_height = {bed.get('height', 260)}",
        f"gcode_flavor = reprap",
    ]

    with open(config_path, "w") as f:
        f.write("\n".join(lines))

def parse_gcode_stats(gcode_text):
    """Extracts print stats from generated G-code comments."""
    stats = {
        "estimatedTimeSeconds": 1200,
        "filamentUsedMeters": 12.5,
        "filamentUsedGrams": 37.5,
        "estimatedCost": 0.75,
    }

    lines = gcode_text.splitlines()
    for line in lines:
        l = line.strip().lower()
        if "filament used [mm]" in l or "filament used (mm)" in l:
            try:
                mm = float(l.split("=")[-1].strip().replace("mm", "").replace("m", ""))
                stats["filamentUsedMeters"] = round(mm / 1000.0 if mm > 100 else mm, 2)
            except Exception:
                pass
        elif "filament used [g]" in l or "filament used (g)" in l:
            try:
                g = float(l.split("=")[-1].strip().replace("g", ""))
                stats["filamentUsedGrams"] = round(g, 1)
            except Exception:
                pass
        elif "estimated printing time" in l:
            try:
                val = l.split("=")[-1].strip()
                secs = 0
                if "h" in val:
                    h_parts = val.split("h")
                    secs += int(h_parts[0].strip()) * 3600
                    val = h_parts[1]
                if "m" in val:
                    m_parts = val.split("m")
                    secs += int(m_parts[0].strip()) * 60
                    val = m_parts[1]
                if "s" in val:
                    secs += int(val.replace("s", "").strip())
                if secs > 0:
                    stats["estimatedTimeSeconds"] = secs
            except Exception:
                pass

    return stats

def slice_model_with_orca(input_stl_path, settings, position, rotation, scale):
    """
    Main slicing pipeline:
    1. Transforms STL mesh with browser orientation/scale
    2. Generates config.ini profile
    3. Executes native PrusaSlicer / OrcaSlicer CLI
    4. Returns sliced G-code + stats
    """
    slicer_bin = find_slicer_binary()
    if not slicer_bin:
        raise RuntimeError("No slicer binary (OrcaSlicer or PrusaSlicer) found on the system.")

    with tempfile.TemporaryDirectory() as tmpdir:
        transformed_stl = os.path.join(tmpdir, "oriented_model.stl")
        config_ini = os.path.join(tmpdir, "config.ini")
        output_gcode = os.path.join(tmpdir, "output.gcode")

        # 1. Transform Mesh
        apply_mesh_transform(input_stl_path, transformed_stl, position, rotation, scale)

        # 2. Generate Config INI
        generate_config_ini(settings, config_ini)

        xvfb = "/usr/bin/xvfb-run" if os.path.exists("/usr/bin/xvfb-run") else None

        # Candidate CLI parameter variations
        cmd_variations = []

        if slicer_bin:
            prefix = [xvfb, "-a"] if (xvfb and ("orca" in slicer_bin.lower() or "apprun" in slicer_bin.lower())) else []
            cmd_variations.append(prefix + [slicer_bin, "-g", "--load", config_ini, "--output", output_gcode, transformed_stl])
            cmd_variations.append(prefix + [slicer_bin, "--export-gcode", "--load", config_ini, "--output", output_gcode, transformed_stl])

        if os.path.exists("/usr/bin/prusa-slicer"):
            cmd_variations.append(["/usr/bin/prusa-slicer", "-g", "--load", config_ini, "--output", output_gcode, transformed_stl])

        last_err = ""
        for cmd in cmd_variations:
            print(f"[SlicerEngine] Trying CLI command: {' '.join(cmd)}")
            try:
                proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=180)
                out = proc.stdout.decode('utf-8', errors='ignore')
                err = proc.stderr.decode('utf-8', errors='ignore')
                print(f"[SlicerEngine] Return code: {proc.returncode}")

                if os.path.exists(output_gcode) and os.path.getsize(output_gcode) > 100:
                    with open(output_gcode, "r", errors="ignore") as f:
                        gcode_str = f.read()

                    stats = parse_gcode_stats(gcode_str)
                    print(f"[SlicerEngine] Successfully sliced {len(gcode_str)} bytes of native G-code!")
                    return {
                        "gcode": gcode_str,
                        "stats": stats,
                        "engine": f"Native CLI ({os.path.basename(cmd[0])})"
                    }
                else:
                    last_err = f"stdout: {out}\nstderr: {err}"
                    print(f"[SlicerEngine] Failed variation: {last_err}")
            except Exception as e:
                last_err = str(e)
                print(f"[SlicerEngine] Exception on variation: {e}")

        raise RuntimeError(f"Native Slicer CLI execution failed. Output details:\n{last_err}")
