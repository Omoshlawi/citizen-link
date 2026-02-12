import { Test, TestingModule } from '@nestjs/testing';
import { PickupStationsController } from './pickup-stations.controller';

describe('PickupStationsController', () => {
  let controller: PickupStationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PickupStationsController],
    }).compile();

    controller = module.get<PickupStationsController>(PickupStationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
