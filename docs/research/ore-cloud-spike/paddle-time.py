import json, sys, time, os
from paddleocr import PaddleOCRVL
t0=time.time()
pipe = PaddleOCRVL(pipeline_version="v1.6")
load=time.time()-t0
for pdf in sys.argv[2:]:
    name=os.path.basename(pdf).replace(".pdf","")
    pages=[]; times=[]; t=time.time()
    for r in pipe.predict(pdf):
        j=r.json; j=j.get("res",j)
        pages.append({"page": j["page_index"]+1, "width": j["width"], "height": j["height"], "blocks": [{"label": b["block_label"], "content": b["block_content"] or "", "bbox": b["block_bbox"]} for b in j["parsing_res_list"]]})
        now=time.time(); times.append(round(now-t,1)); t=now
        print(name, j["page_index"]+1, times[-1], flush=True)
    json.dump(pages, open(f"{sys.argv[1]}/{name}.json","w"))
    json.dump({"load":load,"times":times}, open(f"{sys.argv[1]}/{name}.time.json","w"))
import resource
print("peak_rss_gb", resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1e6, "load_s", round(load,1))
