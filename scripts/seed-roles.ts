import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { adminPluginAcl } from '../src/auth/auth.acl';
import prisma from './prisma-instance';

declare const __dirname: string;

interface AclMetaEntry {
  name: string;
  description?: string;
}

interface AclMetadata {
  resources: Record<string, AclMetaEntry>;
  actions: Record<string, AclMetaEntry>;
}

interface RoleSeed {
  slug: string;
  name: string;
  description?: string;
  canDelete: boolean;
  canEditPermissions: boolean;
  allPermissions?: boolean;
  permissions: Array<{ resource: string; action: string }>;
}

interface RolesSeedFile {
  roles: RoleSeed[];
}

function toLabel(slug: string): string {
  return slug
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function seedRoles(): Promise<void> {
  const rolesPath = path.resolve(
    __dirname,
    '..',
    'assets',
    'json',
    'roles.json',
  );
  const metaPath = path.resolve(
    __dirname,
    '..',
    'assets',
    'json',
    'acl-metadata.json',
  );

  const { roles } = JSON.parse(
    fs.readFileSync(rolesPath, 'utf-8'),
  ) as RolesSeedFile;
  const metadata = JSON.parse(
    fs.readFileSync(metaPath, 'utf-8'),
  ) as AclMetadata;

  function getResourceMeta(slug: string): AclMetaEntry {
    return metadata.resources[slug] ?? { name: toLabel(slug) };
  }

  function getActionMeta(slug: string): AclMetaEntry {
    return metadata.actions[slug] ?? { name: toLabel(slug) };
  }

  await prisma.$connect();
  console.log('✅ Database connection established');

  // 1. Seed resources and actions derived from auth.acl.ts (single source of truth for slugs)
  console.log('Seeding resources and actions...');
  const statements = adminPluginAcl.statements as unknown as Record<
    string,
    string[]
  >;
  for (const [resourceSlug, actions] of Object.entries(statements)) {
    const { name, description } = getResourceMeta(resourceSlug);
    const resource = await prisma.resource.upsert({
      where: { slug: resourceSlug },
      update: { name, description: description ?? null, isBuiltIn: true },
      create: {
        name,
        slug: resourceSlug,
        description: description ?? null,
        isBuiltIn: true,
      },
    });

    for (const actionSlug of actions) {
      const { name: actionName, description: actionDesc } =
        getActionMeta(actionSlug);
      await prisma.resourceAction.upsert({
        where: {
          resourceId_slug: { resourceId: resource.id, slug: actionSlug },
        },
        update: {
          name: actionName,
          description: actionDesc ?? null,
          isBuiltIn: true,
        },
        create: {
          resourceId: resource.id,
          name: actionName,
          slug: actionSlug,
          description: actionDesc ?? null,
          isBuiltIn: true,
        },
      });
    }
    console.log(`  [+] ${resourceSlug} (${actions.length} actions)`);
  }

  // 2. Upsert roles and their permissions
  console.log('Seeding roles...');
  for (const roleDef of roles) {
    const roleRecord = await prisma.role.upsert({
      where: { slug: roleDef.slug },
      update: {
        name: roleDef.name,
        description: roleDef.description ?? null,
        canDelete: roleDef.canDelete,
        canEditPermissions: roleDef.canEditPermissions,
      },
      create: {
        name: roleDef.name,
        slug: roleDef.slug,
        description: roleDef.description ?? null,
        canDelete: roleDef.canDelete,
        canEditPermissions: roleDef.canEditPermissions,
      },
    });

    // Full replace of permissions
    await prisma.rolePermission.deleteMany({
      where: { roleId: roleRecord.id },
    });

    if (roleDef.allPermissions) {
      const allActions = await prisma.resourceAction.findMany({
        where: { voided: false },
        include: { resource: true },
      });
      for (const action of allActions) {
        await prisma.rolePermission.create({
          data: {
            roleId: roleRecord.id,
            resourceId: action.resourceId,
            resourceActionId: action.id,
          },
        });
      }
      console.log(
        `  [+] ${roleDef.slug} (${allActions.length} permissions — all)`,
      );
    } else {
      for (const perm of roleDef.permissions) {
        const resource = await prisma.resource.findUnique({
          where: { slug: perm.resource },
        });
        if (!resource) {
          console.warn(`  [!] Resource not found: ${perm.resource}`);
          continue;
        }
        const action = await prisma.resourceAction.findUnique({
          where: {
            resourceId_slug: { resourceId: resource.id, slug: perm.action },
          },
        });
        if (!action) {
          console.warn(
            `  [!] Action not found: ${perm.resource}:${perm.action}`,
          );
          continue;
        }
        await prisma.rolePermission.create({
          data: {
            roleId: roleRecord.id,
            resourceId: resource.id,
            resourceActionId: action.id,
          },
        });
      }
      console.log(
        `  [+] ${roleDef.slug} (${roleDef.permissions.length} permissions)`,
      );
    }
  }

  console.log('✅ Roles and resources seeded successfully');
}

seedRoles()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
