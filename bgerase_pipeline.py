"""
BgErase — Production Background Removal Pipeline using BiRefNet
================================================================
Fixed: uses torchvision transforms directly (no AutoProcessor needed).

Requirements:
    pip install torch torchvision transformers pillow opencv-python-headless

Usage:
    python test.py
"""

import cv2
import numpy as np
from PIL import Image
from pathlib import Path
import torch
import warnings
warnings.filterwarnings("ignore")

# ── Model singleton ──────────────────────────────────────────────────────────

_model  = None
_device = None

def _load_model():
    global _model, _device

    if _model is not None:
        return _model, _device

    from transformers import AutoModelForImageSegmentation

    print("[BgErase] Loading BiRefNet... (first run only, ~500MB download)")
    _device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[BgErase] Device: {_device}")

    _model = AutoModelForImageSegmentation.from_pretrained(
        "ZhengPeng7/BiRefNet",
        trust_remote_code=True,
        torch_dtype=torch.float16 if _device == "cuda" else torch.float32
    ).to(_device).eval()

    print("[BgErase] Model ready.")
    return _model, _device


# ── Preprocessing (replaces AutoProcessor) ──────────────────────────────────

def _preprocess(image_rgb: np.ndarray) -> torch.Tensor:
    """Resize to 1024x1024, normalize, return tensor."""
    from torchvision import transforms

    transform = transforms.Compose([
        transforms.Resize((1024, 1024)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                             std =[0.229, 0.224, 0.225]),
    ])
    pil = Image.fromarray(image_rgb)
    return transform(pil).unsqueeze(0)  # shape: (1, 3, 1024, 1024)


# ── Core inference ────────────────────────────────────────────────────────────

def _run_birefnet(image_rgb: np.ndarray) -> np.ndarray:
    """Returns float32 alpha mask [0,1] at original resolution."""
    model, device = _load_model()
    H, W = image_rgb.shape[:2]

    tensor = _preprocess(image_rgb).to(device)

    with torch.no_grad():
        preds = model(tensor)

    # BiRefNet returns a list of predictions; take the last (finest) one
    pred = preds[-1].squeeze().cpu()
    pred = torch.sigmoid(pred).numpy().astype(np.float32)

    # Resize back to original resolution
    alpha = cv2.resize(pred, (W, H), interpolation=cv2.INTER_LANCZOS4)
    return np.clip(alpha, 0.0, 1.0)


# ── Alpha refinement ──────────────────────────────────────────────────────────

def _refine_alpha(alpha_raw: np.ndarray, image_bgr: np.ndarray) -> np.ndarray:
    """Guided filter + sharpening for clean fur/hair edges."""
    alpha_8 = (alpha_raw * 255).astype(np.uint8)

    # Snap edges to actual fur boundaries using original image as guide
    alpha_guided = cv2.ximgproc.guidedFilter(
        guide=image_bgr,
        src=alpha_8,
        radius=6,
        eps=60
    )
    alpha_f = alpha_guided.astype(np.float32) / 255.0

    # Push high-confidence interior to full opacity, suppress near-zero noise
    alpha_f = np.where(alpha_f > 0.85, 1.0,
              np.where(alpha_f < 0.05, 0.0, alpha_f))

    return alpha_f.astype(np.float32)


# ── Public API ────────────────────────────────────────────────────────────────

def remove_background(
    input_path: str,
    output_path: str = None,
) -> Image.Image:
    """
    Remove background from a single image.

    Args:
        input_path:  Path to input image (JPG, PNG, etc.)
        output_path: Where to save the RGBA PNG. Optional.

    Returns:
        PIL Image in RGBA mode.
    """
    input_path = Path(input_path)
    if not input_path.exists():
        raise FileNotFoundError(f"Input not found: {input_path}")

    image_bgr = cv2.imread(str(input_path), cv2.IMREAD_COLOR)
    if image_bgr is None:
        raise ValueError(f"Could not read: {input_path}")

    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    H, W = image_bgr.shape[:2]

    alpha_raw    = _run_birefnet(image_rgb)
    alpha_final  = _refine_alpha(alpha_raw, image_bgr)
    a_out        = (np.clip(alpha_final, 0, 1) * 255).astype(np.uint8)

    # Use original photo pixels — zero black-bg contamination
    r, g, b = image_rgb[:,:,0], image_rgb[:,:,1], image_rgb[:,:,2]
    rgba    = np.stack([r, g, b, a_out], axis=2)
    result  = Image.fromarray(rgba, mode="RGBA")

    if output_path is not None:
        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        result.save(str(out), format="PNG")
        print(f"[BgErase] Saved → {out}")

    return result


def remove_background_batch(
    input_paths: list,
    output_dir: str,
    suffix: str = "_removed",
) -> list:
    """Batch process multiple images."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    _load_model()  # load once

    out_paths = []
    for i, path in enumerate(input_paths):
        path = Path(path)
        out  = output_dir / f"{path.stem}{suffix}.png"
        print(f"[BgErase] {i+1}/{len(input_paths)}: {path.name}")
        try:
            remove_background(str(path), str(out))
            out_paths.append(out)
        except Exception as e:
            print(f"[BgErase] ERROR: {e}")

    print(f"[BgErase] Done. {len(out_paths)}/{len(input_paths)} processed.")
    return out_paths


def handle_api_request(image_bytes: bytes) -> bytes:
    """
    For your Next.js / FastAPI route.
    Input: raw image bytes. Output: PNG bytes (RGBA).

    Usage:
        @app.post("/api/remove-bg")
        async def remove_bg(file: UploadFile):
            result_bytes = handle_api_request(await file.read())
            return Response(content=result_bytes, media_type="image/png")
    """
    import io
    nparr     = np.frombuffer(image_bytes, np.uint8)
    image_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)

    alpha    = _run_birefnet(image_rgb)
    alpha_f  = _refine_alpha(alpha, image_bgr)
    a_out    = (np.clip(alpha_f, 0, 1) * 255).astype(np.uint8)

    r, g, b = image_rgb[:,:,0], image_rgb[:,:,1], image_rgb[:,:,2]
    rgba    = np.stack([r, g, b, a_out], axis=2)
    result  = Image.fromarray(rgba, mode="RGBA")

    buf = io.BytesIO()
    result.save(buf, format="PNG")
    return buf.getvalue()


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="BgErase — BiRefNet")
    parser.add_argument("input",  help="Input image path")
    parser.add_argument("-o", "--output", default=None, help="Output PNG path")
    args = parser.parse_args()

    out = args.output or str(Path(args.input).stem) + "_removed.png"
    remove_background(args.input, out)
