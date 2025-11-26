import { Test, TestingModule } from '@nestjs/testing';
import { AddressLocalesController } from './address-locales.controller';

describe('AddressLocalesController', () => {
  let controller: AddressLocalesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AddressLocalesController],
    }).compile();

    controller = module.get<AddressLocalesController>(AddressLocalesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

