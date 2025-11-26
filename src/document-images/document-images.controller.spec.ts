import { Test, TestingModule } from '@nestjs/testing';
import { DocumentImagesController } from './document-images.controller';

describe('DocumentImagesController', () => {
  let controller: DocumentImagesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentImagesController],
    }).compile();

    controller = module.get<DocumentImagesController>(DocumentImagesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
