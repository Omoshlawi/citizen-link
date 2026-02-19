import { Test, TestingModule } from '@nestjs/testing';
import { TransitionReasonsService } from './status-transitions.reasons.service';

describe('StatusTransitionsService', () => {
  let service: TransitionReasonsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransitionReasonsService],
    }).compile();

    service = module.get<TransitionReasonsService>(TransitionReasonsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
