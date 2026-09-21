#!/usr/bin/env python3
"""Generate transparent PNG jewelry assets without third-party libraries."""

from __future__ import annotations

import math
import os
import struct
import zlib

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
EARRINGS_DIR = os.path.join(ROOT, "src", "assets", "ornaments", "earrings")
NECKLACES_DIR = os.path.join(ROOT, "src", "assets", "ornaments", "necklaces")


def clamp(value: float, low: float = 0.0, high: float = 255.0) -> int:
    return int(max(low, min(high, value)))


class Canvas:
    def __init__(self, width: int, height: int) -> None:
        self.width = width
        self.height = height
        self.pixels = bytearray(width * height * 4)

    def _index(self, x: int, y: int) -> int:
        return (y * self.width + x) * 4

    def blend(self, x: int, y: int, r: int, g: int, b: int, a: int) -> None:
        if a <= 0 or x < 0 or y < 0 or x >= self.width or y >= self.height:
            return
        i = self._index(x, y)
        src_a = a / 255.0
        dst_a = self.pixels[i + 3] / 255.0
        out_a = src_a + dst_a * (1.0 - src_a)
        if out_a <= 0:
            return
        for offset, channel in enumerate((r, g, b)):
            dst = self.pixels[i + offset]
            self.pixels[i + offset] = clamp(
                (channel * src_a + dst * dst_a * (1.0 - src_a)) / out_a
            )
        self.pixels[i + 3] = clamp(out_a * 255.0)

    def fill_circle(self, cx: float, cy: float, radius: float, color: tuple[int, int, int, int]) -> None:
        r, g, b, a = color
        min_x = max(0, int(cx - radius - 1))
        max_x = min(self.width - 1, int(cx + radius + 1))
        min_y = max(0, int(cy - radius - 1))
        max_y = min(self.height - 1, int(cy + radius + 1))
        for y in range(min_y, max_y + 1):
            for x in range(min_x, max_x + 1):
                distance = math.hypot(x - cx, y - cy)
                coverage = radius + 0.5 - distance
                if coverage <= 0:
                    continue
                alpha = clamp(a * min(1.0, coverage))
                self.blend(x, y, r, g, b, alpha)

    def fill_ellipse(
        self, cx: float, cy: float, rx: float, ry: float, color: tuple[int, int, int, int]
    ) -> None:
        r, g, b, a = color
        min_x = max(0, int(cx - rx - 1))
        max_x = min(self.width - 1, int(cx + rx + 1))
        min_y = max(0, int(cy - ry - 1))
        max_y = min(self.height - 1, int(cy + ry + 1))
        for y in range(min_y, max_y + 1):
            for x in range(min_x, max_x + 1):
                nx = (x - cx) / max(rx, 0.001)
                ny = (y - cy) / max(ry, 0.001)
                distance = math.hypot(nx, ny)
                coverage = 1.05 - distance
                if coverage <= 0:
                    continue
                alpha = clamp(a * min(1.0, coverage * 4.0))
                self.blend(x, y, r, g, b, alpha)

    def stroke_circle(
        self, cx: float, cy: float, radius: float, thickness: float, color: tuple[int, int, int, int]
    ) -> None:
        r, g, b, a = color
        outer = radius + thickness / 2
        inner = max(0.0, radius - thickness / 2)
        min_x = max(0, int(cx - outer - 1))
        max_x = min(self.width - 1, int(cx + outer + 1))
        min_y = max(0, int(cy - outer - 1))
        max_y = min(self.height - 1, int(cy + outer + 1))
        for y in range(min_y, max_y + 1):
            for x in range(min_x, max_x + 1):
                distance = math.hypot(x - cx, y - cy)
                if distance > outer + 0.5 or distance < inner - 0.5:
                    continue
                coverage = min(outer + 0.5 - distance, distance - (inner - 0.5))
                alpha = clamp(a * min(1.0, max(0.0, coverage)))
                self.blend(x, y, r, g, b, alpha)

    def stroke_arc(
        self,
        cx: float,
        cy: float,
        radius: float,
        start: float,
        end: float,
        thickness: float,
        color: tuple[int, int, int, int],
    ) -> None:
        r, g, b, a = color
        outer = radius + thickness / 2
        inner = max(0.0, radius - thickness / 2)
        min_x = max(0, int(cx - outer - 1))
        max_x = min(self.width - 1, int(cx + outer + 1))
        min_y = max(0, int(cy - outer - 1))
        max_y = min(self.height - 1, int(cy + outer + 1))
        for y in range(min_y, max_y + 1):
            for x in range(min_x, max_x + 1):
                dx = x - cx
                dy = y - cy
                distance = math.hypot(dx, dy)
                if distance > outer + 0.5 or distance < inner - 0.5:
                    continue
                angle = (math.degrees(math.atan2(dy, dx)) + 360) % 360
                if start <= end:
                    in_arc = start - 2 <= angle <= end + 2
                else:
                    in_arc = angle >= start - 2 or angle <= end + 2
                if not in_arc:
                    continue
                coverage = min(outer + 0.5 - distance, distance - (inner - 0.5))
                alpha = clamp(a * min(1.0, max(0.0, coverage)))
                self.blend(x, y, r, g, b, alpha)

    def stroke_polyline(
        self,
        points: list[tuple[float, float]],
        thickness: float,
        color: tuple[int, int, int, int],
        round_caps: bool = True,
    ) -> None:
        for index in range(len(points) - 1):
            x1, y1 = points[index]
            x2, y2 = points[index + 1]
            self._stroke_segment(x1, y1, x2, y2, thickness, color)
        if round_caps:
            r, g, b, a = color
            radius = thickness / 2
            for x, y in (points[0], points[-1]):
                self.fill_circle(x, y, radius, (r, g, b, a))

    def _stroke_segment(
        self,
        x1: float,
        y1: float,
        x2: float,
        y2: float,
        thickness: float,
        color: tuple[int, int, int, int],
    ) -> None:
        r, g, b, a = color
        dx = x2 - x1
        dy = y2 - y1
        length = math.hypot(dx, dy) or 1.0
        nx = -dy / length
        ny = dx / length
        half = thickness / 2
        min_x = max(0, int(min(x1, x2) - half - 1))
        max_x = min(self.width - 1, int(max(x1, x2) + half + 1))
        min_y = max(0, int(min(y1, y2) - half - 1))
        max_y = min(self.height - 1, int(max(y1, y2) + half + 1))
        for y in range(min_y, max_y + 1):
            for x in range(min_x, max_x + 1):
                px = x - x1
                py = y - y1
                t = max(0.0, min(1.0, (px * dx + py * dy) / (length * length)))
                closest_x = x1 + t * dx
                closest_y = y1 + t * dy
                distance = math.hypot(x - closest_x, y - closest_y)
                coverage = half + 0.5 - distance
                if coverage <= 0:
                    continue
                shade = 1.0 + 0.08 * (px * nx + py * ny) / max(half, 1.0)
                alpha = clamp(a * min(1.0, coverage))
                self.blend(x, y, clamp(r * shade), clamp(g * shade), clamp(b * shade), alpha)

    def highlight(self, cx: float, cy: float, radius: float) -> None:
        self.fill_circle(cx, cy, radius, (255, 255, 255, 140))

    def save(self, path: os.PathLike[str] | str) -> None:
        raw = bytearray()
        for y in range(self.height):
            raw.append(0)
            start = y * self.width * 4
            raw.extend(self.pixels[start : start + self.width * 4])

        def chunk(tag: bytes, data: bytes) -> bytes:
            return (
                struct.pack(">I", len(data))
                + tag
                + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
            )

        png = b"\x89PNG\r\n\x1a\n"
        png += chunk(b"IHDR", struct.pack(">IIBBBBB", self.width, self.height, 8, 6, 0, 0, 0))
        png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        png += chunk(b"IEND", b"")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as handle:
            handle.write(png)


