import { Test, TestingModule } from '@nestjs/testing';
import { DarajaController } from './daraja.controller';

describe('DarajaController', () => {
  let controller: DarajaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DarajaController],
    }).compile();

    controller = module.get<DarajaController>(DarajaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
