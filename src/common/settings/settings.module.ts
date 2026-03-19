import { Global, Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { UserSettingService } from './settings.user.service';

@Global()
@Module({
  providers: [SettingsService, UserSettingService],
  controllers: [SettingsController],
  exports: [UserSettingService],
})
export class SettingsModule {}
