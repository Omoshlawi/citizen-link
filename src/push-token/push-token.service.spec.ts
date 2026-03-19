import { Test, TestingModule } from '@nestjs/testing';
import { PushTokenService } from './push-token.service';

describe('PushTokenService', () => {
  let service: PushTokenService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PushTokenService],
    }).compile();

    service = module.get<PushTokenService>(PushTokenService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
