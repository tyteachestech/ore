#!/bin/bash
# Makes the clip and the frame sheet: Rive's headless renderer draws the scene at twice the size, the page
# colour is cut out, the stage page plays the captures over its own ring, and a browser records it at 25 fps.
# usage: film.sh [outdir]      needs the rive CLI, node with playwright, python3 with numpy and Pillow, ffmpeg
set -e
cd "$(dirname "$0")"; OUT=${1:-out}
node gen.mjs --x2 --bg
./shoot.sh "$OUT/raw" 7.2 0
python3 key.py "$OUT/raw" stage/film
node gen.mjs   # back to the real scene: 1280 by 800, nothing behind it
node rec.mjs "$OUT/page"
ffmpeg -loglevel error -y -framerate 25 -i "$OUT/page/f%03d.png" -c:v libx264 -crf 16 -pix_fmt yuv420p -movflags +faststart "$OUT/cart-rive.mp4"
ffmpeg -loglevel error -y -start_number 0 -i "$OUT/page/f%03d.png" -vf "select='not(mod(n\,7))',crop=1800:1060:560:0,scale=iw*0.42:ih*0.42,tile=6x4:padding=4:color=0x2b2d31" -frames:v 1 -update 1 "$OUT/cart-rive-frames.png"
