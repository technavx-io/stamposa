import { PNG } from 'pngjs';

/**
 * Renders the stamp progress as a PNG banner — a row of "stamps", filled for
 * collected and outlined for remaining, on the merchant's brand colour. This
 * is what makes the wallet pass read as a real punch card rather than a flat
 * rectangle: it becomes the Apple strip image and the Google hero image, and
 * it is regenerated on every stamp so it stays in sync.
 *
 * Pure pixel work with pngjs — deliberately no native image library, so it is
 * bulletproof on a constrained box. Circles are anti-aliased by coverage
 * (per-pixel distance to the edge), which is enough for clean discs at these
 * sizes without the cost of supersampling.
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}

function parseHex(hex: string): RGB {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Perceived luminance, to decide whether stamps read better as white or dark. */
function isLight({ r, g, b }: RGB): boolean {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6;
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
}

export function renderStampCard(opts: StampCardOptions): Buffer {
  const { width: W, height: H } = opts;
  const brand = parseHex(opts.brandColorHex || '#4F46E5');
  const light = isLight(brand);
  // Ink is the colour the stamps are drawn in: white on dark brands, near-black
  // on light brands, so they always have contrast against the background.
  const ink: RGB = light ? { r: 17, g: 24, b: 39 } : { r: 255, g: 255, b: 255 };

  const png = new PNG({ width: W, height: H });
  const buf = png.data;

  // Fill the background with a subtle vertical brand gradient for depth.
  const top = mix(brand, { r: 255, g: 255, b: 255 }, 0.06);
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

  // Lay the stamps out in up to two rows so a 10-stamp card still breathes.
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

  const blend = (x: number, y: number, c: RGB, alpha: number) => {
    if (x < 0 || x >= W || y < 0 || y >= H || alpha <= 0) return;
    const i = (y * W + x) << 2;
    const a = Math.min(1, alpha);
    buf[i] = Math.round(buf[i] * (1 - a) + c.r * a);
    buf[i + 1] = Math.round(buf[i + 1] * (1 - a) + c.g * a);
    buf[i + 2] = Math.round(buf[i + 2] * (1 - a) + c.b * a);
  };

  // A stamp: a filled disc when collected, a ring when still to come.
  const drawStamp = (cx: number, cy: number, filled: boolean) => {
    const r = radius;
    const ring = Math.max(2, r * 0.14); // ring thickness for empty stamps
    const x0 = Math.floor(cx - r - 2);
    const x1 = Math.ceil(cx + r + 2);
    const y0 = Math.floor(cy - r - 2);
    const y1 = Math.ceil(cy + r + 2);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (filled) {
          // solid disc, 1px feathered edge
          const cov = Math.max(0, Math.min(1, r - d + 0.5));
          if (cov > 0) blend(x, y, ink, cov * (light ? 1 : 0.96));
        } else {
          // ring: covered between (r-ring) and r
          const outer = Math.max(0, Math.min(1, r - d + 0.5));
          const inner = Math.max(0, Math.min(1, d - (r - ring) + 0.5));
          const cov = Math.min(outer, inner);
          if (cov > 0) blend(x, y, ink, cov * 0.45);
        }
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
    drawStamp(cx, cy, n < collected);
  }

  return PNG.sync.write(png);
}
