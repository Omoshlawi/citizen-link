/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
export function mergeBetterAuthSchema(hiveDoc: any, betterAuthSchema: any) {
  const merged = { ...hiveDoc };

  // Prefix all Better Auth paths with "/api/auth/"
  if (betterAuthSchema.paths) {
    const prefixedPaths: Record<string, any> = {};
    for (const [path, value] of Object.entries(betterAuthSchema.paths)) {
      prefixedPaths[`/api/auth${path.startsWith('/') ? path : `/${path}`}`] =
        value;
    }
    betterAuthSchema.paths = prefixedPaths;
  }

  // Merge paths
  merged.paths = {
    ...merged.paths,
    ...betterAuthSchema.paths,
  };

  // Merge components (schemas, security schemes, etc.)
  merged.components = {
    ...merged.components,
    schemas: {
      ...merged.components?.schemas,
      ...betterAuthSchema.components?.schemas,
    },
    securitySchemes: {
      ...merged.components?.securitySchemes,
      ...betterAuthSchema.components?.securitySchemes,
    },
    responses: {
      ...merged.components?.responses,
      ...betterAuthSchema.components?.responses,
    },
    parameters: {
      ...merged.components?.parameters,
      ...betterAuthSchema.components?.parameters,
    },
    requestBodies: {
      ...merged.components?.requestBodies,
      ...betterAuthSchema.components?.requestBodies,
    },
  };

  // Merge tags for better organization
  merged.tags = [...(merged.tags || []), ...(betterAuthSchema.tags || [])];

  return merged;
}
