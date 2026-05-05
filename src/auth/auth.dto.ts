import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import z from 'zod';

// ─── Session ──────────────────────────────────────────────────────────────────

export const UpdateSessionSchema = z.object({
  stationId: z.uuid().nullable().optional(),
});

export class UpdateSessionDto extends createZodDto(UpdateSessionSchema) {}

export class SessionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  stationId!: string | null;
}

// ─── Create User (Extended) ───────────────────────────────────────────────────

export const CreateUserExtendedSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.string().optional(),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .optional(),
  phoneNumber: z
    .string()
    .regex(/^\d{6,12}$/, 'Enter subscriber digits only (e.g. 712345678)')
    .optional(),
});

export class CreateUserExtendedDto extends createZodDto(
  CreateUserExtendedSchema,
) {}

export class CreatedUserResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
  @ApiPropertyOptional({ nullable: true }) username?: string | null;
  @ApiPropertyOptional({ nullable: true }) phoneNumber?: string | null;
  @ApiProperty() createdAt!: Date;
}

// ─── Roles ────────────────────────────────────────────────────────────────────

export class RolePermissionDto {
  @ApiProperty({ example: 'documentCase' }) resource!: string;
  @ApiProperty({ example: 'Document Case' }) resourceName!: string;
  @ApiProperty({ example: 'verify' }) action!: string;
  @ApiProperty({ example: 'Verify' }) actionName!: string;
}

export class SystemRoleDto {
  @ApiProperty({ example: 'case-verifier' }) role!: string;
  @ApiProperty({ example: 'Case Verifier' }) name!: string;
  @ApiProperty({ type: [RolePermissionDto] }) permissions!: RolePermissionDto[];
}

export class GetRolesResponseDto {
  @ApiProperty({ type: [SystemRoleDto] }) results!: SystemRoleDto[];
  @ApiProperty({ example: 13 }) totalCount!: number;
}
