import { Test, TestingModule } from '@nestjs/testing';
import { DocumentImagesService } from './document-images.service';

describe('DocumentImagesService', () => {
  let service: DocumentImagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DocumentImagesService],
    }).compile();

    service = module.get<DocumentImagesService>(DocumentImagesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