GOLD = (214, 168, 74, 255)
GOLD_DARK = (168, 118, 38, 255)
GOLD_LIGHT = (245, 214, 130, 255)
ROSE = (196, 122, 108, 255)
SILVER = (198, 206, 214, 255)
PEARL = (246, 240, 230, 255)
RUBY = (176, 36, 52, 255)
EMERALD = (42, 122, 86, 255)
DIAMOND = (232, 244, 255, 255)


def draw_pearl_drop(path: str) -> None:
    canvas = Canvas(220, 360)
    canvas.stroke_arc(110, 42, 22, 200, 340, 7, GOLD)
    canvas.fill_circle(110, 64, 8, GOLD)
    canvas.fill_ellipse(110, 210, 48, 68, PEARL)
    canvas.fill_ellipse(96, 188, 16, 22, (255, 255, 255, 120))
    canvas.fill_circle(110, 132, 14, GOLD)
    canvas.stroke_circle(110, 210, 48, 3, GOLD_LIGHT)
    canvas.save(path)


def draw_gold_hoop(path: str) -> None:
    canvas = Canvas(240, 280)
    canvas.stroke_circle(120, 150, 86, 18, GOLD)
    canvas.stroke_circle(120, 150, 86, 6, GOLD_LIGHT)
    canvas.fill_circle(120, 64, 9, GOLD_DARK)
    canvas.highlight(78, 108, 8)
    canvas.save(path)


