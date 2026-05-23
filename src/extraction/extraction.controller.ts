import { Controller } from '@nestjs/common';
import { ExtractionService } from './extraction.service';

@Controller('extraction')
export class ExtractionController {
  constructor(private readonly extractionService: ExtractionService) {}
}
