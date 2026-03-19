import { Module } from '@nestjs/common';
import { PushTokenService } from './push-token.service';
import { PushTokenController } from './push-token.controller';

@Module({
  providers: [PushTokenService],
  controllers: [PushTokenController],
})
export class PushTokenModule {}
