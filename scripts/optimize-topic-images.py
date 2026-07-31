#!/usr/bin/env python3
"""
Resize topic artwork to max 512px and write WebP (quality 80, alpha kept).

Accepts PNG or WebP under assets/topics/. PNG masters are removed after a
successful WebP write so the bundle only ships thumbs.

Requires: Pillow (`pip install pillow` / system python with PIL).
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "assets" / "topics"
MAX_EDGE = 512
QUALITY = 80


def optimize(path: Path, max_edge: int, quality: int, dry_run: bool) -> tuple[int, int]:
    im = Image.open(path)
    if im.mode == "P":
        im = im.convert("RGBA")
    elif im.mode not in ("RGB", "RGBA"):
        im = im.convert("RGBA" if "A" in im.getbands() else "RGB")
    im.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
    out = path.with_suffix(".webp")
    in_sz = path.stat().st_size
    if dry_run:
        return in_sz, in_sz
    # Always write via temp so in-place .webp re-encodes never truncate the source.
    tmp = out.with_suffix(".webp.tmp")
    im.save(tmp, "WEBP", quality=quality, method=6)
    tmp.replace(out)
    out_sz = out.stat().st_size
    if path != out and path.suffix.lower() == ".png":
        path.unlink()
    return in_sz, out_sz


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-edge", type=int, default=MAX_EDGE)
    parser.add_argument("--quality", type=int, default=QUALITY)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    sources = sorted(
        [*ROOT.glob("*.png"), *ROOT.glob("*.webp")],
        key=lambda p: p.name.lower(),
    )
    if not sources:
        print(f"no images under {ROOT}")
        return 1

    total_in = total_out = 0
    for src in sources:
        # Re-optimizing webp: open + re-encode in place
        in_sz, out_sz = optimize(src, args.max_edge, args.quality, args.dry_run)
        total_in += in_sz
        total_out += out_sz
        print(f"{src.name}: {in_sz // 1024}k -> {out_sz // 1024}k")

    print(
        f"done count={len(sources)} "
        f"in_mb={total_in / 1024 / 1024:.2f} out_mb={total_out / 1024 / 1024:.2f}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
