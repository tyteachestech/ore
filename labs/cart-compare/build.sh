#!/usr/bin/env bash
# Builds the comparison into out/: the code version (the app's own end screen, built from a checkout of its branch)
# and the Rive version (its stage, published .riv and runtime), each a page of its own under one comparison page.
#   ./build.sh <checkout of the code version> <checkout of the Rive lab>
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
code=$(cd "$1" && pwd); rive=$(cd "$2" && pwd)
out="$here/out"; rm -rf "$out"; mkdir -p "$out"

# Code: a second Vite entry inside the app, built as a static page, then taken out again.
d="$code/apps/desktop"
cp "$here/code.html" "$d/lab-cart.html"; cp "$here/lab.vite.config.ts" "$d/"
cp "$here/lab-cart.tsx" "$here/frames-probe.js" "$d/src/"
trap 'rm -f "$d/lab-cart.html" "$d/lab.vite.config.ts" "$d/src/lab-cart.tsx" "$d/src/frames-probe.js"' EXIT
(cd "$d" && bunx vite build --config lab.vite.config.ts --outDir "$out/code" --emptyOutDir --logLevel warn)
mv "$out/code/lab-cart.html" "$out/code/index.html"
rm -rf "$out/code/mingcute-px"   # the skill icons are served from it only by the app's icon picker

# Rive: its stage page, timing, the published file and the small web runtime (MIT), with the same frame probe.
l="$rive/labs/cart-rive"
mkdir -p "$out/rive/stage/vendor/lite" "$out/rive/rive/build"
cp "$l/stage/index.html" "$l/stage/stage.js" "$here/frames-probe.js" "$out/rive/stage/"
sed -i 's#<script src="stage.js"#<script src="frames-probe.js"></script>\n<script src="stage.js"#' "$out/rive/stage/index.html"
sed -i "s/r.play(); loaded = true;/r.play(); loaded = true; dispatchEvent(new Event(\"cart-start\"));/" "$out/rive/stage/stage.js"
grep -q cart-start "$out/rive/stage/stage.js"
# The same ground as the app's end screen, so the colour behind each does not say which is which.
sed -i "s/background: #121316/background: #1b1b1b/" "$out/rive/stage/index.html"
cp "$l/rive/timing.json" "$out/rive/rive/"
# Artifacts serve no .riv, so the file goes as base64 in JSON and the stage hands Rive the bytes (buffer, not src).
printf '{"b64":"%s"}' "$(base64 -w0 "$l/rive/build/cart-ending.riv")" > "$out/rive/rive/build/cart-ending.json"
sed -i '1i const RIV = Uint8Array.from(atob((await (await fetch("../rive/build/cart-ending.json")).json()).b64), (c) => c.charCodeAt(0)).buffer;' "$out/rive/stage/stage.js"
sed -i 's#src: "../rive/build/cart-ending.riv"#buffer: RIV#' "$out/rive/stage/stage.js"
grep -q "buffer: RIV" "$out/rive/stage/stage.js"
v=2.40.1
curl -fsSL "https://unpkg.com/@rive-app/canvas-lite@$v/rive.js" -o "$out/rive/stage/vendor/lite/rive.js"
curl -fsSL "https://unpkg.com/@rive-app/canvas-lite@$v/rive.wasm" -o "$out/rive/stage/vendor/lite/rive.wasm"

cp "$here/index.html" "$out/"
du -sh "$out"/*
# The publisher refuses a literal U+FFFD (one sits in a markdown parser's template string): write it as an escape.
python3 -c "import glob,sys
for f in glob.glob(sys.argv[1]+'/code/assets/*.js'):
  s=open(f,encoding='utf-8').read(); open(f,'w',encoding='utf-8').write(s.replace('�','\\\\uFFFD'))" "$out"
