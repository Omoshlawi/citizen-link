import { Test, TestingModule } from '@nestjs/testing';
import { MauzoController } from './mauzo.controller';

describe('MauzoController', () => {
  let controller: MauzoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MauzoController],
    }).compile();

    controller = module.get<MauzoController>(MauzoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
