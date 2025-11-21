import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { QueryBuilderSchema } from '../query-builder';
import z from 'zod';
import { Customer, CustomerGender } from '../../generated/prisma/browser';
import { PHONE_NUMBER_REGEX } from '../app.constant';
import dayjs from 'dayjs';
export const FindCustomersSchema = z.object({
  ...QueryBuilderSchema.shape,
  search: z.string().optional(),
  includeVoided: z
    .stringbool({
      truthy: ['true', '1'],
      falsy: ['false', '0'],
    })
    .optional()
    .default(false),
});

export const CustomerSchema = z.object({
  name: z.string().min(1, 'Required'),
  identificationNumber: z.string().optional(),
  dateOfBirth: z.iso
    .date()
    .optional()
    .refine((date) => !date || dayjs(date).isBefore(dayjs(), 'day'), {
      message: 'Date of birth must not be in the future',
    }),
  gender: z.enum(['MALE', 'FEMALE', 'UNKNOWN']).optional(),
  address: z.string().optional(),
  phonenNumber: z.string().regex(PHONE_NUMBER_REGEX).optional(),
  email: z.email().optional(),
});


// export const customerSelfRegistrationSchema =

export class FindCustomersDto extends createZodDto(FindCustomersSchema) {}
export class CreatCustomerDto extends createZodDto(CustomerSchema) {}
export class UpdateCustomerDto extends CreatCustomerDto {}

export class GetCustomerResponseDto implements Customer {
  @ApiProperty()
  name: string;
  @ApiProperty()
  identificationNumber: string;
  @ApiProperty()
  dateOfBirth: Date;
  @ApiProperty()
  gender: CustomerGender;
  @ApiProperty()
  address: string;
  @ApiProperty()
  phonenNumber: string;
  @ApiProperty()
  email: string;
  @ApiProperty()
  id: string;
  @ApiProperty()
  createdById: string | null;
  @ApiProperty()
  voided: boolean;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;
}

export class FindCustomerResponseDto {
  @ApiProperty({ isArray: true, type: GetCustomerResponseDto })
  results: GetCustomerResponseDto[];
  @ApiProperty()
  totalCount: number;
  @ApiProperty({ example: 1 })
  currentPage: number;

  @ApiProperty({ example: 12 })
  pageSize: number;

  @ApiProperty({ example: 0 })
  totalPages: number;

  @ApiProperty({ example: null, nullable: true, type: 'string' })
  next: string | null;

  @ApiProperty({ example: null, nullable: true, type: 'string' })
  prev: string | null;
}
