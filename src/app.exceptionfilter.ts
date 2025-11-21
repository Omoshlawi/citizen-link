import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { ZodValidationException } from 'nestjs-zod';
import type { Request, Response } from 'express';
import z from 'zod';
@Catch(ZodValidationException)
export class ZodValidationExceptionFilter implements ExceptionFilter {
  private logger = new Logger(ZodValidationException.name);
  catch(exception: ZodValidationException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const error = exception.getZodError();

    this.logger.error(
      'Validation error on ' + request.originalUrl + ': ',
      error,
    );
    response.status(status).json({
      statusCode: status,
      message: exception.message,
      errors: z.formatError(error as any),
    });
  }
}
