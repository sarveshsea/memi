#!/usr/bin/env python3
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "product-hunt-assets"
CAPTURES = OUT / "source-captures-v2"
BACKDROPS = OUT / "source-backdrops"
STUDIO_REPO = ROOT.parent / "memi-studio"

MASTER = (2540, 1520)
UPLOAD = (1270, 760)
ICON = STUDIO_REPO / "src-tauri" / "icons" / "ios" / "AppIcon-512@2x.png"

INK = (30, 24, 24)
MUTED = (92, 80, 80)
HAIRLINE = (232, 221, 216)
WHITE = (255, 252, 248)
CRANBERRY = (112, 26, 46)


def font(size: int, *, mono: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        Path("/System/Library/Fonts/SFNSMono.ttf") if mono else Path("/System/Library/Fonts/SFNS.ttf"),
        Path("/System/Library/Fonts/HelveticaNeue.ttc"),
        Path("/System/Library/Fonts/Helvetica.ttc"),
    ]
    for candidate in candidates:
        if candidate.exists():
            try:
                return ImageFont.truetype(str(candidate), size=size)
            except OSError:
                pass
    return ImageFont.load_default(size=size)


F = {
    "brand": font(38),
    "hero": font(118),
    "h1": font(76),
    "body": font(35),
    "small": font(24),
    "tiny": font(19),
}


def ensure() -> None:
    for subdir in ("masters", "upload-1270x760", "thumbnail"):
        (OUT / subdir).mkdir(parents=True, exist_ok=True)


def round_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def cover(img: Image.Image, size: tuple[int, int], bias: tuple[float, float] = (0.5, 0.5)) -> Image.Image:
    img = img.convert("RGB")
    src = img.width / img.height
    dst = size[0] / size[1]
    if src > dst:
        h = size[1]
        w = round(h * src)
    else:
        w = size[0]
        h = round(w / src)
    resized = img.resize((w, h), Image.Resampling.LANCZOS)
    x = round((w - size[0]) * bias[0])
    y = round((h - size[1]) * bias[1])
    return resized.crop((x, y, x + size[0], y + size[1]))


