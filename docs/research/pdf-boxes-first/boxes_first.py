"""Test driver for "boxes first" (thread: Price PDF crops against the page reader, 2026-11-27).
Reads a PDF with PaddleOCR-VL page by page, in one of two modes, and writes the same pages JSON as
Ore's driver (packages/core/src/ingest/paddle.ts) plus timings and the number of reading-model calls.
  all    every block goes to the reading model (what D346 does today)
  boxes  the layout model sees every page; the reading model reads only what Ore would use from it:
         tables, formulas, every block of a page with no text of its own (a scan), and a caption
         with no text of its own. Every other block takes the PDF's own text in its box.
Usage: boxes_first.py <all|boxes> <out dir> <pdf>...   (env VL_URL=http://host:port/ to use a running server)
"""
import json, os, re, signal, socket, subprocess, sys, time
signal.signal(signal.SIGTERM, lambda *a: sys.exit(1))
MODEL = "PaddlePaddle/PaddleOCR-VL-1.6"
mode, outdir, pdfs = sys.argv[1], sys.argv[2], sys.argv[3:]
assert mode in ("all", "boxes")
os.makedirs(outdir, exist_ok=True)
mlx = sys.platform == "darwin" and os.uname().machine == "arm64"
srv = None
CAPTION = {"figure_title", "vision_footnote"}
cur = {}    # the page being read: its pdfium text page, pixels per point, height in points, scan or not
stat = {"calls": 0, "skipped": 0}

def layer(box):
    """The PDF's own text inside a box given in the picture's pixels."""
    s = cur["scale"]
    return cur["text"].get_text_bounded(left=box[0] / s, bottom=cur["h"] - box[3] / s, right=box[2] / s, top=cur["h"] - box[1] / s)

def words(t): return len(re.findall(r"\w{2,}", t))

try:
    t0 = time.time()
    import pypdfium2 as pdfium
    from paddleocr import PaddleOCRVL
    from paddlex.inference.utils.io.readers import PDFReaderBackend
    url = os.environ.get("VL_URL")
    if mlx and not url:
        s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
        srv = subprocess.Popen([sys.executable, "-m", "mlx_vlm.server", "--model", MODEL, "--port", str(port), "--max-num-seqs", "1"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(600):
            if srv.poll() is not None: raise RuntimeError("the model's server stopped")
            try: socket.create_connection(("127.0.0.1", port), 1).close(); break
            except OSError: time.sleep(1)
        url = f"http://127.0.0.1:{port}/"
    pipe = PaddleOCRVL(pipeline_version="v1.6", vl_rec_backend=os.environ.get("VL_BACKEND", "mlx-vlm-server"), vl_rec_server_url=url, vl_rec_api_model_name=MODEL) if url else PaddleOCRVL(pipeline_version="v1.6")
    inner = pipe.paddlex_pipeline
    while "_pipeline" in vars(inner): inner = inner._pipeline
    orig = inner._paddleocr_vl_collect_page_vlm_entries_core
    def collect(page_idx, blocks, imgs, cfg):
        entries, spot, drop = orig(page_idx, blocks, imgs, cfg)
        if mode == "boxes" and not cur["scan"]:
            keep = []
            for e in entries:
                b = blocks[e[1]]
                if e[3] != "OCR:" or (b["label"] in CAPTION and not layer(b["box"]).strip()): keep.append(e)
            stat["skipped"] += len(entries) - len(keep); entries = keep
        stat["calls"] += len(entries)
        return entries, spot, drop
    inner._paddleocr_vl_collect_page_vlm_entries_core = collect
    load = time.time() - t0
    render = PDFReaderBackend()
    for pdf in pdfs:
        name = os.path.basename(pdf)[:-4]; doc = pdfium.PdfDocument(pdf); pages = []; t1 = time.time(); c0 = dict(stat)
        for n in range(len(doc)):
            tp = time.time(); page = doc[n]; img = render._render_page(page, page_index=n + 1); text = page.get_textpage()
            cur.update(text=text, scale=img.shape[1] / page.get_width(), h=page.get_height(), scan=words(text.get_text_range()) < 5)
            k0 = stat["calls"]
            j = next(iter(pipe.predict(img))).json; j = j.get("res", j)
            blocks = []
            for b in j["parsing_res_list"]:
                content = b["block_content"] or ""
                if mode == "boxes" and not content and not cur["scan"]: content = " ".join(layer(b["block_bbox"]).split())
                blocks.append({"label": b["block_label"], "content": content, "bbox": b["block_bbox"]})
            pages.append({"page": n + 1, "width": j["width"], "height": j["height"], "blocks": blocks, "seconds": round(time.time() - tp, 2), "calls": stat["calls"] - k0, "scan": cur["scan"]})
        json.dump(pages, open(os.path.join(outdir, name + ".json"), "w"))
        print(json.dumps({"pdf": name, "mode": mode, "pages": len(pages), "seconds": round(time.time() - t1, 1), "calls": stat["calls"] - c0["calls"], "skipped": stat["skipped"] - c0["skipped"]}), flush=True)
    print(json.dumps({"mode": mode, "load_seconds": round(load, 1), "total_seconds": round(time.time() - t0, 1), **stat}), flush=True)
finally:
    if srv: srv.terminate()
