import { Test, TestingModule } from '@nestjs/testing';
import { HumanIdService } from './human-id.service';

describe('HumanIdService', () => {
  let service: HumanIdService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HumanIdService],
    }).compile();

    service = module.get<HumanIdService>(HumanIdService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