def contain(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    out = img.copy()
    out.thumbnail(size, Image.Resampling.LANCZOS)
    return out


def draw_wrapped(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, face: ImageFont.ImageFont, fill, width: int, spacing: int = 10) -> int:
    x, y = xy
    for paragraph in text.splitlines():
        words = paragraph.split()
        line = ""
        lines: list[str] = []
        for word in words:
            test = word if not line else f"{line} {word}"
            if draw.textlength(test, font=face) <= width:
                line = test
            else:
                if line:
                    lines.append(line)
                line = word
        if line:
            lines.append(line)
        for item in lines:
            draw.text((x, y), item, font=face, fill=fill)
            y = draw.textbbox((x, y), item, font=face)[3] + spacing
        y += spacing
    return y


def build_thumbnail() -> None:
    src = Image.open(ICON).convert("RGBA").resize((1024, 1024), Image.Resampling.LANCZOS)
    src.save(OUT / "thumbnail" / "memi-thumbnail-1024.png")
    src.resize((512, 512), Image.Resampling.LANCZOS).save(OUT / "thumbnail" / "memi-thumbnail-512.png")
    src.resize((240, 240), Image.Resampling.LANCZOS).save(OUT / "thumbnail" / "memi-thumbnail-240.png")


def backdrop(index: int) -> Image.Image:
    files = [
        "backdrop-01-hero.png",
        "backdrop-02-workbench.png",
        "backdrop-03-design-context.png",
        "backdrop-04-receipts-artifacts.png",
    ]
    image = cover(Image.open(BACKDROPS / files[index - 1]), MASTER, bias=(0.5, 0.5)).convert("RGBA")
    image = image.filter(ImageFilter.GaussianBlur(10))
    veil = Image.new("RGBA", MASTER, (255, 250, 246, 190))
    image.alpha_composite(veil)
    wash = Image.new("RGBA", MASTER, (255, 255, 255, 0))
    draw = ImageDraw.Draw(wash)
    draw.rectangle((0, 0, 980, MASTER[1]), fill=(255, 252, 248, 150))
    draw.rectangle((0, 0, MASTER[0], 220), fill=(255, 252, 248, 90))
    image.alpha_composite(wash)
    return image


def paste_icon(canvas: Image.Image, xy: tuple[int, int], size: int = 58) -> None:
    icon = Image.open(OUT / "thumbnail" / "memi-thumbnail-1024.png").convert("RGBA")
    icon = icon.resize((size, size), Image.Resampling.LANCZOS)
    canvas.alpha_composite(icon, xy)
    draw = ImageDraw.Draw(canvas)
    draw.text((xy[0] + size + 18, xy[1] + 6), "memi", font=F["brand"], fill=INK)


def screenshot_crop(path: str, box: tuple[int, int, int, int]) -> Image.Image:
    return Image.open(CAPTURES / path).convert("RGB").crop(box)


def shadow(canvas: Image.Image, box: tuple[int, int, int, int], radius: int = 32) -> None:
    x1, y1, x2, y2 = box
    layer = Image.new("RGBA", MASTER, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.rounded_rectangle((x1, y1 + 32, x2, y2 + 32), radius=radius, fill=(40, 14, 20, 95))
    layer = layer.filter(ImageFilter.GaussianBlur(48))
    canvas.alpha_composite(layer)


def draw_window(canvas: Image.Image, crop: Image.Image, box: tuple[int, int, int, int], *, title: str) -> None:
    x1, y1, x2, y2 = box
    w, h = x2 - x1, y2 - y1
    chrome = 58
    shadow(canvas, box)
    window = Image.new("RGBA", (w, h), (12, 13, 14, 255))
    draw = ImageDraw.Draw(window)
    draw.rounded_rectangle((0, 0, w - 1, h - 1), radius=30, fill=(12, 13, 14, 255), outline=(255, 255, 255, 70), width=2)
    draw.rectangle((0, chrome, w, chrome + 1), fill=(255, 255, 255, 32))
    for i, color in enumerate(((255, 95, 87), (255, 189, 46), (40, 201, 64))):
        draw.ellipse((30 + i * 34, 21, 48 + i * 34, 39), fill=color)
    tw = draw.textlength(title, font=F["tiny"])
    draw.text(((w - tw) / 2, 18), title, font=F["tiny"], fill=(218, 220, 224))
    shot = cover(crop, (w - 28, h - chrome - 18), bias=(0.5, 0.5)).convert("RGBA")
    shot.putalpha(round_mask(shot.size, 14))
    window.alpha_composite(shot, (14, chrome + 8))
    window.putalpha(round_mask((w, h), 30))
    canvas.alpha_composite(window, (x1, y1))


def label(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str) -> int:
    x, y = xy
    width = round(draw.textlength(text, font=F["small"])) + 34
    draw.rounded_rectangle((x, y, x + width, y + 46), radius=23, fill=(255, 255, 255, 215), outline=(235, 222, 218), width=1)
    draw.text((x + 17, y + 11), text, font=F["small"], fill=INK)
    return x + width + 14


@dataclass(frozen=True)
class Slide:
    slug: str
    title: str
    body: str
    labels: tuple[str, ...]
    shot: Image.Image
    window_title: str
    window_box: tuple[int, int, int, int]
    headline: str = "h1"
    copy_xy: tuple[int, int, int] = (110, 300, 760)
    backdrop_index: int = 1


def compose(slide: Slide) -> Image.Image:
    canvas = backdrop(slide.backdrop_index)
    draw = ImageDraw.Draw(canvas)
    paste_icon(canvas, (96, 86), 62)
    x, y, width = slide.copy_xy
    bottom = draw_wrapped(draw, (x, y), slide.title, F[slide.headline], INK, width, spacing=10)
    bottom = draw_wrapped(draw, (x, bottom + 20), slide.body, F["body"], MUTED, width, spacing=12)
    lx = x
    for item in slide.labels:
        lx = label(draw, (lx, bottom + 22), item)
    draw_window(canvas, slide.shot, slide.window_box, title=slide.window_title)
    return canvas


def save(slide: Slide) -> None:
    image = compose(slide).convert("RGB")
    master = OUT / "masters" / f"{slide.slug}-master-2540x1520.png"
    upload = OUT / "upload-1270x760" / f"{slide.slug}-1270x760.png"
    image.save(master, optimize=True)
    image.resize(UPLOAD, Image.Resampling.LANCZOS).save(upload, optimize=True)


def build_contact_sheet(slides: list[Slide]) -> None:
    sheet = Image.new("RGB", (1200, 980), (248, 242, 238))
    draw = ImageDraw.Draw(sheet)
    spots = [(38, 58), (600, 58), (38, 472), (600, 472)]
    for slide, (x, y) in zip(slides, spots):
        img = Image.open(OUT / "upload-1270x760" / f"{slide.slug}-1270x760.png").convert("RGB")
        thumb = contain(img, (540, 324))
        sheet.paste(thumb, (x, y))
        draw.text((x, y + thumb.height + 14), slide.slug, font=F["small"], fill=INK)
    sheet.save(OUT / "contact-sheet.png", optimize=True)


def build_card_preview() -> None:
    canvas = backdrop(1)
    draw = ImageDraw.Draw(canvas)
    card = (400, 260, 2140, 1120)
    shadow(canvas, card, 36)
    draw.rounded_rectangle(card, radius=36, fill=(255, 255, 255, 236), outline=(255, 255, 255, 180), width=2)
    paste_icon(canvas, (500, 350), 74)
    draw.text((500, 505), "AI workbench for product designers", font=F["h1"], fill=INK)
    draw_wrapped(draw, (500, 608), "Run Codex or Claude Code with project memory, design-system context, receipts, and Figma/FigJam handoff.", F["body"], MUTED, 970)
    x = 500
    for item in ("Open source", "Signed macOS app", "Studio 1.0.4", "npm 1.1.1"):
        x = label(draw, (x, 792), item)
    icon = Image.open(OUT / "thumbnail" / "memi-thumbnail-1024.png").convert("RGBA").resize((278, 278), Image.Resampling.LANCZOS)
    canvas.alpha_composite(icon, (1718, 426))
    canvas.resize(UPLOAD, Image.Resampling.LANCZOS).convert("RGB").save(OUT / "memi-product-hunt-card-preview.png", optimize=True)


def main() -> None:
    ensure()
    build_thumbnail()
    full_app = screenshot_crop("studio-real-01-workbench.png", (0, 74, 3200, 1988))
    workbench = screenshot_crop("studio-real-01-workbench.png", (590, 74, 3190, 1988))
    memory = screenshot_crop("studio-real-tab-memory-filtered.png", (1880, 74, 3190, 790))
    changes = screenshot_crop("studio-real-tab-changes.png", (1880, 74, 3190, 520))

    slides = [
        Slide(
            slug="gallery-01-hero-social-preview",
            title="memi",
            body="AI workbench for product designers.\nRun Codex or Claude Code with project memory, design-system context, receipts, and Figma/FigJam handoff.",
            labels=("Open source", "Signed macOS app", "npm 1.1.1"),
            shot=full_app,
            window_title="memi Studio",
            window_box=(820, 250, 2340, 1240),
            headline="hero",
            copy_xy=(104, 330, 610),
            backdrop_index=1,
        ),
        Slide(
            slug="gallery-02-workbench",
            title="One clean workbench for design agents",
            body="Keep the run, prompt, workspace, harness state, and review controls visible in the same macOS app.",
            labels=("Codex", "Claude Code", "Workspace"),
            shot=workbench,
            window_title="memi Studio / Workbench",
            window_box=(760, 230, 2360, 1260),
            copy_xy=(104, 270, 560),
            backdrop_index=2,
        ),
        Slide(
            slug="gallery-03-design-context",
            title="Project memory stays beside the run",
            body="Specs, pages, components, references, and launch handoff notes stay searchable while agents work.",
            labels=("Memory", "Specs", "Research"),
            shot=memory,
            window_title="memi Studio / Memory",
            window_box=(760, 330, 2350, 1090),
            copy_xy=(104, 305, 560),
            backdrop_index=3,
        ),
        Slide(
            slug="gallery-04-receipts-artifacts",
            title="Design-system trace before handoff",
            body="Review run state, clean change traces, and handoff readiness before anything leaves the workspace.",
            labels=("Trace", "Review", "Handoff"),
            shot=changes,
            window_title="memi Studio / Trace",
            window_box=(760, 360, 2350, 980),
            copy_xy=(104, 305, 560),
            backdrop_index=4,
        ),
    ]
    for slide in slides:
        save(slide)
    build_contact_sheet(slides)
    build_card_preview()
    print("clean Product Hunt assets rendered")
    for path in sorted((OUT / "upload-1270x760").glob("*.png")):
        print(path)


if __name__ == "__main__":
    main()
