/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectS3, S3 } from 'nestjs-s3';
import { basename, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { S3Config } from './s3.config';
import { Readable } from 'stream';

@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);

  constructor(
    @InjectS3() private readonly s3: S3,
    private readonly config: S3Config,
  ) {}

  private async ensureBucketExists(bucket: string) {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: bucket }));
      this.logger.log(`S3 buckets "${bucket}" is ready`);
    } catch (err: any) {
      if (
        err?.name === 'NotFound' ||
        err?.code === 'NotFound' ||
        err?.$metadata?.httpStatusCode === 404
      ) {
        this.logger.log(`Bucket does not exist, creating bucket: ${bucket}`);
        // Create bucket if it does not exist
        await this.s3.send(new CreateBucketCommand({ Bucket: bucket }));
        this.logger.log(`Successfully created bucket: ${bucket}`);
      } else {
        this.logger.error('Error checking/creating bucket', err);
        // For other errors, rethrow
        throw err;
      }
    }
  }

  async onModuleInit() {
    // Ensure the buckets exists (once on module init)
    await this.ensureBucketExists(this.config.tmpBucket);
    await this.ensureBucketExists(this.config.casesBucket);
  }

  generateFileName(originalName: string): string {
    const fileId = uuidv4();
    const fileExtension = extname(originalName);
    return `${fileId}${fileExtension}`;
  }

  /**
   * Generate a pre-signed URL for uploading (PUT) a file to the private S3 bucket.
   * @param fileName The original filename
   * @param mimeType The MIME type of the file being uploaded
   * @param expiresIn Seconds before the URL expires (default 1 hour)
   * @param metadata Optional metadata to attach to the file
   * @returns The pre-signed upload URL and the generated key
   */
  async generateUploadSignedUrl(
    bucket: 'tmp' | 'cases' = 'tmp',
    fileName: string,
    mimeType: string,
    expiresIn = 3600,
    metadata: Record<string, string> = {},
  ): Promise<{ url: string; key: string }> {
    const key = this.generateFileName(basename(fileName));
    const command = new PutObjectCommand({
      Bucket:
        bucket === 'tmp' ? this.config.tmpBucket : this.config.casesBucket,
      Key: key,
      ContentType: mimeType,
      Metadata: metadata,
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn });
    this.logger.debug(`Generated upload URL for key: ${key}`);

    return { url, key };
  }

  /**
   * Generate a pre-signed URL for downloading (GET) a file from the private S3 bucket.
   * @param key The S3 object key (path/filename)
   * @param expiresIn Seconds before the URL expires (default 1 hour)
   * @returns The pre-signed download URL
   */
  async generateDownloadSignedUrl(
    key: string,
    expiresIn = 3600,
    bucket: 'tmp' | 'cases' = 'tmp',
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket:
        bucket === 'tmp' ? this.config.tmpBucket : this.config.casesBucket,
      Key: key,
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn });
    this.logger.debug(`Generated download URL for key: ${key}`);

    return url;
  }

  /**
   * Deletes a file from the private S3 bucket.
   * @param key The S3 object key (path/filename) to delete
   * @returns Promise resolving when deletion is complete
   */
  async deleteFile(
    key: string,
    bucket: 'tmp' | 'cases' = 'tmp',
  ): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket:
          bucket === 'tmp' ? this.config.tmpBucket : this.config.casesBucket,
        Key: key,
      });
      await this.s3.send(command);
      this.logger.debug(`Successfully deleted file: ${key}`);
    } catch (error: any) {
      this.logger.error(`Error deleting file: ${key}`, error);
      throw error;
    }
  }

  /**
   * Retrieves the metadata of a file stored in the private S3 bucket.
   * @param key The S3 object key (path/filename).
   * @returns Promise resolving to the metadata of the file, or undefined if not found.
   */
  async getFileMetadata(key: string, bucket: 'tmp' | 'cases' = 'tmp') {
    try {
      const command = new HeadObjectCommand({
        Bucket:
          bucket === 'tmp' ? this.config.tmpBucket : this.config.casesBucket,
        Key: key,
      });
      const result = await this.s3.send(command);

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
    } catch (error: any) {
      // Not found
      if (
        error?.$metadata?.httpStatusCode === 404 ||
        error?.name === 'NotFound' ||
        error?.name === 'NoSuchKey' ||
        error?.code === 'NotFound' ||
        error?.code === 'NoSuchKey'
      ) {
        return undefined;
      }
      this.logger.error(`Error getting file metadata: ${key}`, error);
      throw error;
    }
  }

  /**
   * Retrieves a file stream from the private S3 bucket for inline consumption.
   * @param key The S3 object key (path/filename).
   * @returns Object containing the file stream and metadata
   */
  async streamFile(
    key: string,
    bucket: 'tmp' | 'cases' = 'tmp',
  ): Promise<{
    stream: Readable;
    contentType: string;
    contentLength?: number;
    metadata?: Record<string, string>;
  }> {
    try {
      const command = new GetObjectCommand({
        Bucket:
          bucket === 'tmp' ? this.config.tmpBucket : this.config.casesBucket,
        Key: key,
      });
      const result = await this.s3.send(command);

      if (!result.Body || typeof result.Body === 'string') {
        throw new Error('S3 object did not contain a readable stream');
      }

      this.logger.debug(`Streaming file: ${key}`);

      return {
        stream: result.Body as Readable,
        contentType: result.ContentType ?? 'application/octet-stream',
        contentLength: result.ContentLength,
        metadata: result.Metadata,
      };
    } catch (error: any) {
      // S3 NotFound error or missing file
      if (
        error?.$metadata?.httpStatusCode === 404 ||
        error?.name === 'NotFound' ||
        error?.name === 'NoSuchKey' ||
        error?.code === 'NotFound' ||
        error?.code === 'NoSuchKey'
      ) {
        this.logger.warn(`File not found in S3: ${key}`);
        throw new NotFoundException(`File not found in S3: ${key}`);
      }
      // Other errors
      this.logger.error(`Error streaming file: ${key}`, error);
      throw error;
    }
  }

  /**
   * Checks if a file exists in the private S3 bucket.
   * @param key The S3 object key (path/filename).
   * @returns Promise<boolean> true if exists, false otherwise
   */
  async fileExists(
    key: string,
    bucket: 'tmp' | 'cases' = 'tmp',
  ): Promise<boolean> {
    try {
      this.logger.debug(
        `Checking if file exists: bucket=${this.config.tmpBucket}, key=${key}`,
      );

      const command = new HeadObjectCommand({
        Bucket:
          bucket === 'tmp' ? this.config.tmpBucket : this.config.casesBucket,
        Key: key,
      });
      await this.s3.send(command);

      this.logger.debug(`File exists: ${key}`);
      return true;
    } catch (error: any) {
      // Check for 404/NotFound errors - file doesn't exist
      if (
        error?.$metadata?.httpStatusCode === 404 ||
        error?.name === 'NotFound' ||
        error?.name === 'NoSuchKey' ||
        error?.code === 'NotFound' ||
        error?.code === 'NoSuchKey'
      ) {
        this.logger.debug(`File does not exist: ${key}`);
        return false;
      }

      // For any other error (including 400 Bad Request), log and throw
      this.logger.error(
        `Error checking if file exists: ${key}. ` +
          `Error name: ${error?.name}, code: ${error?.code}, ` +
          `HTTP status: ${error?.$metadata?.httpStatusCode}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Uploads a file buffer directly to S3.
   * @param key The S3 object key (path/filename)
   * @param buffer The file buffer to upload
   * @param mimeType The MIME type of the file
   * @param metadata Optional metadata to attach
   * @returns Promise resolving when upload is complete
   */
  async uploadFile(
    key: string,
    bucket: 'tmp' | 'cases' = 'tmp',
    buffer: Buffer,
    mimeType: string,
    metadata: Record<string, string> = {},
  ): Promise<void> {
    try {
      const command = new PutObjectCommand({
        Bucket:
          bucket === 'tmp' ? this.config.tmpBucket : this.config.casesBucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        Metadata: metadata,
      });

      await this.s3.send(command);
      this.logger.debug(`Successfully uploaded file: ${key}`);
    } catch (error: any) {
      this.logger.error(`Error uploading file: ${key}`, error);
      throw error;
    }
  }

  /**
   * Moves a file from the temporary bucket to the cases bucket.
   * @param key The S3 object key (path/filename)
   * @returns Promise resolving when the move is complete
   */
  async moveFileToCasesBucket(
    key: string,
    destinationDir: string,
  ): Promise<void> {
    const sourceBucket = this.config.tmpBucket;
    const destinationBucket = this.config.casesBucket;

    try {
      this.logger.debug(
        `Moving file ${key} from ${sourceBucket} to ${destinationBucket}/${destinationDir}`,
      );

      // 1. Copy the object to the destination bucket
      // Note: CopySource must be URL-encoded and include the source bucket name
      await this.s3.send(
        new CopyObjectCommand({
          Bucket: destinationBucket,
          Key: `${destinationDir}/${key}`,
          CopySource: `${sourceBucket}/${key}`,
        }),
      );

      // 2. Delete the original object from the source bucket
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: sourceBucket,
          Key: key,
        }),
      );

      this.logger.log(
        `Successfully moved file: ${key} to ${destinationBucket}`,
      );
    } catch (error: any) {
      this.logger.error(`Failed to move file ${key}:`, error);

      // If the error happened during deletion, the file exists in BOTH places.
      // If it happened during copy, it only exists in the source.
      throw error;
    }
  }

  /**
   * Downloads a file from S3 and returns it as a Buffer.
   * @param key The S3 object key
   * @param bucket Choice of bucket (defaults to 'tmp')
   * @returns Promise resolving to the file Buffer
   */
  async downloadFile(
    key: string,
    bucket: 'tmp' | 'cases' = 'tmp',
  ): Promise<Buffer> {
    try {
      const targetBucket =
        bucket === 'tmp' ? this.config.tmpBucket : this.config.casesBucket;

      const command = new GetObjectCommand({
        Bucket: targetBucket,
        Key: key,
      });

      const response = await this.s3.send(command);

      // Convert the readable stream to a Buffer
      const chunks: Uint8Array[] = [];
      const stream = response.Body as Readable;

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      this.logger.debug(
        `Successfully downloaded file: ${key} from ${targetBucket}`,
      );
      return Buffer.concat(chunks);
    } catch (error: any) {
      if (
        error?.name === 'NoSuchKey' ||
        error?.$metadata?.httpStatusCode === 404
      ) {
        throw new NotFoundException(`File ${key} not found in S3`);
      }
      this.logger.error(`Error downloading file: ${key}`, error);
      throw error;
    }
  }
}
