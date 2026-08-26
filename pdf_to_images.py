import sys, json, base64, os
os.environ["PYTHONWARNINGS"] = "ignore"
import pymupdf
doc = pymupdf.open(sys.argv[1])
out = []
for i in range(len(doc)):
    pix = doc[i].get_pixmap(dpi=150)
    out.append(base64.b64encode(pix.tobytes("jpeg")).decode())
doc.close()
sys.stdout.write(json.dumps(out))
