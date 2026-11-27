# Spike for #546: PaddleOCR-VL 1.6 (D346) on a rented GPU, billed per second (Modal).
# Run from a machine with `modal setup` done:  modal run modal_paddle.py --gpu L4
# Prints one JSON line: seconds per page per PDF, start-up times, peak GPU memory.
# The PDFs are public papers and a free book, fetched at run time; each is cut to 5 pages.
import json
import modal

app = modal.App("ore-paddle-spike")
cache = modal.Volume.from_name("ore-paddle-cache", create_if_missing=True)

image = (
    modal.Image.from_registry("nvidia/cuda:12.8.1-cudnn-runtime-ubuntu22.04", add_python="3.12")
    .apt_install("libgl1", "libglib2.0-0", "curl", "build-essential")  # Triton compiles kernels at warm-up
    # The page reader's own process: layout model on the GPU (paddlepaddle-gpu), as on the Mac but CUDA.
    .run_commands("pip install paddlepaddle-gpu==3.2.1 -i https://www.paddlepaddle.org.cn/packages/stable/cu126/")
    .pip_install("paddleocr[doc-parser]==3.7.0", "pypdf", "requests")
    # The model's server in its own venv (vLLM pins its own torch), as PaddleOCR's docs set it up.
    .run_commands(
        "python -m venv /opt/vllm",
        "/opt/vllm/bin/pip install 'paddleocr[doc-parser]==3.7.0'",
        # Its own paddlex first on PATH: the system one imports paddle-gpu, which needs a GPU the build lacks.
        "PATH=/opt/vllm/bin:$PATH /opt/vllm/bin/paddleocr install_genai_server_deps vllm",
        # flash-attn is skipped above with no GPU at build time, and the server needs it: its prebuilt wheel.
        "/opt/vllm/bin/pip install https://github.com/Dao-AILab/flash-attention/releases/download/v2.8.3/flash_attn-2.8.3+cu12torch2.8cxx11abiTRUE-cp312-cp312-linux_x86_64.whl",
    )
)

PDFS = {
    "paper-transformer": ("https://arxiv.org/pdf/1706.03762v7", [1, 3, 5, 8, 9]),
    "paper-gpt3-tables": ("https://arxiv.org/pdf/2005.14165v4", [1, 10, 11, 23, 24]),
    "book-thinkpython": ("https://greenteapress.com/thinkpython2/thinkpython2.pdf", [21, 22, 23, 60, 61]),
}


@app.function(image=image, gpu="L4", timeout=3600, volumes={"/cache": cache})
def bench() -> str:
    import os, subprocess, time, requests
    from pypdf import PdfReader, PdfWriter

    os.environ["HF_HOME"] = "/cache/hf"
    os.environ["PADDLE_PDX_CACHE_HOME"] = "/cache/paddlex"
    t0 = time.time()
    srv = subprocess.Popen(["/opt/vllm/bin/paddlex_genai_server", "--model_name", "PaddleOCR-VL-1.6-0.9B", "--backend", "vllm", "--host", "127.0.0.1", "--port", "8118"], env={**os.environ, "PATH": "/opt/vllm/bin:" + os.environ["PATH"]})
    while True:
        if srv.poll() is not None:
            raise RuntimeError("the model's server stopped")
        try:
            if requests.get("http://127.0.0.1:8118/health", timeout=1).status_code == 200:
                break
        except requests.RequestException:
            pass
        time.sleep(1)
    server_up = time.time() - t0

    from paddleocr import PaddleOCRVL
    t1 = time.time()
    pipe = PaddleOCRVL(pipeline_version="v1.6", vl_rec_backend="vllm-server", vl_rec_server_url="http://127.0.0.1:8118/v1")
    pipe_up = time.time() - t1

    os.makedirs("/tmp/pdf", exist_ok=True)
    paths = []
    for name, (url, pages) in PDFS.items():
        raw = f"/tmp/pdf/{name}-full.pdf"
        open(raw, "wb").write(requests.get(url, timeout=120, headers={"User-Agent": "ore-spike"}).content)
        r, w = PdfReader(raw), PdfWriter()
        for k in pages:
            w.add_page(r.pages[k - 1])
        w.write(f"/tmp/pdf/{name}.pdf")
        paths.append(f"/tmp/pdf/{name}.pdf")

    def read(path):
        t = time.time()
        pages = blocks = 0
        for res in pipe.predict(path):
            j = res.json
            j = j.get("res", j)
            pages += 1
            blocks += len(j["parsing_res_list"])
        return {"pages": pages, "blocks": blocks, "s_per_page": round((time.time() - t) / pages, 2)}

    read(paths[0])  # warm up (first request compiles kernels)
    per_pdf = {os.path.basename(p)[:-4]: read(p) for p in paths}
    # All 15 pages in one PDF: what a book does, pages kept in flight together.
    w = PdfWriter()
    for p in paths:
        for pg in PdfReader(p).pages:
            w.add_page(pg)
    w.write("/tmp/pdf/all.pdf")
    together = read("/tmp/pdf/all.pdf")
    gpu = subprocess.run(["nvidia-smi", "--query-gpu=name,memory.used,memory.total", "--format=csv,noheader"], capture_output=True, text=True).stdout.strip()
    srv.terminate()
    cache.commit()
    return json.dumps({"gpu": gpu, "server_up_s": round(server_up, 1), "pipeline_up_s": round(pipe_up, 1), "per_pdf": per_pdf, "all_15_pages": together})


@app.local_entrypoint()
def main(gpu: str = "L4"):
    print(bench.with_options(gpu=gpu).remote())
