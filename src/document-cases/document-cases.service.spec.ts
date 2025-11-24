import { Test, TestingModule } from '@nestjs/testing';
import { DocumentCasesService } from './document-cases.service';

describe('DocumentCasesService', () => {
  let service: DocumentCasesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DocumentCasesService],
    }).compile();

    service = module.get<DocumentCasesService>(DocumentCasesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
