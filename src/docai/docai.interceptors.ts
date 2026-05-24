import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { AxiosInstance, isAxiosError } from 'axios';

const logger = new Logger('DocaiHttpInterceptor');

/**
 * Register once on HttpService.axiosRef (via DocaiService.onModuleInit).
 * Converts every AxiosError from the docai microservice into a clean
 * HttpException so callers never see the raw verbose Axios error object.
 */
export function applyDocaiErrorInterceptor(axiosRef: AxiosInstance): void {
  axiosRef.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (!isAxiosError(error)) throw error;

      // No response — network down, DNS failure, timeout, ECONNREFUSED
      if (!error.response) {
        const code = error.code ?? 'UNKNOWN';
        logger.warn(`DocAI unreachable — ${code}: ${error.message}`);
        throw new HttpException(
          { message: 'DocAI service is unavailable', code },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const status = error.response.status;
      const upstream = error.response.data as
        | Record<string, unknown>
        | string
        | null;

      const message: string =
        (typeof upstream === 'object' && upstream !== null
          ? ((upstream.detail ?? upstream.message ?? upstream.error) as
              | string
              | undefined)
          : typeof upstream === 'string'
            ? upstream
            : undefined) ?? `DocAI error (${status})`;

      logger.warn(`DocAI responded ${status}: ${JSON.stringify(message)}`);
      throw new HttpException({ message, service: 'docai' }, status);
    },
  );
}
