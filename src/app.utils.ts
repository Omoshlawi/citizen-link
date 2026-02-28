import _ from 'lodash';
import { UserSession } from './auth/auth.types';
import dayjs from 'dayjs';
import { Results } from './common/common.interfaces';
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

export function nullToUndefined<T>(input: T): T {
  if (input === null) {
    return undefined as unknown as T;
  }

  // Arrays → map recursively
  if (Array.isArray(input)) {
    return input.map(nullToUndefined) as unknown as T;
  }

  // Plain objects → map recursively
  if (_.isPlainObject(input)) {
    return _.mapValues(input, (value) => nullToUndefined(value)) as T;
  }

  return input;
}

type SafeParseJsonOptions = {
  transformNullToUndefined?: boolean;
};

export const safeParseJson = <T, E = Error>(
  json: string,
  options: SafeParseJsonOptions = { transformNullToUndefined: false },
): Results<T, E> => {
  try {
    const data = JSON.parse(json);
    if (options.transformNullToUndefined) {
      return { success: true, data: nullToUndefined(data) };
    }
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error as E };
  }
};

export const isSuperUser = (user?: UserSession['user']) => {
  return !!user?.role?.includes('admin');
};

export function parseDate(
  dateString: string | undefined | null,
  defaultNow: boolean = false,
) {
  const date = dayjs(dateString);
  if (dateString && date.isValid()) return date.toDate();
  if (defaultNow) return dayjs().toDate();
  return undefined;
}

export function normalizeString(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
    .normalize('NFD') // split accents
    .replace(/[\u0300-\u036f]/g, ''); // remove accents
}
