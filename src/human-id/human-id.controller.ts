import { Controller, Get, Query } from '@nestjs/common';
import { HumanIdService } from './human-id.service';
import {
  DecodedIdResponseDto,
  DecodeIdDto,
  GenerateIdDto,
  GenerateIdResponseDto,
  SequencesResponseDto,
} from './human-id.dto';
import { ApiOkResponse } from '@nestjs/swagger';
import { ApiErrorsResponse } from 'src/app.decorators';

@Controller('human-id')
export class HumanIdController {
  constructor(private readonly humanIdService: HumanIdService) {}

  @Get('sequences')
  @ApiOkResponse({
    type: SequencesResponseDto,
  })
  @ApiErrorsResponse({
    badRequest: true,
    unauthorized: false,
    notFound: false,
    forbidden: false,
  })
  getSequences() {
    return this.humanIdService.getAllSequences();
  }

  @Get('decode')
  @ApiOkResponse({
    type: DecodedIdResponseDto,
  })
  @ApiErrorsResponse({
    badRequest: true,
    unauthorized: false,
    notFound: false,
    forbidden: false,
  })
  decodeId(@Query() dto: DecodeIdDto) {
    return this.humanIdService.decodeId(dto);
  }

  @Get('generate')
  @ApiOkResponse({
    type: GenerateIdResponseDto,
  })
  @ApiErrorsResponse({
    badRequest: true,
    unauthorized: false,
    notFound: false,
    forbidden: false,
  })
  async generateId(@Query() dto: GenerateIdDto) {
    const id = await this.humanIdService.generate(dto);
    const decoded = this.humanIdService.decodeId({ id });
    return {
      id,
      ...decoded,
    };
  }
}
