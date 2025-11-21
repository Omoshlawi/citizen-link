import { ApiProperty } from '@nestjs/swagger';

class ZodFieldError {
  @ApiProperty({
    type: [String],
    description: 'Array of error messages for this field',
    example: ['Required'],
  })
  _errors: string[];

  // Allow nested field errors (index signature without decorator)
  [key: string]: string[] | ZodFieldError;
}

export class HttpBadRequestResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ example: 'Validation failed' })
  message: string;

  @ApiProperty({
    type: ZodFieldError,
    description: 'Zod formatted validation errors',
    example: {
      _errors: [],
      field1Name: {
        _errors: ['Required'],
      },
      field2Name: {
        _errors: [],
        nestedField1Name: {
          _errors: ['Required'],
        },
        nestedField2Name: {
          _errors: ['Required'],
        },
      },
    },
  })
  errors?: ZodFieldError;
}

export class HttpInternalServerErrorResponseDto {
  @ApiProperty({ example: 500 })
  statusCode: number;

  @ApiProperty({ example: 'Internal server error' })
  message: string;
}

export class HttpNotFoundErrorResponseDto {
  @ApiProperty({ example: 404 })
  statusCode: number;

  @ApiProperty({ example: 'Not found' })
  message: string;
}
export class HttpUnauthorizedErrorResponseDto {
  @ApiProperty({ example: 401 })
  statusCode: number;

  @ApiProperty({ example: 'Unauthorized request' })
  message: string;
}
export class HttpFobbidenErrorResponseDto {
  @ApiProperty({ example: 403 })
  statusCode: number;

  @ApiProperty({ example: 'Fobbiden request' })
  message: string;
}
