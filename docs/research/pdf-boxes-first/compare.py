"""Compares two folders of page-reader JSON (same names): boxes, labels and block text. Usage: compare.py <a> <b>"""
import json, os, sys
a, b = sys.argv[1], sys.argv[2]
clean = lambda t: " ".join(t.replace("\x02", "").replace("￾", "").split())
tot = same = text = 0
for f in sorted(os.listdir(a)):
    A, B = json.load(open(os.path.join(a, f))), json.load(open(os.path.join(b, f)))
    xs, ys = [x for p in A for x in p["blocks"]], [y for p in B for y in p["blocks"]]
    box = len(xs) == len(ys) and all(x["label"] == y["label"] and x["bbox"] == y["bbox"] for x, y in zip(xs, ys))
    diff = [(x["label"], x["content"][:60], y["content"][:60]) for x, y in zip(xs, ys) if clean(x["content"]) != clean(y["content"])]
    tot += len(xs); same += box * len(xs); text += len(diff)
    print(json.dumps({"pdf": f, "blocks": len(xs), "boxes_same": box, "text_diffs": len(diff), "first": diff[:2]}))
print(json.dumps({"blocks": tot, "blocks_in_matching_pdfs": same, "text_diffs": text}))
