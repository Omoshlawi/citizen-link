import { Controller, Get, Query, Res } from '@nestjs/common';
import { S3Service } from './s3.service';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ApiErrorsResponse } from '../app.decorators';
import {
  GetDownloadUrlDto,
  GetDownloadUrlResponseDto,
  GetUploadUrlDto,
  GetUploadUrlResponseDto,
  StreamDocumentDto,
} from './s3.dto';
import dayjs from 'dayjs';
import { S3Config } from './s3.config';
import { Response } from 'express';

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
    return url;
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

  @Get('stream')
  @ApiOperation({ summary: 'Stream a file directly from S3' })
  @ApiOkResponse({ description: 'Streams the file content inline' })
  @ApiErrorsResponse({ badRequest: true })
  async streamFile(
    @Query() query: StreamDocumentDto,
    @Res() res: Response,
  ): Promise<void> {
    const { stream, contentType, contentLength } =
      await this.s3Service.streamFile(query.fileName);

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, private',
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Disposition', 'inline');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength.toString());
    }

    stream.pipe(res);
    stream.on('error', (error) => {
      console.error('S3 stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error streaming document' });
      }
    });
  }
}
