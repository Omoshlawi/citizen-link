import {
  Body,
  Controller,
  HttpStatus,
  MaxFileSizeValidator,
  ParseFilePipeBuilder,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Session } from '@thallesp/nestjs-better-auth';
import { UserSession } from '../auth/auth.types';
import { VisionService } from './vision.service';
import { RequireSystemPermission } from '../auth/auth.decorators';
import { ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { memoryStorage } from 'multer';

@Controller('vision')
export class VisionController {
  constructor(private readonly visionService: VisionService) {}

  @Post('extract')
  @RequireSystemPermission({ extraction: ['debug'] })
  @ApiOperation({
    summary: 'Extract text from uploaded documents',
    description: 'Extract text from uploaded documents using AI',
  })
  @ApiBody({
    type: 'multipart/form-data',
    schema: {
      type: 'object',
      properties: {
        documents: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('documents', 2, { storage: memoryStorage() }),
  )
  async extractText(
    @UploadedFiles(
      new ParseFilePipeBuilder()
        .addValidator(new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 })) // 10MB per file
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    files: Express.Multer.File[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Session() { user }: UserSession,
  ) {
    return this.visionService.extract(files);
  }
}
