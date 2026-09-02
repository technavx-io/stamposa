import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { Business, Campaign, Customer, CustomerMembership, Redemption } from '@prisma/client';
import JSZip from 'jszip';
import forge from 'node-forge';
import { AppConfigService } from '../config/app-config.service';
import { renderCardBanner, readUploadedImage } from './stamp-card-image';
import { formatCode } from '../common/utils/codes.util';
import { resolveCardStyle } from '../loyalty/card-style.util';

export type PassMembership = CustomerMembership & {
  business: Business;
  campaign: Campaign;
  customer: Customer;
  redemptions: Redemption[];
};

/**
 * Builds and signs Apple Wallet (.pkpass) store cards.
 *
 * A pkpass is a ZIP of pass.json + images + manifest.json (SHA-1 of every
 * file) + signature (PKCS#7 detached signature of the manifest, made with
 * the Pass Type ID certificate and chained through Apple's WWDR CA).
 */
@Injectable()
export class ApplePassService {
  private readonly logger = new Logger(ApplePassService.name);
  private icons: Record<string, Buffer> | null = null;

  constructor(private readonly config: AppConfigService) {}

  get enabled(): boolean {
    return this.config.appleWallet !== null;
  }

  /** pass.json content for a membership — pure, unit-testable. */
  buildPassJson(m: PassMembership, authToken: string): Record<string, unknown> {
    const cfg = this.config.appleWallet;
    if (!cfg) throw new Error('Apple Wallet is not configured');
    const remaining = Math.max(0, m.campaign.stampsRequired - m.stampCount);
    const pending = m.redemptions.length;

    return {
      formatVersion: 1,
      passTypeIdentifier: cfg.passTypeId,
      teamIdentifier: cfg.teamId,
      serialNumber: m.id,
      webServiceURL: `${this.config.apiPublicUrl}/v1/wallet/apple`,
      authenticationToken: authToken,
      organizationName: m.business.name,
      description: `${m.business.name} loyalty card`,
      logoText: m.business.name,
      backgroundColor: hexToRgb(m.business.brandColor ?? '#4F46E5'),
      foregroundColor: 'rgb(255,255,255)',
      labelColor: 'rgb(255,255,255)',
      storeCard: {
        // The stamp progress is shown visually in the strip image (a row of
        // filled/empty stamps), so the count lives as a small header field in
        // the top corner rather than as a big number that would sit on top of
        // the strip.
        headerFields: [
          {
            key: 'stamps',
            label: 'STAMPS',
            value: `${m.stampCount}/${m.campaign.stampsRequired}`,
          },
        ],
        primaryFields: [],
        secondaryFields: [
          pending > 0
            ? {
                key: 'reward',
                label: 'REWARD READY',
                value:
                  pending === 1 ? m.redemptions[0].rewardText : `${pending} rewards waiting`,
              }
            : {
                key: 'reward',
                label: 'NEXT REWARD',
                value: `${remaining} more · ${m.campaign.reward}`,
              },
        ],
        auxiliaryFields: [
          { key: 'lifetime', label: 'LIFETIME', value: `${m.totalStamps} stamps` },
          { key: 'earned', label: 'REWARDS EARNED', value: `${m.completedCount}` },
        ],
        backFields: [
          { key: 'code', label: 'Customer code', value: formatCode(m.code) },
          {
            key: 'how',
            label: 'How it works',
            value: `Show this pass at the counter. Collect ${m.campaign.stampsRequired} stamps to earn: ${m.campaign.reward}.`,
          },
          ...(m.campaign.terms ? [{ key: 'terms', label: 'Terms', value: m.campaign.terms }] : []),
          ...(m.business.address
            ? [{ key: 'address', label: m.business.name, value: m.business.address }]
            : []),
        ],
      },
      barcode: {
        format: 'PKBarcodeFormatQR',
        message: formatCode(m.code),
        messageEncoding: 'iso-8859-1',
        altText: formatCode(m.code),
      },
      barcodes: [
        {
          format: 'PKBarcodeFormatQR',
          message: formatCode(m.code),
          messageEncoding: 'iso-8859-1',
          altText: formatCode(m.code),
        },
      ],
    };
  }

