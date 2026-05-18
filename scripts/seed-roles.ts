import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import prisma from './prisma-instance';

declare const __dirname: string;

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
  resources: Record<string, string[]>;
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
  const filePath = path.resolve(
    __dirname,
    '..',
    'assets',
    'json',
    'roles.json',
  );
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { resources, roles } = JSON.parse(raw) as RolesSeedFile;

  await prisma.$connect();
  console.log('✅ Database connection established');

  // 1. Upsert all resources and their actions
  console.log('Seeding resources and actions...');
  for (const [resourceSlug, actions] of Object.entries(resources)) {
    const resource = await prisma.resource.upsert({
      where: { slug: resourceSlug },
      update: { name: toLabel(resourceSlug), isBuiltIn: true },
      create: {
        name: toLabel(resourceSlug),
        slug: resourceSlug,
        isBuiltIn: true,
      },
    });

    for (const actionSlug of actions) {
      await prisma.resourceAction.upsert({
        where: {
          resourceId_slug: { resourceId: resource.id, slug: actionSlug },
        },
        update: { name: toLabel(actionSlug), isBuiltIn: true },
        create: {
          resourceId: resource.id,
          name: toLabel(actionSlug),
          slug: actionSlug,
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
      // Grant every active resource action
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
