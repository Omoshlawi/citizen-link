import { Test, TestingModule } from '@nestjs/testing';
import { StatusTransitionsService } from './status-transitions.service';

describe('StatusTransitionsService', () => {
  let service: StatusTransitionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StatusTransitionsService],
    }).compile();

    service = module.get<StatusTransitionsService>(StatusTransitionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
