import { Global, Module } from '@nestjs/common';
import { PushTokenService } from './push-token.service';
import { PushTokenController } from './push-token.controller';

@Global()
@Module({
  providers: [PushTokenService],
  controllers: [PushTokenController],
  exports: [PushTokenService],
})
export class PushTokenModule {}
