import { Global, Module } from '@nestjs/common';
import { IdentifierService } from './identifier.service';
import { PasswordService } from './password.service';
import { PhoneService } from './phone.service';

@Global()
@Module({
  providers: [PhoneService, PasswordService, IdentifierService],
  exports: [PhoneService, PasswordService, IdentifierService],
})
export class SharedModule {}
