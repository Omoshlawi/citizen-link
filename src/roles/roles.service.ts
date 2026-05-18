import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  adminAc,
  defaultStatements as defaultAdminStatements,
} from 'better-auth/plugins/admin/access';
import { createAccessControl, role } from 'better-auth/plugins/access';
import { adminPluginAcl } from '../auth/auth.acl';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateResourceDto,
  CreateResourceActionDto,
  CreateRoleDto,
  QueryRolesDto,
  SetRolePermissionsDto,
  UpdateResourceActionDto,
  UpdateResourceDto,
  UpdateRoleDto,
} from './roles.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  // Held so Better Auth picks up permission changes on the next request without a restart.
  // Better Auth stores a shallow-spread copy of its options, so opts.roles IS this object.
  private readonly liveRoles: Record<string, ReturnType<typeof role>> = {};

  // ─── Startup ────────────────────────────────────────────────────────────────

  async loadForStartup() {
    const resources = await this.prisma.resource.findMany({
      where: { voided: false },
      include: { actions: { where: { voided: false } } },
    });

    const dynamicStatements: Record<string, readonly string[]> = {};
    for (const resource of resources) {
      dynamicStatements[resource.slug] = resource.actions.map((a) => a.slug);
    }

    const extendedAc = createAccessControl({
      ...defaultAdminStatements,
      ...(adminPluginAcl.statements as Record<string, readonly string[]>),
      ...dynamicStatements,
    } as const);

    const dbRoles = await this.prisma.role.findMany({
      where: { voided: false },
      include: {
        permissions: {
          include: { resource: true, resourceAction: true },
        },
      },
    });

    const allStatements: Record<string, string[]> = {
      ...adminAc.statements,
    };
    for (const resource of resources) {
      allStatements[resource.slug] = resource.actions.map((a) => a.slug);
    }
    const adminRoleObj = role(allStatements as any);

    for (const dbRole of dbRoles) {
      if (dbRole.slug === 'admin') {
        this.liveRoles['admin'] = adminRoleObj;
        continue;
      }
      const stmts: Record<string, string[]> = {};
      for (const perm of dbRole.permissions) {
        if (!stmts[perm.resource.slug]) stmts[perm.resource.slug] = [];
        stmts[perm.resource.slug].push(perm.resourceAction.slug);
      }
      this.liveRoles[dbRole.slug] = role(stmts as any);
    }

    return { ac: extendedAc, roles: this.liveRoles };
  }

  private syncRoleToMemory(
    slug: string,
    permissions: Array<{
      resource: { slug: string };
      resourceAction: { slug: string };
    }>,
  ) {
    const stmts: Record<string, string[]> = {};
    for (const perm of permissions) {
      if (!stmts[perm.resource.slug]) stmts[perm.resource.slug] = [];
      stmts[perm.resource.slug].push(perm.resourceAction.slug);
    }
    this.liveRoles[slug] = role(stmts as any);
  }

  // ─── Effective permissions (real-time display) ───────────────────────────────

  async getEffectivePermissions(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const roleSlugs = (user.role ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (roleSlugs.includes('admin')) {
      const resources = await this.prisma.resource.findMany({
        where: { voided: false },
        include: { actions: { where: { voided: false } } },
      });
      const result: Record<string, string[]> = {};
      for (const resource of resources) {
        result[resource.slug] = resource.actions.map((a) => a.slug);
      }
      return result;
    }

    const roleRecords = await this.prisma.role.findMany({
      where: { slug: { in: roleSlugs }, voided: false },
      include: {
        permissions: {
          include: { resource: true, resourceAction: true },
        },
      },
    });

    const result: Record<string, string[]> = {};
    for (const roleRecord of roleRecords) {
      for (const perm of roleRecord.permissions) {
        const res = perm.resource.slug;
        if (!result[res]) result[res] = [];
        if (!result[res].includes(perm.resourceAction.slug)) {
          result[res].push(perm.resourceAction.slug);
        }
      }
    }
    return result;
  }

  // ─── Resources ───────────────────────────────────────────────────────────────

  async listResources(query: QueryRolesDto) {
    const where = {
      voided: query.includeVoided ? undefined : false,
      ...(query.search
        ? {
            OR: [
              {
                name: { contains: query.search, mode: 'insensitive' as const },
              },
              {
                slug: { contains: query.search, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
    };
    const [results, totalCount] = await Promise.all([
      this.prisma.resource.findMany({
        where,
        include: { actions: { where: { voided: false } } },
        orderBy: { name: 'asc' },
        skip:
          query.page && query.limit
            ? (query.page - 1) * query.limit
            : undefined,
        take: query.limit,
      }),
      this.prisma.resource.count({ where }),
    ]);
    return { results, totalCount };
  }

  async findResource(id: string) {
    const resource = await this.prisma.resource.findUnique({
      where: { id },
      include: { actions: { where: { voided: false } } },
    });
    if (!resource) throw new NotFoundException('Resource not found');
    return resource;
  }

  async createResource(dto: CreateResourceDto) {
    return this.prisma.resource.create({
      data: dto,
      include: { actions: true },
    });
  }

  async updateResource(id: string, dto: UpdateResourceDto) {
    const resource = await this.prisma.resource.findUnique({ where: { id } });
    if (!resource) throw new NotFoundException('Resource not found');
    return this.prisma.resource.update({
      where: { id },
      data: dto,
      include: { actions: true },
    });
  }

  async deleteResource(id: string) {
    const resource = await this.prisma.resource.findUnique({ where: { id } });
    if (!resource) throw new NotFoundException('Resource not found');
    if (resource.isBuiltIn)
      throw new ForbiddenException('Built-in resources cannot be deleted');
    return this.prisma.resource.update({
      where: { id },
      data: { voided: true },
    });
  }

  async restoreResource(id: string) {
    return this.prisma.resource.update({
      where: { id },
      data: { voided: false },
    });
  }

  // ─── Resource Actions ─────────────────────────────────────────────────────

  async listActions(resourceId: string) {
    return this.prisma.resourceAction.findMany({
      where: { resourceId, voided: false },
      orderBy: { name: 'asc' },
    });
  }

  async createAction(resourceId: string, dto: CreateResourceActionDto) {
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
    });
    if (!resource) throw new NotFoundException('Resource not found');
    return this.prisma.resourceAction.create({ data: { ...dto, resourceId } });
  }

  async updateAction(id: string, dto: UpdateResourceActionDto) {
    const action = await this.prisma.resourceAction.findUnique({
      where: { id },
    });
    if (!action) throw new NotFoundException('Action not found');
    return this.prisma.resourceAction.update({ where: { id }, data: dto });
  }

  async deleteAction(id: string) {
    const action = await this.prisma.resourceAction.findUnique({
      where: { id },
    });
    if (!action) throw new NotFoundException('Action not found');
    if (action.isBuiltIn)
      throw new ForbiddenException('Built-in actions cannot be deleted');
    return this.prisma.resourceAction.update({
      where: { id },
      data: { voided: true },
    });
  }

  async restoreAction(id: string) {
    return this.prisma.resourceAction.update({
      where: { id },
      data: { voided: false },
    });
  }

  // ─── Roles ───────────────────────────────────────────────────────────────────

  async listRoles(query: QueryRolesDto) {
    const where = {
      voided: query.includeVoided ? undefined : false,
      ...(query.search
        ? {
            OR: [
              {
                name: { contains: query.search, mode: 'insensitive' as const },
              },
              {
                slug: { contains: query.search, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
    };
    const [results, totalCount] = await Promise.all([
      this.prisma.role.findMany({
        where,
        include: {
          permissions: {
            include: { resource: true, resourceAction: true },
          },
        },
        orderBy: { name: 'asc' },
        skip:
          query.page && query.limit
            ? (query.page - 1) * query.limit
            : undefined,
        take: query.limit,
      }),
      this.prisma.role.count({ where }),
    ]);
    return { results, totalCount };
  }

  async findRole(id: string) {
    const roleRecord = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: { resource: true, resourceAction: true },
        },
      },
    });
    if (!roleRecord) throw new NotFoundException('Role not found');
    return roleRecord;
  }

  async createRole(dto: CreateRoleDto) {
    const created = await this.prisma.role.create({
      data: dto,
      include: { permissions: true },
    });
    this.liveRoles[created.slug] = role({} as any);
    return created;
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    const roleRecord = await this.prisma.role.findUnique({ where: { id } });
    if (!roleRecord) throw new NotFoundException('Role not found');
    return this.prisma.role.update({
      where: { id },
      data: dto,
      include: { permissions: true },
    });
  }

  async deleteRole(id: string) {
    const roleRecord = await this.prisma.role.findUnique({ where: { id } });
    if (!roleRecord) throw new NotFoundException('Role not found');
    if (!roleRecord.canDelete)
      throw new ForbiddenException('This role cannot be deleted');
    const deleted = await this.prisma.role.update({
      where: { id },
      data: { voided: true },
    });
    delete this.liveRoles[roleRecord.slug];
    return deleted;
  }

  async restoreRole(id: string) {
    const restored = await this.prisma.role.update({
      where: { id },
      data: { voided: false },
      include: {
        permissions: { include: { resource: true, resourceAction: true } },
      },
    });
    this.syncRoleToMemory(restored.slug, restored.permissions);
    return restored;
  }

  // ─── Role Permissions ────────────────────────────────────────────────────────

  async setRolePermissions(roleId: string, dto: SetRolePermissionsDto) {
    const roleRecord = await this.prisma.role.findUnique({
      where: { id: roleId },
    });
    if (!roleRecord) throw new NotFoundException('Role not found');
    if (!roleRecord.canEditPermissions) {
      throw new ForbiddenException(
        'Permissions for this role are managed automatically',
      );
    }

    const actions = await this.prisma.resourceAction.findMany({
      where: { id: { in: dto.resourceActionIds }, voided: false },
      include: { resource: true },
    });

    if (actions.length !== dto.resourceActionIds.length) {
      throw new NotFoundException(
        'One or more resource actions not found or voided',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.rolePermission.createMany({
        data: actions.map((action) => ({
          roleId,
          resourceId: action.resourceId,
          resourceActionId: action.id,
        })),
      });
      return tx.role.findUnique({
        where: { id: roleId },
        include: {
          permissions: { include: { resource: true, resourceAction: true } },
        },
      });
    });
    if (updated) this.syncRoleToMemory(roleRecord.slug, updated.permissions);
    return updated;
  }
}
