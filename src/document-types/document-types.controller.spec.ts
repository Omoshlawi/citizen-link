import { Test, TestingModule } from '@nestjs/testing';
import { DocumentTypesController } from './document-types.controller';
import { DocumentTypesService } from './document-types.service';

describe('DocumentTypesController', () => {
  let controller: DocumentTypesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentTypesController],
      providers: [DocumentTypesService],
    }).compile();

    controller = module.get<DocumentTypesController>(DocumentTypesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
