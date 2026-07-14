# Brand assets

The mark: the **human figure inside the Foundation shield** — proof-of-humanity
under Foundation's emblem.

| File | Use |
|---|---|
| `logo.svg` | Source vector (gradient shield + human figure) |
| `logo.png` (512²) / `logo-1024.png` (1024²) | Raster avatar — **GitHub org avatar** + **npm org avatar** (the org avatar also covers the repo avatar) |
| `social-preview.png` (1280×640) | **Repo → Settings → Social preview** banner |

Palette: Foundation gradient indigo `#6366F1` → emerald `#34D399`, figure navy
`#0A0E27`, shield white. PNGs are composited with ImageMagick (MSVG can't render
SVG gradients): a native `gradient:` tile + the flat `logo.svg` shapes.
