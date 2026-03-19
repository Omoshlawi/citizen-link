import { Global, Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { UserSettingService } from './settings.user.service';
import { SystemSettingService } from './settings.system.service';

@Global()
@Module({
  providers: [SettingsService, UserSettingService, SystemSettingService],
  controllers: [SettingsController],
  exports: [UserSettingService, SystemSettingService],
})
export class SettingsModule {}
