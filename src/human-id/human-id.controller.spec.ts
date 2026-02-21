import { Test, TestingModule } from '@nestjs/testing';
import { HumanIdController } from './human-id.controller';

describe('HumanIdController', () => {
  let controller: HumanIdController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HumanIdController],
    }).compile();

    controller = module.get<HumanIdController>(HumanIdController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
