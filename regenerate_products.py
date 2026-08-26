import sys
import json
import base64
import io
import os
os.environ["PYTHONWARNINGS"] = "ignore"
import torch
import cv2
import numpy as np
from PIL import Image
from diffusers import StableDiffusionControlNetImg2ImgPipeline, ControlNetModel
from diffusers.utils import load_image
from controlnet_aux import CannyDetector

def detect_products(page_image: Image.Image) -> list:
    """Detect product regions using edge detection + contour analysis."""
    cv_img = cv2.cvtColor(np.array(page_image), cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
    
    # Enhance contrast
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    enhanced = clahe.apply(gray)
    
    # Edge detection
    edges = cv2.Canny(enhanced, 50, 150)
    
    # Morphological closing to connect edges
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5,5))
    closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
    
    # Find contours
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    h, w = gray.shape
    min_area = (w * h) * 0.02  # At least 2% of page
    max_area = (w * h) * 0.6   # At most 60% of page
    
    products = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if min_area < area < max_area:
            x, y, cw, ch = cv2.boundingRect(cnt)
            # Filter by aspect ratio (reasonable product shapes)
            aspect = cw / ch
            if 0.3 < aspect < 3.0:
                products.append({"x": x, "y": y, "w": cw, "h": ch})
    
    # Sort by position (top-to-bottom, left-to-right)
    products.sort(key=lambda p: (p["y"] // 100, p["x"]))
    
    # Merge overlapping boxes
    merged = []
    for p in products:
        if not merged:
            merged.append(p)
        else:
            last = merged[-1]
            # Check overlap
            if (p["x"] < last["x"] + last["w"] and 
                p["x"] + p["w"] > last["x"] and
                p["y"] < last["y"] + last["h"] and
                p["y"] + p["h"] > last["y"]):
                # Merge
                nx = min(last["x"], p["x"])
                ny = min(last["y"], p["y"])
                nw = max(last["x"] + last["w"], p["x"] + p["w"]) - nx
                nh = max(last["y"] + last["h"], p["y"] + p["h"]) - ny
                merged[-1] = {"x": nx, "y": ny, "w": nw, "h": nh}
            else:
                merged.append(p)
    
    return merged

def crop_product(page_image: Image.Image, box: dict) -> Image.Image:
    """Crop product from page with padding."""
    x, y, w, h = box["x"], box["y"], box["w"], box["h"]
    pad_x = int(w * 0.05)
    pad_y = int(h * 0.05)
    x = max(0, x - pad_x)
    y = max(0, y - pad_y)
    w = min(page_image.width - x, w + 2 * pad_x)
    h = min(page_image.height - y, h + 2 * pad_y)
    return page_image.crop((x, y, x + w, y + h))

def regenerate_product(cropped: Image.Image, prompt: str, seed: int) -> Image.Image:
    """Regenerate product using ControlNet Canny + img2img for faithful reconstruction."""
    
    # Load models (cached globally)
    global pipe, canny
    
    if pipe is None:
        controlnet = ControlNetModel.from_pretrained(
            "lllyasviel/sd-controlnet-canny", 
            torch_dtype=torch.float16
        )
        pipe = StableDiffusionControlNetImg2ImgPipeline.from_pretrained(
            "runwayml/stable-diffusion-v1-5",
            controlnet=controlnet,
            torch_dtype=torch.float16,
            safety_checker=None,
            requires_safety_checker=False,
        ).to("cuda")
        pipe.enable_attention_slicing()
        pipe.enable_vae_slicing()
        canny = CannyDetector()
    
    # Prepare control image (Canny edges of cropped product)
    control_image = canny(cropped, low_threshold=50, high_threshold=150)
    control_image = control_image.resize((512, 512))
    
    # Resize input for SD 1.5
    init_image = cropped.resize((512, 512))
    
    generator = torch.Generator(device="cuda").manual_seed(seed)
    
    result = pipe(
        prompt=prompt,
        negative_prompt="blurry, low quality, distorted, watermark, text, logo, background clutter, extra limbs, deformed",
        image=init_image,
        control_image=control_image,
        strength=0.6,  # How much to change (0.6 = significant but faithful)
        controlnet_conditioning_scale=0.8,
        num_inference_steps=30,
        guidance_scale=7.5,
        generator=generator,
    ).images[0]
    
    # Resize to 4:3 (768x576)
    result = result.resize((768, 576), Image.LANCZOS)
    return result

# Global model cache
pipe = None
canny = None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python regenerate.py <pdf_path> [prompt_template]"}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    prompt_template = sys.argv[2] if len(sys.argv) > 2 else "Professional product photography of {name}, clean white background, studio lighting, e-commerce style, sharp focus, photorealistic"
    
    # Import fitz here to avoid import issues
    import pymupdf
    doc = pymupdf.open(pdf_path)
    
    all_results = []
    base_seed = 42
    
    for page_idx in range(len(doc)):
        page = doc[page_idx]
        pix = page.get_pixmap(dpi=150)
        page_img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        
        # Detect products on this page
        products = detect_products(page_img)
        
        if not products:
            # Fallback: treat whole page as one product
            products = [{"x": 0, "y": 0, "w": page_img.width, "h": page_img.height}]
        
        for prod_idx, box in enumerate(products):
            cropped = crop_product(page_img, box)
            
            # Create prompt
            prompt = prompt_template.format(
                name=f"product page {page_idx+1} item {prod_idx+1}",
                page=page_idx+1,
                item=prod_idx+1
            )
            
            # Regenerate
            regenerated = regenerate_product(cropped, prompt, base_seed + page_idx * 10 + prod_idx)
            
            # Convert to base64
            buf = io.BytesIO()
            regenerated.save(buf, format="WEBP", quality=90)
            b64 = base64.b64encode(buf.getvalue()).decode()
            
            all_results.append({
                "page": page_idx + 1,
                "item": prod_idx + 1,
                "box": box,
                "image_base64": b64,
                "mime_type": "image/webp"
            })
    
    doc.close()
    print(json.dumps(all_results))