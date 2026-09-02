import { readFileSync } from 'fs';
import { join } from 'path';

import { PNG } from 'pngjs';
import sharp from 'sharp';

/**
 * Renders the stamp progress as a PNG banner that mirrors the card the
 * merchant designed in the campaign wizard: their brand colour, and — when
 * they picked them — their stamp and reward emoji. It becomes the Apple strip
 * and the Google hero image, and is regenerated on every stamp so it stays in
 * sync.
 *
 * Filled stamps show the stamp emoji on a white disc (or a plain white disc
 * when no emoji is set); remaining stamps are rings; the final slot is the
 * reward, shown with the reward emoji. Pure pngjs — no native image library,
 * so it is safe on the constrained box. Emoji come from a bundled Twemoji set
 * (the presets merchants can choose); anything outside that set falls back to
 * a plain disc rather than failing.
 */

interface RGBA {
  width: number;
  height: number;
  data: Buffer; // RGBA
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Read an uploaded card image (/uploads/...) from disk for compositing. Returns
 * null if it's missing or escapes the uploads root — the renderer then falls
 * back to the gradient rather than failing.
 */
export function readUploadedImage(uploadDir: string, publicPath: string): Buffer | null {
  try {
    const rel = publicPath.replace(/^\/uploads\//, '');
    const abs = join(uploadDir, rel);
    // Defence in depth: never read outside the uploads root.
    if (!abs.startsWith(uploadDir)) return null;
    return readFileSync(abs);
  } catch {
    return null;
  }
}

const EMOJI_DIR = join(process.cwd(), 'assets', 'wallet', 'emoji');
const emojiCache = new Map<string, RGBA | null>();

/** Twemoji filename for an emoji: surrogate-decoded codepoints, FE0F stripped for non-ZWJ. */
function toCodePoint(str: string): string {
  const r: string[] = [];
  let p = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (p) {
      r.push((0x10000 + ((p - 0xd800) << 10) + (c - 0xdc00)).toString(16));
      p = 0;
    } else if (c >= 0xd800 && c <= 0xdbff) {
      p = c;
    } else {
      r.push(c.toString(16));
    }
  }
  let code = r.join('-');
  if (!str.includes('‍')) code = code.replace(/-fe0f\b/g, '');
  return code;
}

function loadEmoji(emoji: string | null): RGBA | null {
  if (!emoji) return null;
  const code = toCodePoint(emoji);
  if (emojiCache.has(code)) return emojiCache.get(code) ?? null;
  let img: RGBA | null = null;
  try {
    const png = PNG.sync.read(readFileSync(join(EMOJI_DIR, `${code}.png`)));
    img = { width: png.width, height: png.height, data: png.data };
  } catch {
    img = null; // not in the bundled preset set — caller falls back to a disc
  }
  emojiCache.set(code, img);
  return img;
}

function parseHex(hex: string): RGB {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

export interface StampCardOptions {
  stampCount: number;
  stampsRequired: number;
  brandColorHex: string;
  width: number;
  height: number;
  /** Emoji for filled stamps (from the merchant's card style); null = plain disc. */
  stampIcon?: string | null;
  /** Emoji for the reward slot; null = a highlighted disc. */
  rewardIcon?: string | null;
}

export function renderStampCard(opts: StampCardOptions): Buffer {
  const png = new PNG({ width: opts.width, height: opts.height });
  fillGradient(png, parseHex(opts.brandColorHex || '#4F46E5'));
  drawStamps(png, opts);
  return PNG.sync.write(png);
}

/**
 * The async variant used in production: same stamp card, but when the merchant
 * set a background image it is decoded (any of PNG/JPEG/WebP via sharp),
 * cover-fit to the banner, and tinted or scrimmed for legibility before the
 * stamps are drawn on top — mirroring the in-app card. Falls back to the brand
 * gradient if there is no image or it can't be decoded, so a bad upload never
 * breaks the pass.
 */
export async function renderCardBanner(
  opts: StampCardOptions & { backgroundImage?: Buffer | null; imageTinted?: boolean },
): Promise<Buffer> {
  const png = new PNG({ width: opts.width, height: opts.height });
  const brand = parseHex(opts.brandColorHex || '#4F46E5');

  let painted = false;
  if (opts.backgroundImage) {
    try {
      const W = opts.width;
      const H = opts.height;
      const tinted = opts.imageTinted !== false;
      // Overlay: a brand wash when tinted (keeps the merchant's colour identity
      // over the photo), or a plain dark scrim otherwise — either way dark
      // enough that the white stamp discs stay legible.
      const overlay = tinted
        ? { r: brand.r, g: brand.g, b: brand.b, alpha: 0.5 }
        : { r: 0, g: 0, b: 0, alpha: 0.34 };
      const overlayPng = await sharp({
        create: { width: W, height: H, channels: 4, background: overlay },
      })
        .png()
        .toBuffer();
      const composed = await sharp(opts.backgroundImage)
        .resize(W, H, { fit: 'cover' })
        .composite([{ input: overlayPng, blend: 'over' }])
        .png()
        .toBuffer();
      const decoded = PNG.sync.read(composed);
      // decoded is exactly WxH RGBA — copy it in as the base.
      decoded.data.copy(png.data);
      painted = true;
    } catch {
      painted = false; // fall through to the gradient
    }
  }
  if (!painted) fillGradient(png, brand);
  drawStamps(png, opts);
  return PNG.sync.write(png);
}

/** Fill a fresh PNG with the brand gradient background. */
function fillGradient(png: PNG, brand: RGB): void {
  const W = png.width;
  const H = png.height;
  const buf = png.data;
  const white: RGB = { r: 255, g: 255, b: 255 };
  const top = mix(brand, white, 0.06);
  const bottom = mix(brand, { r: 0, g: 0, b: 0 }, 0.08);
  for (let y = 0; y < H; y++) {
    const row = mix(top, bottom, y / H);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) << 2;
      buf[i] = row.r;
      buf[i + 1] = row.g;
      buf[i + 2] = row.b;
      buf[i + 3] = 255;
    }
  }
}

