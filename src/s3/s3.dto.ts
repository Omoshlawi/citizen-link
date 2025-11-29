import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const GetUploadUrlSchema = z.object({
  fileName: z.string().nonempty().describe('File name'),
  mimeType: z.string().nonempty().describe('Mime type'),
  size: z.coerce.number().min(1).describe('File size in bytes'),
  tags: z.string().array().optional(),
});

export const GetDownloadUrlSchema = z.object({
  fileName: z.string().nonempty().describe('File name'),
});

export class GetUploadUrlDto extends createZodDto(GetUploadUrlSchema) {}

export class GetUploadUrlResponseDto {
  @ApiProperty({ description: 'The signed URL for uploading a file' })
  url: string;
  @ApiProperty({ description: 'The key for the file' })
  key: string;
}

export class GetDownloadUrlDto extends createZodDto(GetDownloadUrlSchema) {}
export class GetDownloadUrlResponseDto {
  @ApiProperty({ description: 'The signed URL for downloading a file' })
  url: string;
}

export const StreamDocumentSchema = z.object({
  fileName: z.string().nonempty().describe('File name'),
});

export class StreamDocumentDto extends createZodDto(StreamDocumentSchema) {}
