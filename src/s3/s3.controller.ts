import {
  Controller,
  Get,
  Query,
  Res,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { S3Service } from './s3.service';
import {
  ApiOkResponse,
  ApiOperation,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { ApiErrorsResponse } from '../app.decorators';
import {
  GetDownloadUrlDto,
  GetDownloadUrlResponseDto,
  GetUploadUrlDto,
  GetUploadUrlResponseDto,
  StreamDocumentDto,
  UploadFileResponseDto,
  UploadFilesResponseDto,
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
      'tmp',
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
      'cases',
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
      await this.s3Service.streamFile(query.fileName, 'cases');

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

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a single file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOkResponse({ type: UploadFileResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const key = this.s3Service.generateFileName(file.filename);
    await this.s3Service.uploadFile(key, 'tmp', file.buffer, file.mimetype);
    return { key };
  }

  @Post('upload-many')
  @UseInterceptors(FilesInterceptor('files'))
  @ApiOperation({ summary: 'Upload multiple files' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @ApiOkResponse({ type: UploadFilesResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  async uploadFiles(@UploadedFiles() files: Express.Multer.File[]) {
    const keys: string[] = [];
    for (const file of files) {
      const key = this.s3Service.generateFileName(file.filename);
      await this.s3Service.uploadFile(key, 'tmp', file.buffer, file.mimetype);
      keys.push(key);
    }
    return { keys };
  }
}
