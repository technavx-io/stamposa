import { Module } from '@nestjs/common';
import { LocalDiskStorage } from './local-disk.storage';
import { FILE_STORAGE } from './storage.types';

@Module({
  providers: [LocalDiskStorage, { provide: FILE_STORAGE, useExisting: LocalDiskStorage }],
  exports: [FILE_STORAGE],
})
export class StorageModule {}