/** Draw the stamp row(s) onto a PNG that already has its background. */
function drawStamps(png: PNG, opts: StampCardOptions): void {
  const W = png.width;
  const H = png.height;
  const buf = png.data;
  const white: RGB = { r: 255, g: 255, b: 255 };
  const amber: RGB = { r: 251, g: 191, b: 36 };

  const total = Math.max(1, opts.stampsRequired);
  const collected = Math.max(0, Math.min(total, opts.stampCount));
  const perRow = total <= 6 ? total : Math.ceil(total / 2);
  const rows = Math.ceil(total / perRow);

  const padX = Math.round(W * 0.06);
  const usableW = W - padX * 2;
  const cell = usableW / perRow;
  const radius = Math.min(cell, H / rows) * 0.32;
  const rowGap = rows > 1 ? radius * 2.4 : 0;
  const firstRowCy = H / 2 - ((rows - 1) * rowGap) / 2;

  const stampEmoji = loadEmoji(opts.stampIcon ?? null);
  const rewardEmoji = loadEmoji(opts.rewardIcon ?? null);

  const blend = (x: number, y: number, c: RGB, alpha: number) => {
    if (x < 0 || x >= W || y < 0 || y >= H || alpha <= 0) return;
    const i = (y * W + x) << 2;
    const a = Math.min(1, alpha);
    buf[i] = Math.round(buf[i] * (1 - a) + c.r * a);
    buf[i + 1] = Math.round(buf[i + 1] * (1 - a) + c.g * a);
    buf[i + 2] = Math.round(buf[i + 2] * (1 - a) + c.b * a);
  };

  const disc = (cx: number, cy: number, r: number, c: RGB, alpha = 1) => {
    for (let y = Math.floor(cy - r - 2); y <= Math.ceil(cy + r + 2); y++) {
      for (let x = Math.floor(cx - r - 2); x <= Math.ceil(cx + r + 2); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        const cov = Math.max(0, Math.min(1, r - d + 0.5));
        if (cov > 0) blend(x, y, c, cov * alpha);
      }
    }
  };

  const ring = (cx: number, cy: number, r: number, c: RGB, alpha: number) => {
    const w = Math.max(2, r * 0.14);
    for (let y = Math.floor(cy - r - 2); y <= Math.ceil(cy + r + 2); y++) {
      for (let x = Math.floor(cx - r - 2); x <= Math.ceil(cx + r + 2); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        const outer = Math.max(0, Math.min(1, r - d + 0.5));
        const inner = Math.max(0, Math.min(1, d - (r - w) + 0.5));
        const cov = Math.min(outer, inner);
        if (cov > 0) blend(x, y, c, cov * alpha);
      }
    }
  };

  const drawEmoji = (img: RGBA, cx: number, cy: number, dsize: number, globalAlpha = 1) => {
    const x0 = Math.round(cx - dsize / 2);
    const y0 = Math.round(cy - dsize / 2);
    for (let dy = 0; dy < dsize; dy++) {
      const sy = ((dy + 0.5) / dsize) * img.height - 0.5;
      const y1 = Math.max(0, Math.min(img.height - 1, Math.floor(sy)));
      const y2 = Math.min(img.height - 1, y1 + 1);
      const fy = sy - y1;
      for (let dx = 0; dx < dsize; dx++) {
        const sx = ((dx + 0.5) / dsize) * img.width - 0.5;
        const x1 = Math.max(0, Math.min(img.width - 1, Math.floor(sx)));
        const x2 = Math.min(img.width - 1, x1 + 1);
        const fx = sx - x1;
        const sample = (ch: number) => {
          const i11 = (y1 * img.width + x1) * 4 + ch;
          const i12 = (y1 * img.width + x2) * 4 + ch;
          const i21 = (y2 * img.width + x1) * 4 + ch;
          const i22 = (y2 * img.width + x2) * 4 + ch;
          const a = img.data[i11] * (1 - fx) + img.data[i12] * fx;
          const b = img.data[i21] * (1 - fx) + img.data[i22] * fx;
          return a * (1 - fy) + b * fy;
        };
        const alpha = (sample(3) / 255) * globalAlpha;
        if (alpha <= 0) continue;
        blend(x0 + dx, y0 + dy, { r: sample(0), g: sample(1), b: sample(2) }, alpha);
      }
    }
  };

  for (let n = 0; n < total; n++) {
    const row = Math.floor(n / perRow);
    const col = n % perRow;
    const countThisRow = Math.min(perRow, total - row * perRow);
    const rowW = countThisRow * cell;
    const startX = padX + (usableW - rowW) / 2 + cell / 2;
    const cx = startX + col * cell;
    const cy = firstRowCy + row * rowGap;
    const filled = n < collected;
    const isReward = n === total - 1;

    if (isReward) {
      if (filled) disc(cx, cy, radius, white, 1);
      else ring(cx, cy, radius, amber, 0.85);
      if (rewardEmoji) drawEmoji(rewardEmoji, cx, cy, radius * 1.5, filled ? 1 : 0.85);
      else if (!filled) disc(cx, cy, radius * 0.5, amber, 0.9);
    } else if (filled) {
      disc(cx, cy, radius, white, 1);
      if (stampEmoji) drawEmoji(stampEmoji, cx, cy, radius * 1.5, 1);
    } else {
      ring(cx, cy, radius, white, 0.45);
    }
  }
}
