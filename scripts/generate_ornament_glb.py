#!/usr/bin/env python3
"""Build GLB planes from jewelry PNGs for NitroVtoView (meters, face-relative)."""

from __future__ import annotations

import json
import os
import struct

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PNG_ROOT = os.path.join(ROOT, "src", "assets", "ornaments")
GLB_ROOT = os.path.join(ROOT, "src", "assets", "ornaments", "glb")

EARRING_ITEMS = [
    "diamond-earrings.png",
    "gold-jhumka.png",
    "pearl-jhumka.png",
    "silver-star-drop.png",
]
NECKLACE_ITEMS = [
    "gold-rope-chain.png",
    "beaded-box-chain.png",
    "layered-charm-set.png",
    "temple-necklace.png",
    "peacock-pendant.png",
    "floral-necklace.png",
    "bridal-choker.png",
]


# Worn necklace width across the collarbone. Height follows each PNG aspect
# so a tall chain is not stretched onto the default landscape plane.
NECKLACE_WIDTH_M = 0.13
NECKLACE_TOP_Y = -0.115
EARRING_HEIGHT_M = 0.046
# Nose-bridge relative. -0.018 sat on the ear center.
# The piercing sits a little below that; keep it on the lobe, not under it.
EARRING_LOBE_X = 0.078
EARRING_LOBE_Y = -0.042
EARRING_LOBE_Z = 0.006
# Studs are drawn in the middle of a square PNG, so the mesh center is the gem.
# These catalog photos have the hook at the top of the PNG.
EARRING_CENTER_ANCHORED: set[str] = set()


def png_size(path: str) -> tuple[int, int]:
    with open(path, "rb") as handle:
        handle.read(8)
        _length, chunk = struct.unpack(">I4s", handle.read(8))
        if chunk != b"IHDR":
            raise ValueError(f"Invalid PNG: {path}")
        width, height = struct.unpack(">II", handle.read(8))
        return width, height


def plane_from_png(
    path: str,
    target_width: float | None,
    target_height: float | None,
) -> tuple[float, float]:
    pixel_w, pixel_h = png_size(path)
    aspect = pixel_w / pixel_h
    if target_width is not None:
        return target_width, target_width / aspect
    if target_height is not None:
        return target_height * aspect, target_height
    raise ValueError("Need a target width or height")


def pad4(data: bytes) -> bytes:
    padding = (4 - (len(data) % 4)) % 4
    return data + (b" " * padding if padding else b"")


def packed(*values: float) -> bytes:
    return struct.pack("<" + "f" * len(values), *values)


def indices() -> bytes:
    return struct.pack("<6H", 0, 1, 2, 0, 2, 3)


def quad_vertices(width: float, height: float) -> bytes:
    hw = width / 2
    hh = height / 2
    # Facing +Z so Filament/ARCore sees the jewelry from the camera.
    # glTF UV origin is the top-left of the PNG (V increases downward), so the
    # top of the mesh must sample V=0 or the ornament renders upside down.
    return packed(
        -hw,
        -hh,
        0,
        0,
        0,
        1,
        0,
        1,
        hw,
        -hh,
        0,
        0,
        0,
        1,
        1,
        1,
        hw,
        hh,
        0,
        0,
        0,
        1,
        1,
        0,
        -hw,
        hh,
        0,
        0,
        0,
        1,
        0,
        0,
    )


