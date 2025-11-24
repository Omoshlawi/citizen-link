/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { InjectS3, S3 } from 'nestjs-s3';
import { basename, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { S3Config } from './s3.config';

@Injectable()
export class S3Service {
  constructor(
    @InjectS3() private readonly s3: S3,
    private readonly config: S3Config,
  ) {}

  private generateFileName(originalName: string): string {
    const fileId = uuidv4();
    const fileExtension = extname(originalName);
    return `${fileId}${fileExtension}`;
  }

  /**
   * Generate a pre-signed URL for uploading (PUT) a file to the private S3 bucket.
   * @param key The S3 object key (path/filename)
   * @param mimeType The MIME type of the file being uploaded
   * @param expiresIn Seconds before the URL expires (default 1 hour)
   */
  async generateUploadSignedUrl(
    fileName: string,
    mimeType: string,
    expiresIn = 3600,
    metadata: Record<string, string> = {},
  ): Promise<string> {
    const key = this.generateFileName(basename(fileName));
    const command = new PutObjectCommand({
      Bucket: this.config.privateBucket,
      Key: key,
      ContentType: mimeType,
      Metadata: metadata,
    });
    return await getSignedUrl(this.s3, command, { expiresIn });
  }

  /**
   * Generate a pre-signed URL for downloading (GET) a file from the private S3 bucket.
   * @param key The S3 object key (path/filename)
   * @param expiresIn Seconds before the URL expires (default 1 hour)
   */
  async generateDownloadSignedUrl(
    key: string,
    expiresIn = 3600,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.config.privateBucket,
      Key: key,
    });
    return await getSignedUrl(this.s3, command, { expiresIn });
  }

  /**
   * Deletes a file from the private S3 bucket.
   * @param key The S3 object key (path/filename) to delete
   * @returns Promise resolving to the deletion result
   */
  async deleteFile(key: string): Promise<void> {
    await this.s3.deleteObject({
      Bucket: this.config.privateBucket,
      Key: key,
    });
  }

  /**
   * Retrieves the metadata of a file stored in the private S3 bucket.
   * @param key The S3 object key (path/filename).
   * @returns Promise resolving to the metadata of the file, or undefined if not found.
   */
  async getFileMetadata(key: string): Promise<Record<string, any> | undefined> {
    try {
      const result = await this.s3.headObject({
        Bucket: this.config.privateBucket,
        Key: key,
      });
      // Remove unnecessary sdk fields and return only metadata and important headers
      const {
        Metadata,
        ContentType,
        ContentLength,
        LastModified,
        ETag,
        ...rest
      } = result;
      return {
        Metadata,
        ContentType,
        ContentLength,
        LastModified,
        ETag,
        ...rest,
      };
    } catch (error) {
      // Not found
      if (
        error?.$metadata?.httpStatusCode === 404 ||
        error?.name === 'NotFound'
      ) {
        return undefined;
      }
      throw error;
    }
  }
}
