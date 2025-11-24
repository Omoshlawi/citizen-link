import { Test, TestingModule } from '@nestjs/testing';
import { CaseDocumentsService } from './case-documents.service';

describe('CaseDocumentsService', () => {
  let service: CaseDocumentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CaseDocumentsService],
    }).compile();

    service = module.get<CaseDocumentsService>(CaseDocumentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
