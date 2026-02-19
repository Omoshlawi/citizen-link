import { Test, TestingModule } from '@nestjs/testing';
import { StatusTransitionsController } from './status-transitions.controller';

describe('StatusTransitionsController', () => {
  let controller: StatusTransitionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatusTransitionsController],
    }).compile();

    controller = module.get<StatusTransitionsController>(StatusTransitionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
