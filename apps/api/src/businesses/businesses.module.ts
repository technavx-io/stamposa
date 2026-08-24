import { Module } from '@nestjs/common';
import { QrModule } from '../qr/qr.module';
import { StorageModule } from '../storage/storage.module';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';

@Module({
  imports: [QrModule, StorageModule],
  controllers: [BusinessesController],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
export class BusinessesModule {}