def build_glb(png_bytes: bytes, nodes: list[dict], width: float, height: float) -> bytes:
    vertex_bytes = quad_vertices(width, height)
    index_bytes = indices()
    bin_chunk = vertex_bytes + index_bytes + png_bytes
    vertex_len = len(vertex_bytes)
    index_len = len(index_bytes)
    image_offset = vertex_len + index_len

    gltf = {
        "asset": {"version": "2.0", "generator": "JewelryVTO"},
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "meshes": [
            {
                "primitives": [
                    {
                        "attributes": {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2},
                        "indices": 3,
                        "material": 0,
                    }
                ]
            }
        ],
        "materials": [
            {
                "pbrMetallicRoughness": {
                    "baseColorTexture": {"index": 0},
                    "metallicFactor": 0.05,
                    "roughnessFactor": 0.7,
                },
                "alphaMode": "BLEND",
                "doubleSided": True,
            }
        ],
        "textures": [{"source": 0}],
        "images": [{"mimeType": "image/png", "bufferView": 2}],
        "accessors": [
            {
                "bufferView": 0,
                "byteOffset": 0,
                "componentType": 5126,
                "count": 4,
                "type": "VEC3",
                "max": [width / 2, height / 2, 0],
                "min": [-width / 2, -height / 2, 0],
            },
            {
                "bufferView": 0,
                "byteOffset": 12,
                "componentType": 5126,
                "count": 4,
                "type": "VEC3",
            },
            {
                "bufferView": 0,
                "byteOffset": 24,
                "componentType": 5126,
                "count": 4,
                "type": "VEC2",
            },
            {
                "bufferView": 1,
                "componentType": 5123,
                "count": 6,
                "type": "SCALAR",
            },
        ],
        "bufferViews": [
            {
                "buffer": 0,
                "byteOffset": 0,
                "byteLength": vertex_len,
                "byteStride": 32,
                "target": 34962,
            },
            {
                "buffer": 0,
                "byteOffset": vertex_len,
                "byteLength": index_len,
                "target": 34963,
            },
            {
                "buffer": 0,
                "byteOffset": image_offset,
                "byteLength": len(png_bytes),
            },
        ],
        "buffers": [{"byteLength": len(bin_chunk)}],
    }

    json_chunk = pad4(json.dumps(gltf, separators=(",", ":")).encode("utf-8"))
    bin_padded = pad4(bin_chunk)
    total = 12 + 8 + len(json_chunk) + 8 + len(bin_padded)
    header = struct.pack("<4sII", b"glTF", 2, total)
    json_header = struct.pack("<II", len(json_chunk), 0x4E4F534A)
    bin_header = struct.pack("<II", len(bin_padded), 0x004E4942)
    return header + json_header + json_chunk + bin_header + bin_padded


def write_glb(png_path: str, out_path: str, nodes: list[dict], width: float, height: float) -> None:
    with open(png_path, "rb") as handle:
        png_bytes = handle.read()
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "wb") as handle:
        handle.write(build_glb(png_bytes, nodes, width, height))


def main() -> None:
    for name in EARRING_ITEMS:
        png_path = os.path.join(PNG_ROOT, "earrings", name)
        width, height = plane_from_png(png_path, None, EARRING_HEIGHT_M)
        lobe_y = (
            EARRING_LOBE_Y
            if name in EARRING_CENTER_ANCHORED
            else EARRING_LOBE_Y - height / 2
        )
        earring_nodes = [
            {"name": "JewelryEarNegativeX" + ("Stud" if name in EARRING_CENTER_ANCHORED else ""), "mesh": 0, "translation": [-EARRING_LOBE_X, lobe_y, EARRING_LOBE_Z]},
            {"name": "JewelryEarPositiveX" + ("Stud" if name in EARRING_CENTER_ANCHORED else ""), "mesh": 0, "translation": [EARRING_LOBE_X, lobe_y, EARRING_LOBE_Z]},
        ]
        write_glb(
            png_path,
            os.path.join(GLB_ROOT, name.replace(".png", ".glb")),
            earring_nodes,
            width,
            height,
        )
        write_glb(
            png_path,
            os.path.join(GLB_ROOT, name.replace(".png", "-preview.glb")),
            [{"mesh": 0, "translation": [0, 0, 0]}],
            width,
            height,
        )
    for name in NECKLACE_ITEMS:
        png_path = os.path.join(PNG_ROOT, "necklaces", name)
        width, height = plane_from_png(png_path, NECKLACE_WIDTH_M, None)
        necklace_nodes = [
            {"name": "JewelryNecklace", "mesh": 0, "translation": [0, NECKLACE_TOP_Y - height / 2, 0.012]}
        ]
        write_glb(
            png_path,
            os.path.join(GLB_ROOT, name.replace(".png", ".glb")),
            necklace_nodes,
            width,
            height,
        )


if __name__ == "__main__":
    main()