  /** The signed .pkpass bundle. */
  async buildPkpass(m: PassMembership, authToken: string): Promise<Buffer> {
    const files: Record<string, Buffer> = {
      'pass.json': Buffer.from(JSON.stringify(this.buildPassJson(m, authToken)), 'utf8'),
      ...this.iconAssets(),
      ...(await this.stripAssets(m)),
    };

    const manifest: Record<string, string> = {};
    for (const [name, buf] of Object.entries(files)) {
      manifest[name] = createHash('sha1').update(buf).digest('hex');
    }
    const manifestBuf = Buffer.from(JSON.stringify(manifest), 'utf8');

    const zip = new JSZip();
    for (const [name, buf] of Object.entries(files)) zip.file(name, buf);
    zip.file('manifest.json', manifestBuf);
    zip.file('signature', this.signManifest(manifestBuf));

    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }

  /** PKCS#7 detached signature over the manifest. */
  private signManifest(manifest: Buffer): Buffer {
    const cfg = this.config.appleWallet;
    if (!cfg) throw new Error('Apple Wallet is not configured');

    const certPem = readFileSync(cfg.certPath, 'utf8');
    const keyPem = readFileSync(cfg.keyPath, 'utf8');
    const wwdrPem = readFileSync(cfg.wwdrPath, 'utf8');

    const cert = forge.pki.certificateFromPem(certPem);
    const key = cfg.keyPassphrase
      ? forge.pki.decryptRsaPrivateKey(keyPem, cfg.keyPassphrase)
      : forge.pki.privateKeyFromPem(keyPem);
    const wwdr = forge.pki.certificateFromPem(wwdrPem);

    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(manifest.toString('binary'));
    p7.addCertificate(wwdr);
    p7.addCertificate(cert);
    p7.addSigner({
      key,
      certificate: cert,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        { type: forge.pki.oids.messageDigest },
        { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
      ],
    });
    p7.sign({ detached: true });

    return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), 'binary');
  }

  private iconAssets(): Record<string, Buffer> {
    if (!this.icons) {
      const dir = join(process.cwd(), 'assets', 'wallet');
      this.icons = {
        'icon.png': readFileSync(join(dir, 'icon.png')),
        'icon@2x.png': readFileSync(join(dir, 'icon@2x.png')),
        'icon@3x.png': readFileSync(join(dir, 'icon@3x.png')),
      };
      this.logger.log('Loaded wallet pass icon assets');
    }
    return this.icons;
  }

  /**
   * The strip image is the punch card: a row of stamps rendered for this
   * membership's current progress, in the merchant's brand colour. Regenerated
   * on every pass build (and the pass rebuilds on every stamp), so it always
   * matches the count. Apple picks @2x or @3x by device; both are provided.
   */
  private async stripAssets(m: PassMembership): Promise<Record<string, Buffer>> {
    const style = resolveCardStyle(m.campaign, m.business, this.config.apiPublicUrl);
    const backgroundImage = style.cardImagePath
      ? readUploadedImage(this.config.uploadDir, style.cardImagePath)
      : null;
    const args = {
      stampCount: m.stampCount,
      stampsRequired: m.campaign.stampsRequired,
      brandColorHex: style.color,
      stampIcon: style.stampIcon,
      rewardIcon: style.rewardIcon,
      backgroundImage,
      imageTinted: style.imageTinted,
    };
    // Apple store-card strip is 375x123pt; provide @1x/@2x/@3x.
    const [s1, s2, s3] = await Promise.all([
      renderCardBanner({ ...args, width: 375, height: 123 }),
      renderCardBanner({ ...args, width: 750, height: 246 }),
      renderCardBanner({ ...args, width: 1125, height: 369 }),
    ]);
    return { 'strip.png': s1, 'strip@2x.png': s2, 'strip@3x.png': s3 };
  }
}

/** Apple wants CSS-style rgb(r,g,b); merchants store hex. */
export function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) return 'rgb(79,70,229)';
  return `rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`;
}
