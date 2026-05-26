"""
World-class background removal pipeline for white/cream pet against white background.

Pipeline:
  1. Semantic segmentation + alpha matting (ISNet + KNN via rembg)
  2. Trimap visualization & stats
  3. Guided-filter alpha refinement (custom implementation)
  4. Texture-entropy bias for fur/hair transition zones
  5. Foreground colour decontamination (FBA-style)
  6. PNG-32 export + black-bg and checker-bg validation composites

NOTE on CF/KNN matting for white-on-white:
  Closed-Form matting fails when subject & background share near-identical
  chrominance. rembg's internal alpha_matting=True uses KNN matting with
  spatial priors, which is more robust for this case. We run that for the
  matting step and add guided-filter + decontamination on top.
"""

import sys, os
sys.stdout.reconfigure(encoding='utf-8')

import numpy as np
from PIL import Image, ImageDraw
import cv2
from scipy.ndimage import binary_dilation, binary_erosion, uniform_filter, distance_transform_edt

SEP = "=" * 60

INPUT_PATH  = r"D:\bgremove-app\new_dog.jpg"
OUT_DIR     = r"D:\bgremove-app\output"
OUT_ALPHA   = os.path.join(OUT_DIR, "dog_nobg.png")
OUT_VALID_BLACK  = os.path.join(OUT_DIR, "dog_black_composite.png")
OUT_VALID_CHECK  = os.path.join(OUT_DIR, "dog_checker_composite.png")
OUT_TRIMAP  = os.path.join(OUT_DIR, "dog_trimap.png")
OUT_COARSE  = os.path.join(OUT_DIR, "dog_coarse_alpha.png")

GUIDED_RADIUS = 10
GUIDED_EPS    = 1e-3

os.makedirs(OUT_DIR, exist_ok=True)

# ==============================================================================
# STEP 1 -- SEMANTIC SEGMENTATION + ALPHA MATTING (ISNet + KNN via rembg)
# ==============================================================================
print(SEP)
print("STEP 1: Segmentation + alpha matting (ISNet + KNN @ full res)")
print(SEP)

from rembg import remove, new_session

session = new_session("isnet-general-use")

img_pil = Image.open(INPUT_PATH).convert("RGB")
W, H    = img_pil.size
img_np  = np.array(img_pil).astype(np.float32) / 255.0
print(f"  Input: {W}x{H} px")

# First pass: get the ISNet coarse mask (no matting)
coarse_rgba  = remove(img_pil, session=session,
                      alpha_matting=False,
                      only_mask=False,
                      post_process_mask=False)
coarse_alpha = np.array(coarse_rgba)[:, :, 3].astype(np.float32) / 255.0
Image.fromarray((coarse_alpha * 255).astype(np.uint8)).save(OUT_COARSE)
print(f"  Coarse alpha range: [{coarse_alpha.min():.3f}, {coarse_alpha.max():.3f}]")
print(f"  Foreground coverage (>0.5): {(coarse_alpha > 0.5).mean()*100:.1f}%")

# Second pass: rembg with KNN alpha matting
# alpha_matting_foreground_threshold / background_threshold control trimap
print("  Running KNN alpha matting pass...")
matted_rgba  = remove(img_pil, session=session,
                      alpha_matting=True,
                      alpha_matting_foreground_threshold=240,
                      alpha_matting_background_threshold=15,
                      alpha_matting_erode_size=12,
                      only_mask=False,
                      post_process_mask=False)
knn_alpha    = np.array(matted_rgba)[:, :, 3].astype(np.float32) / 255.0
print(f"  KNN alpha range: [{knn_alpha.min():.3f}, {knn_alpha.max():.3f}]")
print(f"  KNN FG coverage (>0.5): {(knn_alpha > 0.5).mean()*100:.1f}%")

# ==============================================================================
# STEP 2 -- TRIMAP VISUALIZATION (informational)
# ==============================================================================
print()
print(SEP)
print("STEP 2: Trimap generation (from coarse ISNet mask)")
print(SEP)

FG_THRESH = 0.92
BG_THRESH = 0.08
EXPAND    = 26      # px -- wide for fur

fg_mask = coarse_alpha >= FG_THRESH
bg_mask = coarse_alpha <= BG_THRESH

struct     = np.ones((EXPAND * 2 + 1, EXPAND * 2 + 1), dtype=bool)
dilated_fg = binary_dilation(fg_mask, structure=struct)
eroded_bg  = binary_erosion(~bg_mask, structure=struct)
unknown    = dilated_fg & ~eroded_bg

trimap = np.zeros((H, W), dtype=np.uint8)
trimap[bg_mask] = 0
trimap[unknown] = 128
trimap[fg_mask] = 255

print(f"  Definite FG : {(trimap==255).mean()*100:.1f}%")
print(f"  Unknown     : {(trimap==128).mean()*100:.1f}%")
print(f"  Definite BG : {(trimap==0  ).mean()*100:.1f}%")
Image.fromarray(trimap).save(OUT_TRIMAP)
print(f"  Trimap saved -> {OUT_TRIMAP}")

