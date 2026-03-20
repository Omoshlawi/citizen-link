import { Test, TestingModule } from '@nestjs/testing';
import { ExpoSdkController } from './expo-sdk.controller';

describe('ExpoSdkController', () => {
  let controller: ExpoSdkController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpoSdkController],
    }).compile();

    controller = module.get<ExpoSdkController>(ExpoSdkController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
