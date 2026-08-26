import sys
import json
import base64
import io
import requests
import urllib.parse
from PIL import Image

def generate_product_image(cropped_image_b64: str, product_name: str, description: str, colors: list) -> dict:
    color_str = ", ".join(colors) if colors else "standard"
    prompt = (
        f"Professional product photography of {product_name}, "
        f"{description}. "
        f"Colors available: {color_str}. "
        f"Clean white background, studio lighting, high quality, "
        f"e-commerce style product photo, centered, sharp focus, "
        f"photorealistic, 4K, commercial photography"
    )

    encoded_prompt = urllib.parse.quote(prompt)
    url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=768&height=576&model=flux&seed={hash(product_name) % 10000}"

    try:
        r = requests.get(url, timeout=120, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()

        image = Image.open(io.BytesIO(r.content))
        image = image.resize((768, 576), Image.LANCZOS)

        buffered = io.BytesIO()
        image.save(buffered, format="WEBP", quality=90)
        img_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

        return {
            "image_base64": img_base64,
            "mime_type": "image/webp",
            "prompt_used": prompt
        }
    except Exception as e:
        return {"error": str(e)}


def crop_product_from_catalogue(catalogue_b64: str, region: dict = None) -> str:
    img_data = base64.b64decode(catalogue_b64)
    image = Image.open(io.BytesIO(img_data))

    if region:
        left = region.get("left", 0)
        top = region.get("top", 0)
        right = region.get("right", image.width)
        bottom = region.get("bottom", image.height)
        image = image.crop((left, top, right, bottom))

    w, h = image.size
    target_ratio = 4 / 3
    current_ratio = w / h

    if current_ratio > target_ratio:
        new_w = int(h * target_ratio)
        left = (w - new_w) // 2
        image = image.crop((left, 0, left + new_w, h))
    else:
        new_h = int(w / target_ratio)
        top = (h - new_h) // 2
        image = image.crop((0, top, w, top + new_h))

    image = image.resize((768, 576), Image.LANCZOS)

    buffered = io.BytesIO()
    image.save(buffered, format="WEBP", quality=95)
    return base64.b64encode(buffered.getvalue()).decode("utf-8")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: generate_image.py <command> ..."}))
        sys.exit(1)

    command = sys.argv[1]

    if command == "generate":
        input_data = json.loads(sys.stdin.read())
        result = generate_product_image(
            input_data["image_b64"],
            input_data["name"],
            input_data.get("description", ""),
            input_data.get("colors", [])
        )
        print(json.dumps(result))

    elif command == "crop":
        input_data = json.loads(sys.stdin.read())
        result = crop_product_from_catalogue(
            input_data["catalogue_b64"],
            input_data.get("region")
        )
        print(json.dumps({"cropped_b64": result}))

    else:
        print(json.dumps({"error": f"Unknown command: {command}"}))
        sys.exit(1)