def draw_diamond_stud(path: str) -> None:
    canvas = Canvas(180, 180)
    canvas.fill_circle(90, 90, 42, GOLD)
    canvas.fill_circle(90, 90, 28, DIAMOND)
    canvas.fill_circle(82, 80, 8, (255, 255, 255, 180))
    for angle in range(0, 360, 45):
        radians = math.radians(angle)
        canvas.stroke_polyline(
            [
                (90 + math.cos(radians) * 12, 90 + math.sin(radians) * 12),
                (90 + math.cos(radians) * 38, 90 + math.sin(radians) * 38),
            ],
            3,
            (255, 255, 255, 160),
        )
    canvas.save(path)


def draw_ruby_drop(path: str) -> None:
    canvas = Canvas(200, 340)
    canvas.stroke_arc(100, 36, 18, 200, 340, 6, GOLD)
    canvas.fill_circle(100, 58, 7, GOLD)
    canvas.fill_ellipse(100, 118, 22, 16, GOLD)
    canvas.fill_ellipse(100, 200, 38, 58, RUBY)
    canvas.fill_ellipse(90, 178, 10, 16, (255, 140, 150, 140))
    canvas.fill_circle(100, 142, 10, GOLD_LIGHT)
    canvas.save(path)


def draw_gold_chain(path: str) -> None:
    canvas = Canvas(520, 360)
    points = []
    for index in range(49):
        t = index / 48
        x = 40 + t * 440
        y = 40 + 230 * math.sin(t * math.pi)
        points.append((x, y))
    canvas.stroke_polyline(points, 10, GOLD)
    for x, y in points[::3]:
        canvas.stroke_circle(x, y, 8, 3, GOLD_LIGHT)
    canvas.fill_ellipse(260, 286, 18, 24, GOLD)
    canvas.fill_circle(260, 286, 8, GOLD_LIGHT)
    canvas.save(path)


def draw_pearl_strand(path: str) -> None:
    canvas = Canvas(540, 340)
    for index in range(23):
        t = index / 22
        x = 36 + t * 468
        y = 36 + 210 * math.sin(t * math.pi)
        radius = 13 if index % 2 == 0 else 10
        canvas.fill_circle(x, y, radius + 2, GOLD_LIGHT)
        canvas.fill_circle(x, y, radius, PEARL)
        canvas.fill_circle(x - 4, y - 4, 3, (255, 255, 255, 150))
    canvas.fill_circle(270, 258, 16, PEARL)
    canvas.save(path)


def draw_emerald_pendant(path: str) -> None:
    canvas = Canvas(480, 380)
    points = []
    for index in range(41):
        t = index / 40
        x = 50 + t * 380
        y = 36 + 170 * math.sin(t * math.pi)
        points.append((x, y))
    canvas.stroke_polyline(points, 7, GOLD)
    canvas.fill_ellipse(240, 248, 34, 46, EMERALD)
    canvas.fill_ellipse(240, 248, 40, 52, (*EMERALD[:3], 0))
    canvas.stroke_circle(240, 248, 40, 6, GOLD)
    canvas.fill_ellipse(228, 232, 10, 14, (180, 230, 200, 120))
    canvas.save(path)


def draw_rose_collar(path: str) -> None:
    canvas = Canvas(560, 300)
    for radius, thickness, color in (
        (210, 16, ROSE),
        (186, 8, GOLD_LIGHT),
        (164, 12, ROSE),
    ):
        canvas.stroke_arc(280, -20, radius, 20, 160, thickness, color)
    for index in range(9):
        t = (index + 1) / 10
        angle = math.radians(20 + t * 140)
        x = 280 + math.cos(angle) * 186
        y = -20 + math.sin(angle) * 186
        canvas.fill_circle(x, y, 8, GOLD)
    canvas.save(path)


def main() -> None:
    os.makedirs(EARRINGS_DIR, exist_ok=True)
    os.makedirs(NECKLACES_DIR, exist_ok=True)

    draw_pearl_drop(os.path.join(EARRINGS_DIR, "pearl-drop.png"))
    draw_gold_hoop(os.path.join(EARRINGS_DIR, "gold-hoop.png"))
    draw_diamond_stud(os.path.join(EARRINGS_DIR, "diamond-stud.png"))
    draw_ruby_drop(os.path.join(EARRINGS_DIR, "ruby-drop.png"))
    print("Generated ornament PNG assets.")


if __name__ == "__main__":
    main()
