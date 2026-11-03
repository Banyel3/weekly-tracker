#!/usr/bin/env bash
# Renders the PWA icons from the SVG glyph. Needs rsvg-convert (brew install librsvg); rerun after editing the SVG.
set -euo pipefail
cd "$(dirname "$0")/../public/icons"

bg="#0f0f1a"   # Cosmic Night --background, oklch(0.1743 0.0227 283.7998)
bar="#a48fff"  # Cosmic Night --primary, oklch(0.7162 0.1597 290.3962)

# Four rounded bars on a 512 grid; scale shrinks the glyph toward the centre.
glyph() {
  local scale="$1"
  cat <<SVG
  <g transform="translate(256 256) scale($scale) translate(-256 -256)" fill="$bar">
    <rect x="102" y="166" width="56" height="210" rx="28"/>
    <rect x="186" y="126" width="56" height="260" rx="28" opacity="0.85"/>
    <rect x="270" y="196" width="56" height="150" rx="28" opacity="0.7"/>
    <rect x="354" y="146" width="56" height="230" rx="28" opacity="0.55"/>
  </g>
SVG
}

svg() {
  local radius="$1" scale="$2"
  printf '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n'
  printf '  <rect width="512" height="512" rx="%s" fill="%s"/>\n' "$radius" "$bg"
  glyph "$scale"
  printf '</svg>\n'
}

svg 112 1 > icon.svg
svg 0 1 > full.svg.tmp
svg 0 0.72 > maskable.svg.tmp

rsvg-convert -w 192 -h 192 icon.svg -o icon-192.png
rsvg-convert -w 512 -h 512 icon.svg -o icon-512.png
rsvg-convert -w 512 -h 512 maskable.svg.tmp -o maskable-512.png
rsvg-convert -w 180 -h 180 full.svg.tmp -o apple-touch-icon.png
rm -f full.svg.tmp maskable.svg.tmp
ls -1 icon.svg ./*.png
