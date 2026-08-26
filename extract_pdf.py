import fitz  # PyMuPDF
import io
from PIL import Image

doc = fitz.open(r'C:\Users\bansa\Downloads\job_ticket-tracking-system (1)\test_catalogue.jpg')
print(f'PDF has {len(doc)} pages')

# Extract first 3 pages as images
for i in range(min(3, len(doc))):
    page = doc[i]
    pix = page.get_pixmap(dpi=150)
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    img.save(f'C:\\Users\\bansa\\Downloads\\job_ticket-tracking-system (1)\\test_page_{i+1}.jpg', 'JPEG', quality=90)
    print(f'Page {i+1}: {pix.width}x{pix.height}')

doc.close()
print('Done')
