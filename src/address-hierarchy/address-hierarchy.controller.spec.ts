import { Test, TestingModule } from '@nestjs/testing';
import { AddressHierarchyController } from './address-hierarchy.controller';

describe('AddressHierarchyController', () => {
  let controller: AddressHierarchyController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AddressHierarchyController],
    }).compile();

    controller = module.get<AddressHierarchyController>(
      AddressHierarchyController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
