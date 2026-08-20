import os
from PIL import Image, ImageDraw, ImageFont

W = H = 512
TOP = (11, 14, 20, 255)      # #0b0e14
BOT = (26, 34, 51, 255)      # #1a2233
CYAN = (34, 211, 238, 255)   # #22d3ee
GREEN = (52, 211, 153, 255)  # #34d399
BORDER = (34, 211, 238, 64)

def lerp(a, b, t):
    return int(a + (b - a) * t)

# 竖直流光背景
grad = Image.new("RGBA", (W, H))
px = grad.load()
for y in range(H):
    t = y / (H - 1)
    c = (lerp(TOP[0], BOT[0], t), lerp(TOP[1], BOT[1], t), lerp(TOP[2], BOT[2], t), 255)
    for x in range(W):
        px[x, y] = c

# 圆角遮罩，裁出圆角方块
mask = Image.new("L", (W, H), 0)
ImageDraw.Draw(mask).rounded_rectangle([12, 12, 500, 500], radius=116, fill=255)
logo = Image.new("RGBA", (W, H))
logo.paste(grad, (0, 0), mask)

d = ImageDraw.Draw(logo)
d.rounded_rectangle([12, 12, 500, 500], radius=116, outline=BORDER, width=3)

# 字体（优先粗体）
font = None
for fp in [r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\arial.ttf"]:
    if os.path.exists(fp):
        font = ImageFont.truetype(fp, 210)
        break
if font is None:
    font = ImageFont.load_default()

d.text((256, 226), "PL", font=font, fill=CYAN, anchor="mm")

# 绿色上升趋势线 + 端点
d.line([(116, 404), (256, 368), (392, 324)], fill=GREEN, width=18, joint="curve")
d.ellipse([372, 304, 412, 344], fill=GREEN)

out_dirs = [
    r"F:\Workbuddy 空间\2026-06-18-15-39-35\pl-budget-miniprogram",
    r"F:\Workbuddy 空间\2026-06-18-15-39-35",
]
for dd in out_dirs:
    png = os.path.join(dd, "PL表LOGO.png")
    svg = os.path.join(dd, "logo.svg") if dd.endswith("pl-budget-miniprogram") else os.path.join(dd, "PL表LOGO.svg")
    logo.save(png, "PNG")
    print("saved", png)
print("done")
