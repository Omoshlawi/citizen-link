import { Test, TestingModule } from '@nestjs/testing';
import { ExpoSdkService } from './expo-sdk.service';

describe('ExpoSdkService', () => {
  let service: ExpoSdkService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExpoSdkService],
    }).compile();

    service = module.get<ExpoSdkService>(ExpoSdkService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
