import { Body, Controller, Post } from '@nestjs/common';
import { ExtractionService } from './extraction.service';
import { RequireSystemPermission } from '../auth/auth.decorators';
import { ApiOperation } from '@nestjs/swagger';
import { VisionExtractionOutputDto } from '../vision/vision.dto';

@Controller('extraction')
export class ExtractionController {
  constructor(private readonly extractionService: ExtractionService) {}

  @Post('extract-text')
  @RequireSystemPermission({ extraction: ['debug'] })
  @ApiOperation({
    summary: 'Extract data from ocr scans',
    description: 'Extract data from ocr scans using AI',
  })
  async extractText(@Body() visionOutputDto: VisionExtractionOutputDto) {
    return this.extractionService.testExtraction(visionOutputDto);
  }
}
