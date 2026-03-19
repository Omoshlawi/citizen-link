import { Test, TestingModule } from '@nestjs/testing';
import { PushTokenController } from './push-token.controller';

describe('PushTokenController', () => {
  let controller: PushTokenController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PushTokenController],
    }).compile();

    controller = module.get<PushTokenController>(PushTokenController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
