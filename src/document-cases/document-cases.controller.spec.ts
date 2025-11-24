import { Test, TestingModule } from '@nestjs/testing';
import { DocumentCasesController } from './document-cases.controller';
import { DocumentCasesService } from './document-cases.service';

describe('DocumentCasesController', () => {
  let controller: DocumentCasesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentCasesController],
      providers: [DocumentCasesService],
    }).compile();

    controller = module.get<DocumentCasesController>(DocumentCasesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
