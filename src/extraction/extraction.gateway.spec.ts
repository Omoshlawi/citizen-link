import { Test, TestingModule } from '@nestjs/testing';
import { DocumentCaseGateway } from '../document-cases/document-case.gateway';

describe('ExtractionGateway', () => {
  let gateway: DocumentCaseGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DocumentCaseGateway],
    }).compile();

    gateway = module.get<DocumentCaseGateway>(DocumentCaseGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
