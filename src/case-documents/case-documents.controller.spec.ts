import { Test, TestingModule } from '@nestjs/testing';
import { CaseDocumentsController } from './case-documents.controller';
import { CaseDocumentsService } from './case-documents.service';

describe('CaseDocumentsController', () => {
  let controller: CaseDocumentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CaseDocumentsController],
      providers: [CaseDocumentsService],
    }).compile();

    controller = module.get<CaseDocumentsController>(CaseDocumentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
