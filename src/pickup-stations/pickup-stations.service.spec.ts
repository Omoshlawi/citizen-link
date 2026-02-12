import { Test, TestingModule } from '@nestjs/testing';
import { PickupStationsService } from './pickup-stations.service';

describe('PickupStationsService', () => {
  let service: PickupStationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PickupStationsService],
    }).compile();

    service = module.get<PickupStationsService>(PickupStationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
