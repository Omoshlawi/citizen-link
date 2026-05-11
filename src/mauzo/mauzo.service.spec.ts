import { Test, TestingModule } from '@nestjs/testing';
import { MauzoService } from './mauzo.service';

describe('MauzoService', () => {
  let service: MauzoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MauzoService],
    }).compile();

    service = module.get<MauzoService>(MauzoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