# ==============================================================================
# STEP 3 -- GUIDED FILTER ALPHA REFINEMENT
# ==============================================================================
print()
print(SEP)
print("STEP 3: Alpha refinement (guided image filter)")
print(SEP)

def guided_filter(guide, src, r, eps):
    """
    Fast guided image filter.
    guide : H x W x 3  float32  (RGB, [0,1])
    src   : H x W      float32  (alpha, [0,1])
    Returns refined alpha H x W float32.
    """
    h, w  = src.shape
    ks    = (2*r+1, 2*r+1)
    ones  = np.ones((h, w), dtype=np.float32)

    # pixel count per window (handles borders correctly)
    N = cv2.boxFilter(ones, ddepth=-1, ksize=ks, normalize=False)

    def box(x):
        return cv2.boxFilter(x, ddepth=-1, ksize=ks, normalize=False)

    mean_I = box(guide) / N[:, :, None]        # H x W x 3
    mean_p = box(src)   / N                    # H x W
    mean_Ip = box(guide * src[:, :, None]) / N[:, :, None]   # H x W x 3

    cov_Ip = mean_Ip - mean_I * mean_p[:, :, None]            # H x W x 3

    mean_II = box(guide * guide) / N[:, :, None]              # H x W x 3
    var_I   = mean_II - mean_I * mean_I                        # H x W x 3

    # Per-channel linear coefficients
    a = cov_Ip / (var_I + eps)                                 # H x W x 3
    b = mean_p[:, :, None] - a * mean_I                       # H x W x 3

    mean_a = box(a) / N[:, :, None]                            # H x W x 3
    mean_b = box(b) / N[:, :, None]                            # H x W x 3

    # Output: average over channels for robustness
    q = (mean_a * guide + mean_b).mean(axis=2)                # H x W
    return np.clip(q, 0.0, 1.0).astype(np.float32)


alpha_guided = guided_filter(img_np, knn_alpha, GUIDED_RADIUS, GUIDED_EPS)
print(f"  Guided alpha range: [{alpha_guided.min():.4f}, {alpha_guided.max():.4f}]")
print(f"  Guided FG coverage (>0.5): {(alpha_guided > 0.5).mean()*100:.1f}%")

# ==============================================================================
# STEP 4 -- TEXTURE-ENTROPY BIAS (fur/hair in transition zone)
# ==============================================================================
print()
print(SEP)
print("STEP 4: Texture-entropy bias for fur/hair")
print(SEP)

transition = (alpha_guided > 0.05) & (alpha_guided < 0.95)
print(f"  Transition pixels: {transition.sum():,} ({transition.mean()*100:.2f}%)")

