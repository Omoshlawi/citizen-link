/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  HttpBadRequestResponseDto,
  HttpFobbidenErrorResponseDto,
  HttpInternalServerErrorResponseDto,
  HttpNotFoundErrorResponseDto,
  HttpUnauthorizedErrorResponseDto,
} from './app.dto';

type ApiErrorResponseProps = {
  badRequest?: boolean;
  notFound?: boolean;
  unauthorized?: boolean;
  forbidden?: boolean;
  internalServerError?: boolean;
};

export const ApiErrorsResponse = ({
  badRequest = false,
  notFound = true,
  unauthorized = true,
  forbidden = true,
  internalServerError = true,
}: ApiErrorResponseProps = {}) => {
  const decorators: any[] = [];
  if (internalServerError) {
    decorators.push(
      ApiInternalServerErrorResponse({
        type: HttpInternalServerErrorResponseDto,
      }),
    );
  }
  if (notFound) {
    decorators.push(
      ApiNotFoundResponse({ type: HttpNotFoundErrorResponseDto }),
    );
  }
  if (unauthorized) {
    decorators.push(
      ApiUnauthorizedResponse({ type: HttpUnauthorizedErrorResponseDto }),
    );
  }
  if (forbidden) {
    decorators.push(
      ApiForbiddenResponse({ type: HttpFobbidenErrorResponseDto }),
    );
  }
  if (badRequest) {
    decorators.push(ApiBadRequestResponse({ type: HttpBadRequestResponseDto }));
  }

  return applyDecorators(...decorators);
};
