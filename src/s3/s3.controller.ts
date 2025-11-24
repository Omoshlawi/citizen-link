import { Controller, Get, Query } from '@nestjs/common';
import { S3Service } from './s3.service';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ApiErrorsResponse } from 'src/app.decorators';
import {
  GetDownloadUrlDto,
  GetDownloadUrlResponseDto,
  GetUploadUrlDto,
  GetUploadUrlResponseDto,
} from './s3.dto';
import dayjs from 'dayjs';
import { S3Config } from './s3.config';

@Controller('files')
export class S3Controller {
  constructor(
    private readonly s3Service: S3Service,
    private readonly config: S3Config,
  ) {}

  @Get('upload-url')
  @ApiOperation({ summary: 'Get Upload URL' })
  @ApiOkResponse({ type: GetUploadUrlResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  async getUploadUrl(@Query() query: GetUploadUrlDto) {
    const url = await this.s3Service.generateUploadSignedUrl(
      query.fileName,
      query.mimeType,
      this.config.expiresIn,

      {
        tags: query?.tags?.join(',') ?? '',
        expiresIn: dayjs().add(this.config.expiresIn, 'seconds').toISOString(),
        size: query?.size?.toString() ?? '',
        fileName: query?.fileName ?? '',
        originalFileName: query?.fileName ?? '',
      },
    );
    return { url };
  }
  @Get('download-url')
  @ApiOperation({ summary: 'Get Download URL' })
  @ApiOkResponse({ type: GetDownloadUrlResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  async getDownloadUrl(@Query() query: GetDownloadUrlDto) {
    const url = await this.s3Service.generateDownloadSignedUrl(
      query.fileName,
      this.config.expiresIn,
    );
    return { url };
  }
}
