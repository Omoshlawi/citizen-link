import { Controller } from '@nestjs/common';
import { MauzoService } from './mauzo.service';

@Controller('mauzo')
export class MauzoController {
  constructor(private readonly mauzoService: MauzoService) {}
}
