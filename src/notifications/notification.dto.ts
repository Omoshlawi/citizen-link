import { NotificationChannel } from '../../generated/prisma/enums';
import { createZodDto } from 'nestjs-zod';
import z from 'zod';
import { NotificationPriority } from './notification.interfaces';

export const TestNotificationSchema = z.object({
  templateKey: z.string().nonempty('Template key is required'),
  inlineContent: z
    .object({
      email: z
        .object({
          subject: z.string(),
          html: z.string(),
        })
        .optional(),
      sms: z
        .object({
          body: z.string(),
        })
        .optional(),
      push: z
        .object({
          title: z.string(),
          body: z.string(),
          data: z.record(z.string(), z.any()).optional(),
        })
        .optional(),
    })
    .optional(),
  channels: z.enum(NotificationChannel).array().optional(),
  priority: z.enum(NotificationPriority).optional(),
  recipient: z.object({
    email: z.email().optional(),
    phone: z.string().optional(),
    pushTokens: z.array(z.string()).optional(),
    userId: z.string().optional(),
    data: z.record(z.string(), z.any()).optional(),
  }),
});

export class TestNotificationDto extends createZodDto(TestNotificationSchema) {}