# Local variance as texture proxy (high variance = fur texture = more likely FG)
grey_n     = cv2.cvtColor((img_np * 255).astype(np.uint8),
                          cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
local_mean = uniform_filter(grey_n, size=9)
local_sq   = uniform_filter(grey_n**2, size=9)
local_var  = np.clip(local_sq - local_mean**2, 0, None)
texture_w  = np.sqrt(local_var)
texture_w /= (texture_w.max() + 1e-8)                         # normalised [0,1]

alpha_refined = alpha_guided.copy()
if transition.sum() > 0:
    bias = 0.15 * texture_w[transition] * (1.0 - alpha_guided[transition])
    alpha_refined[transition] += bias
    alpha_refined = np.clip(alpha_refined, 0.0, 1.0)
    print(f"  Mean texture bias applied: {bias.mean():.4f}")
else:
    print("  No transition zone found -- skipping texture bias.")

# ==============================================================================
# STEP 5 -- FOREGROUND COLOUR DECONTAMINATION (FBA-style)
# ==============================================================================
print()
print(SEP)
print("STEP 5: Foreground colour decontamination")
print(SEP)

border = 15
b_pixels = np.concatenate([
    img_np[:border,  :].reshape(-1, 3),
    img_np[-border:, :].reshape(-1, 3),
    img_np[:, :border].reshape(-1, 3),
    img_np[:, -border:].reshape(-1, 3),
])
bg_est = b_pixels.mean(axis=0)
print(f"  Estimated BG: R={bg_est[0]*255:.1f} G={bg_est[1]*255:.1f} B={bg_est[2]*255:.1f}")

a3         = alpha_refined[:, :, None]
safe_a     = np.where(a3 < 1e-5, 1e-5, a3)
fg_clean   = (img_np - (1.0 - a3) * bg_est) / safe_a
fg_clean   = np.clip(fg_clean, 0.0, 1.0).astype(np.float32)
print("  Decontamination complete.")

# ==============================================================================
# STEP 5b -- ALPHA EDGE CHOKE (suppress outer fringe on white-on-white)
# ==============================================================================
# For white subjects against white BG, the outermost ~2px of the alpha ramp
# carries strongly contaminated colour. Choke (erode) the alpha slightly by
# darkening it near the FG→BG transition, reducing halo width.

print()
print(SEP)
print("STEP 5b: Alpha edge choke (anti-halo, white-on-white special case)")
print(SEP)

# Distance from definite-BG: pixels close to BG boundary get attenuated
bg_binary     = alpha_refined < 0.05
dist_from_bg  = distance_transform_edt(~bg_binary).astype(np.float32)

# Sigmoid choke: pixels within 3px of BG are pulled toward 0
choke_radius  = 3.0
choke_strength = 0.5   # how aggressively to push edge alpha down
choke_factor  = np.where(
    dist_from_bg < choke_radius,
    1.0 - choke_strength * np.exp(-dist_from_bg / (choke_radius * 0.5)),
    1.0
)
alpha_choked  = np.clip(alpha_refined * choke_factor, 0.0, 1.0).astype(np.float32)

# Re-run decontamination with choked alpha
a3c        = alpha_choked[:, :, None]
safe_ac    = np.where(a3c < 1e-5, 1e-5, a3c)
fg_final   = (img_np - (1.0 - a3c) * bg_est) / safe_ac
fg_final   = np.clip(fg_final, 0.0, 1.0).astype(np.float32)

# Measure halo reduction
halo_before = (alpha_refined[(dist_from_bg < choke_radius) & (alpha_refined > 0.05)]).mean()
halo_after  = (alpha_choked [(dist_from_bg < choke_radius) & (alpha_choked  > 0.05)]).mean()
print(f"  Choke radius: {choke_radius}px, strength: {choke_strength}")
print(f"  Edge alpha mean before choke: {halo_before:.3f}")
print(f"  Edge alpha mean after choke : {halo_after:.3f}")

# Use choked alpha + final FG for export
alpha_export = alpha_choked
fg_export    = fg_final
a3_export    = a3c

# ==============================================================================
# STEP 6 -- EXPORT + VALIDATION
# ==============================================================================
print()
print(SEP)
print("STEP 6: Export & validation composites")
print(SEP)

alpha_u8 = (alpha_export * 255).astype(np.uint8)
fg_u8    = (fg_export   * 255).astype(np.uint8)

rgba_arr = np.dstack([fg_u8, alpha_u8])
out_img  = Image.fromarray(rgba_arr, mode="RGBA")
out_img.save(OUT_ALPHA, format="PNG")
print(f"  PNG-32 saved -> {OUT_ALPHA}")

# Black background validation
black_bg  = np.zeros((H, W, 3), dtype=np.float32)
comp_b    = fg_export * a3_export + black_bg * (1.0 - a3_export)
Image.fromarray((comp_b * 255).astype(np.uint8)).save(OUT_VALID_BLACK)
print(f"  Black composite -> {OUT_VALID_BLACK}")

# Checker-board background validation (reveals halo artifacts clearly)
tile  = 32
check = np.zeros((H, W, 3), dtype=np.float32)
for y in range(0, H, tile):
    for x in range(0, W, tile):
        if ((y // tile) + (x // tile)) % 2 == 0:
            check[y:y+tile, x:x+tile] = 0.8   # light grey
        else:
            check[y:y+tile, x:x+tile] = 0.4   # dark grey
comp_c = fg_export * a3_export + check * (1.0 - a3_export)
Image.fromarray((comp_c * 255).astype(np.uint8)).save(OUT_VALID_CHECK)
print(f"  Checker composite -> {OUT_VALID_CHECK}")

# Quality metrics
binary_fg   = alpha_export > 0.5
eroded_core = binary_erosion(binary_fg, np.ones((3, 3), dtype=bool))
edge_px     = binary_fg ^ eroded_core
n_edge      = edge_px.sum()

dist_edge   = distance_transform_edt(~edge_px)
within_2    = (dist_edge <= 2) & ((alpha_export > 0.05) & (alpha_export < 0.95))
fringe_ratio = within_2.sum() / (n_edge + 1)

core_mean = alpha_export[alpha_export > 0.95].mean() if (alpha_export > 0.95).any() else float('nan')
bg_leak   = (alpha_export[trimap == 0] > 0.02).mean() * 100

print()
print("  -- Quality Report --")
print(f"  Edge pixels           : {n_edge:,}")
print(f"  Transition zone       : {transition.mean()*100:.2f}%")
print(f"  Fringe ratio (<=2px)  : {fringe_ratio:.3f}  (target < 1.5)")
print(f"  Alpha mean (FG core)  : {core_mean:.4f}  (target ~1.0)")
print(f"  BG leakage            : {bg_leak:.2f}%  (target ~0%)")
print()
print("Pipeline complete.")
print(f"\nOutputs:")
print(f"  {OUT_ALPHA}")
print(f"  {OUT_VALID_BLACK}")
print(f"  {OUT_VALID_CHECK}")
print(f"  {OUT_TRIMAP}")
