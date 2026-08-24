import { Global, Module } from '@nestjs/common';
import { PasswordService } from './password.service';
import { PhoneService } from './phone.service';

@Global()
@Module({
  providers: [PhoneService, PasswordService],
  exports: [PhoneService, PasswordService],
})
export class SharedModule {}
