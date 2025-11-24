import { Test, TestingModule } from '@nestjs/testing';
import { AddressHierarchyService } from './address-hierarchy.service';

describe('AddressHierarchyService', () => {
  let service: AddressHierarchyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AddressHierarchyService],
    }).compile();

    service = module.get<AddressHierarchyService>(AddressHierarchyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
