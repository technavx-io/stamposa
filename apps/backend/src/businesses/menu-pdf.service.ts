import { Injectable } from '@nestjs/common';
import { Business } from '@prisma/client';
import { mkdir, stat, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { badRequest } from '../common/exceptions';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Menu-PDF builder — takes 1..20 phone photos of a printed menu and turns
 * them into one PDF served from /uploads/menu/<businessId>.pdf. Every image
 * is downscaled (long edge 1600px, JPEG q82) so the resulting PDF stays
 * small enough to load on a mobile connection; embedded on its own A4 page
 * with a 20pt margin, orientation chosen to match the source aspect ratio.
 */

/** Hard limits — matched on the client for a fast reject, enforced here. */
export const MENU_MAX_FILES = 20;
export const MENU_MAX_PER_FILE_BYTES = 10 * 1024 * 1024;
export const MENU_MAX_TOTAL_BYTES = 40 * 1024 * 1024;

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const PAGE_MARGIN_PT = 20;
const MAX_LONG_EDGE_PX = 1600;
const JPEG_QUALITY = 82;

const ACCEPTED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const HEIC_MIMES = new Set(['image/heic', 'image/heif']);

const MENU_DIR = 'menu';
const publicPathFor = (businessId: string) => `/uploads/${MENU_DIR}/${businessId}.pdf`;

@Injectable()
export class MenuPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  /**
   * Validate the incoming files, or throw a helpful 400. The Multer file-
   * size limit already stops individual files > 10 MB before we get here,
   * but we re-check because the interceptor's `files` limit truncates
   * silently and the aggregate cap is only knowable here.
   */
  private validate(files: Express.Multer.File[]): void {
    if (!files.length) {
      throw badRequest('NO_IMAGES', 'Attach at least one photo to build a menu PDF.');
    }
    if (files.length > MENU_MAX_FILES) {
      throw badRequest(
        'TOO_MANY_IMAGES',
        `Up to ${MENU_MAX_FILES} images per menu — you sent ${files.length}.`,
      );
    }
    let total = 0;
    for (const file of files) {
      const mime = (file.mimetype ?? '').toLowerCase();
      if (HEIC_MIMES.has(mime)) {
        throw badRequest(
          'HEIC_NOT_SUPPORTED',
          'HEIC/HEIF photos aren’t supported. On iPhone: Settings → Camera → Formats → Most Compatible, then reshoot. Or upload JPEGs instead.',
        );
      }
      if (!ACCEPTED_MIMES.has(mime)) {
        throw badRequest(
          'UNSUPPORTED_FILE',
          'Each image must be a JPEG, PNG or WebP.',
        );
      }
      if (file.size > MENU_MAX_PER_FILE_BYTES) {
        throw badRequest(
          'IMAGE_TOO_LARGE',
          `Each image must be under 10 MB (“${file.originalname || 'image'}” is bigger).`,
        );
      }
      total += file.size;
    }
    if (total > MENU_MAX_TOTAL_BYTES) {
      throw badRequest(
        'IMAGES_TOO_LARGE',
        'Total upload must be under 40 MB. Try fewer or smaller photos.',
      );
    }
  }

  /**
   * Build a menu PDF buffer from the given image files. Pure (no I/O, no
   * DB) so unit tests can feed in a couple of in-line JPEGs and assert the
   * bytes. Each image becomes one A4 page, orientation chosen from its
   * aspect ratio, sized to fit inside a 20pt margin at the native ratio.
   */
  async build(files: Express.Multer.File[]): Promise<Buffer> {
    this.validate(files);
    const pdf = await PDFDocument.create();

    for (const file of files) {
      // Normalise to JPEG at 1600px long-edge so pdf-lib always sees a
      // predictable, compact input. `rotate()` reads EXIF orientation
      // (portrait phone shots often arrive rotated).
      const jpeg = await sharp(file.buffer, { failOn: 'none' })
        .rotate()
        .resize({
          width: MAX_LONG_EDGE_PX,
          height: MAX_LONG_EDGE_PX,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toBuffer();

      const embedded = await pdf.embedJpg(jpeg);
      const isPortrait = embedded.height >= embedded.width;
      const pageW = isPortrait ? A4_WIDTH_PT : A4_HEIGHT_PT;
      const pageH = isPortrait ? A4_HEIGHT_PT : A4_WIDTH_PT;
      const page = pdf.addPage([pageW, pageH]);

      const boxW = pageW - PAGE_MARGIN_PT * 2;
      const boxH = pageH - PAGE_MARGIN_PT * 2;
      const scale = Math.min(boxW / embedded.width, boxH / embedded.height);
      const drawW = embedded.width * scale;
      const drawH = embedded.height * scale;
      page.drawImage(embedded, {
        x: (pageW - drawW) / 2,
        y: (pageH - drawH) / 2,
        width: drawW,
        height: drawH,
      });
    }

    const bytes = await pdf.save();
    return Buffer.from(bytes);
  }

  /**
   * Build the PDF, write it to `${uploadDir}/menu/<businessId>.pdf` (over-
   * writing any previous one), and set Business.menuUrl to the cache-busted
   * public URL. The `?t=<mtime>` on the URL means a merchant who re-uploads
   * sees the new PDF right away without a hard refresh.
   */
  async buildAndStore(
    business: Business,
    files: Express.Multer.File[],
  ): Promise<{ menuUrl: string; business: Business }> {
    const buffer = await this.build(files);
    const dir = join(this.config.uploadDir, MENU_DIR);
    await mkdir(dir, { recursive: true });
    const absolute = join(dir, `${business.id}.pdf`);
    await writeFile(absolute, buffer);
    const mtime = Math.floor((await stat(absolute)).mtimeMs);
    const menuUrl = `${this.config.apiPublicUrl}${publicPathFor(business.id)}?t=${mtime}`;
    const updated = await this.prisma.business.update({
      where: { id: business.id },
      data: { menuUrl },
    });
    return { menuUrl, business: updated };
  }

  /**
   * Remove the stored PDF (best-effort) and clear Business.menuUrl. Called
   * from DELETE /menu-pdf, and also safe when no PDF was ever written.
   */
  async remove(business: Business): Promise<Business> {
    const absolute = join(this.config.uploadDir, MENU_DIR, `${business.id}.pdf`);
    try {
      await unlink(absolute);
    } catch {
      // Already gone — nothing to clean up.
    }
    return this.prisma.business.update({
      where: { id: business.id },
      data: { menuUrl: null },
    });
  }
}
