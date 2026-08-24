import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join, normalize, resolve, sep } from 'path';
import { AppConfigService } from '../config/app-config.service';
import { FileStorage } from './storage.types';

const PUBLIC_PREFIX = '/uploads';

@Injectable()
export class LocalDiskStorage implements FileStorage, OnModuleInit {
  private readonly logger = new Logger(LocalDiskStorage.name);

  constructor(private readonly config: AppConfigService) {}

  async onModuleInit(): Promise<void> {
    await mkdir(this.config.uploadDir, { recursive: true });
  }

  async save(params: { buffer: Buffer; directory: string; extension: string }): Promise<string> {
    const dir = join(this.config.uploadDir, params.directory);
    await mkdir(dir, { recursive: true });
    const filename = `${randomUUID()}.${params.extension}`;
    await writeFile(join(dir, filename), params.buffer);
    return `${PUBLIC_PREFIX}/${params.directory}/${filename}`;
  }

  async remove(relativePath: string): Promise<void> {
    if (!relativePath.startsWith(`${PUBLIC_PREFIX}/`)) return;
    const withinUploads = relativePath.slice(PUBLIC_PREFIX.length + 1);
    const absolute = resolve(this.config.uploadDir, normalize(withinUploads));
    // Refuse anything that escapes the uploads root (defence in depth —
    // relativePath only ever comes from our own database).
    if (!absolute.startsWith(resolve(this.config.uploadDir) + sep)) return;
    try {
      await unlink(absolute);
    } catch {
      this.logger.warn(`Could not remove file ${relativePath}`);
    }
  }
}
