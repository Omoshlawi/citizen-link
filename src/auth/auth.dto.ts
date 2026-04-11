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
