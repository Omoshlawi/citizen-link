import { Test, TestingModule } from '@nestjs/testing';
import { AddressLocalesService } from './address-locales.service';

describe('AddressLocalesService', () => {
  let service: AddressLocalesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AddressLocalesService],
    }).compile();

    service = module.get<AddressLocalesService>(AddressLocalesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

