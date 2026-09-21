import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { MenuPdfService } from './menu-pdf.service';

// A tiny in-memory Prisma double so we can construct the service without a
// live DB — `build()` never touches prisma, but the constructor asks for it.
const stubPrisma = { business: { update: jest.fn() } } as unknown as never;
const stubConfig = { uploadDir: '/tmp', apiPublicUrl: 'http://localhost:4000' } as unknown as never;

/** A 40×60 solid-red portrait JPEG built with sharp so the buffer is real. */
async function tinyJpeg(width = 40, height = 60): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 220, g: 40, b: 40 },
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

function multerFileOf(buffer: Buffer, name = 'menu.jpg', mimetype = 'image/jpeg'): Express.Multer.File {
  return {
    fieldname: 'images',
    originalname: name,
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    buffer,
    stream: null as unknown as never,
    destination: '',
    filename: name,
    path: '',
  };
}

describe('MenuPdfService.build', () => {
  const service = new MenuPdfService(stubPrisma, stubConfig);

  it('produces a valid PDF with one page per image', async () => {
    const files = [
      multerFileOf(await tinyJpeg(40, 60)),
      multerFileOf(await tinyJpeg(80, 40)),
      multerFileOf(await tinyJpeg(50, 50)),
    ];
    const pdf = await service.build(files);

    // A real PDF always starts with the %PDF- magic.
    expect(pdf.slice(0, 5).toString('utf8')).toBe('%PDF-');
    // pdf-lib appends "%%EOF" as the final marker.
    expect(pdf.slice(-6).toString('utf8')).toMatch(/%%EOF\s*$/);
    // Round-trip through pdf-lib so we count pages inside the compressed
    // xref rather than trying to grep the raw bytes.
    const parsed = await PDFDocument.load(pdf);
    expect(parsed.getPageCount()).toBe(files.length);
  });

  it('rejects an empty upload', async () => {
    await expect(service.build([])).rejects.toThrow(/at least one/);
  });

  it('rejects HEIC/HEIF with a helpful message', async () => {
    const file = multerFileOf(await tinyJpeg(), 'photo.heic', 'image/heic');
    await expect(service.build([file])).rejects.toThrow(/HEIC|Most Compatible/i);
  });

  it('rejects unsupported mime types', async () => {
    const file = multerFileOf(Buffer.from('%PDF-'), 'menu.pdf', 'application/pdf');
    await expect(service.build([file])).rejects.toThrow(/JPEG, PNG or WebP/);
  });

  it('rejects a single file that is bigger than 10 MB', async () => {
    const bogus = multerFileOf(await tinyJpeg(), 'huge.jpg', 'image/jpeg');
    // Lie about the size — the validator trusts multer's `size` field.
    (bogus as { size: number }).size = 11 * 1024 * 1024;
    await expect(service.build([bogus])).rejects.toThrow(/under 10 MB/);
  });

  it('rejects more than 20 files up front', async () => {
    const one = multerFileOf(await tinyJpeg());
    const many = Array.from({ length: 21 }, () => one);
    await expect(service.build(many)).rejects.toThrow(/Up to 20 images/);
  });
});
