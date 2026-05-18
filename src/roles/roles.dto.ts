import { createZodDto } from 'nestjs-zod';
import z from 'zod';
import { ApiProperty } from '@nestjs/swagger';

// ─── Query ───────────────────────────────────────────────────────────────────

export const QueryRolesSchema = z.object({
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).optional(),
  search: z.string().optional(),
  includeVoided: z
    .stringbool({ truthy: ['true', '1'], falsy: ['false', '0'] })
    .optional()
    .default(false),
});

export class QueryRolesDto extends createZodDto(QueryRolesSchema) {}

// ─── Resource ────────────────────────────────────────────────────────────────

export const CreateResourceSchema = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(
      /^[a-zA-Z][a-zA-Z0-9]*$/,
      'Slug must be camelCase (e.g. documentCase)',
    ),
  description: z.string().optional(),
});

export const UpdateResourceSchema = CreateResourceSchema.partial();

export class CreateResourceDto extends createZodDto(CreateResourceSchema) {}
export class UpdateResourceDto extends createZodDto(UpdateResourceSchema) {}

// ─── ResourceAction ───────────────────────────────────────────────────────────

export const CreateResourceActionSchema = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'Slug must be kebab-case (e.g. list-any)'),
  description: z.string().optional(),
});

export const UpdateResourceActionSchema = CreateResourceActionSchema.partial();

export class CreateResourceActionDto extends createZodDto(
  CreateResourceActionSchema,
) {}
export class UpdateResourceActionDto extends createZodDto(
  UpdateResourceActionSchema,
) {}

// ─── Role ────────────────────────────────────────────────────────────────────

export const CreateRoleSchema = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'Slug must be kebab-case (e.g. case-verifier)'),
  description: z.string().optional(),
});

export const UpdateRoleSchema = CreateRoleSchema.partial();

export class CreateRoleDto extends createZodDto(CreateRoleSchema) {}
export class UpdateRoleDto extends createZodDto(UpdateRoleSchema) {}

// ─── Role Permissions ─────────────────────────────────────────────────────────

export const SetRolePermissionsSchema = z.object({
  resourceActionIds: z.array(z.string().uuid()).min(0),
});

export class SetRolePermissionsDto extends createZodDto(
  SetRolePermissionsSchema,
) {}

// ─── Response ────────────────────────────────────────────────────────────────

export class ResourceActionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() resourceId: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty() description: string | null;
  @ApiProperty() isBuiltIn: boolean;
  @ApiProperty() voided: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class ResourceResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty() description: string | null;
  @ApiProperty() isBuiltIn: boolean;
  @ApiProperty() voided: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiProperty({ isArray: true, type: ResourceActionResponseDto })
  actions: ResourceActionResponseDto[];
}

export class ListResourcesResponseDto {
  @ApiProperty({ isArray: true, type: ResourceResponseDto })
  results: ResourceResponseDto[];
  @ApiProperty() totalCount: number;
}

export class RolePermissionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() roleId: string;
  @ApiProperty() resourceId: string;
  @ApiProperty({ type: ResourceResponseDto }) resource: ResourceResponseDto;
  @ApiProperty() resourceActionId: string;
  @ApiProperty({ type: ResourceActionResponseDto })
  resourceAction: ResourceActionResponseDto;
  @ApiProperty() createdAt: Date;
}

export class RoleResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty() description: string | null;
  @ApiProperty() canDelete: boolean;
  @ApiProperty() canEditPermissions: boolean;
  @ApiProperty() voided: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiProperty({ isArray: true, type: RolePermissionResponseDto })
  permissions: RolePermissionResponseDto[];
}

export class ListRolesResponseDto {
  @ApiProperty({ isArray: true, type: RoleResponseDto })
  results: RoleResponseDto[];
  @ApiProperty() totalCount: number;
}

export class EffectivePermissionsResponseDto {
  @ApiProperty({
    additionalProperties: { type: 'array', items: { type: 'string' } },
  })
  permissions: Record<string, string[]>;
}
