import { Injectable } from '@nestjs/common';
import QRCode from 'qrcode';

const DARK = '#18181b';
const LIGHT = '#ffffff';

@Injectable()
export class QrService {
  /** PNG data URL for inline display. */
  toDataUrl(text: string, size = 512): Promise<string> {
    return QRCode.toDataURL(text, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: DARK, light: LIGHT },
    });
  }

  /** PNG buffer for downloads/printing. */
  toPngBuffer(text: string, size = 1024): Promise<Buffer> {
    return QRCode.toBuffer(text, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: DARK, light: LIGHT },
    });
  }
}
