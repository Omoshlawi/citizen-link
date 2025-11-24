/* eslint-disable @typescript-eslint/unbound-method */
import { Configuration, Value } from '@itgorillaz/configify';
import z from 'zod';

@Configuration()
export class S3Config {
  @Value('S3_ACCESS_KEY_ID', { parse: z.string().nonempty().parse })
  accessKeyId: string;
  @Value('S3_SECRETE_ACCESS_KEY_ID', { parse: z.string().nonempty().parse })
  secreteAccessKeyId: string;
  @Value('S3_ENDPOINT', {
    parse: z.url().parse,
    default: 'http://localhost:9000',
  })
  endpoint: string;
  @Value('S3_BUCKET_PUBLIC', {
    parse: z.string().parse,
    default: 'hive-files-public',
  })
  publicBucket: string;
  @Value('S3_BUCKET_PRIVATE', {
    parse: z.string().parse,
    default: 'hive-files-private',
  })
  privateBucket: string;

  @Value('ALLOWED_MIME_TYPES', {
    default: [
      // Images
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      // Archives
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      'application/gzip',
      'application/x-tar',
      // Videos
      'video/mp4',
      'video/avi',
      'video/quicktime',
      'video/x-msvideo',
      // Audio
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
    ],
  })
  allowedMemeTypes: Array<string>;
  @Value('S3_EXPIRES_IN', {
    parse: z.coerce.number().min(1).default(3600).optional().parse,
    default: 3600,
  })
  expiresIn: number;
}
