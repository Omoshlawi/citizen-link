import { Injectable } from '@nestjs/common';
import { set } from 'lodash';

/**
 * Options for filtering which accessor paths are included in the built Prisma query.
 *
 * Patterns are glob-style strings matched against the **full raw accessor path**,
 * which includes the top-level key (`custom`) and any operation keywords
 * (`include`, `select`, `omit`) as dot-separated segments.
 *
 * Path anatomy:
 *   DSL: `custom:include(user:select(id, name))`
 *   Paths: `custom.include.user.select.id`, `custom.include.user.select.name`
 *
 * Glob tokens:
 *   `*`  — exactly one segment    e.g. `custom.include.user.*.*`
 *   `**` — any number of segments e.g. `**.passwordHash`
 */
export type RepresentationOptions = {
  /** Keep only paths matching at least one of these patterns. */
  allowPatterns?: string[];
  /**
   * Drop paths matching any of these patterns.
   * Takes priority over `allowPatterns` — a denied path is never included
   * even if it also matches an allow pattern.
   */
  denyPatterns?: string[];
};

@Injectable()
export class CustomRepresentationService {
  static REPRESENTATION_KEY = 'custom';

  /**
   * Parses a DSL string into flat dot-notation accessor paths.
   *
   * DSL format: `<key>:<operation>(<fields>)`
   * where `<key>` is always `custom`, `<operation>` is `include | select | omit`,
   * and `<fields>` is a comma-separated list of field names or nested DSL expressions.
   *
   * @example
   * parseAccessors('custom:include(user:select(id, address:include(city)), verifications)')
   * // Returns:
   * // [
   * //   'custom.include.user.select.id',
   * //   'custom.include.user.select.address.include.city',
   * //   'custom.include.verifications',
   * // ]
   */
  private parseAccessors(input: string): string[] {
    const splitFields = (fieldStr: string): string[] => {
      const fields: string[] = [];
      let current = '';
      let openBrackets = 0;

      for (const char of fieldStr) {
        if (char === '(') openBrackets++;
        if (char === ')') openBrackets--;

        if (char === ',' && openBrackets === 0) {
          fields.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }

      if (current) {
        fields.push(current.trim());
      }

      return fields;
    };

    const buildPaths = (prefix: string, query: string): string[] => {
      const results: string[] = [];

      const match = query.match(/^\s*(\w+)\s*:\s*(\w+)\s*\((.*)\)\s*$/);

      if (match) {
        const [, key, type, fields] = match.map((str) => str.trim());

        const newPrefix = `${prefix}.${key}.${type}`;

        const subFields = splitFields(fields);

        for (const field of subFields) {
          results.push(...buildPaths(newPrefix, field));
        }
      } else {
        results.push(`${prefix}.${query.trim()}`);
      }

      return results;
    };

    const topLevelMatch = input.match(/^\s*(\w+)\s*:\s*(\w+)\s*\((.*)\)\s*$/);

    if (!topLevelMatch) {
      throw new Error('Invalid custom string representation input format');
    }

    const [, topLevelKey, topLevelType, topLevelFields] = topLevelMatch.map(
      (str) => str.trim(),
    );

    const topLevelPrefix = `${topLevelKey}.${topLevelType}`;

    const fields = splitFields(topLevelFields);

    const accessors: string[] = [];

    for (const field of fields) {
      accessors.push(...buildPaths(topLevelPrefix, field));
    }

    return accessors;
  }

  /**
   * Tests a raw accessor path against a glob-style pattern.
   *
   * `*`  matches exactly one dot-separated segment (will not cross a `.`).
   * `**` matches any number of segments at any depth.
   *
   * @example
   * matchesPattern('custom.include.user.select.passwordHash', '**.passwordHash')      // true
   * matchesPattern('custom.include.user.select.id',           'custom.include.user.*.*') // true
   * matchesPattern('custom.include.verifications',            'custom.include.user.**')  // false
   */
  private matchesPattern(path: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\./g, '\\.')

      // protect **
      .replace(/\*\*/g, '__DOUBLE_WILDCARD__')

      // replace single *
      .replace(/\*/g, '[^.]+')

      // restore **
      .replace(/__DOUBLE_WILDCARD__/g, '.*');

    const regex = new RegExp(`^${regexPattern}$`);

    return regex.test(path);
  }

  /**
   * Filters raw accessor paths using the allow/deny pattern lists from `options`.
   *
   * A path survives the filter only when:
   *   1. It matches at least one `allowPattern` (or no allow patterns are specified), AND
   *   2. It matches none of the `denyPatterns`.
   *
   * Patterns are matched against the full raw path including the `custom` prefix and
   * all operation keywords — see {@link RepresentationOptions} for path anatomy and
   * glob token reference.
   */
  private filterAccessors(
    accessors: string[],
    options?: RepresentationOptions,
  ): string[] {
    const allowPatterns = options?.allowPatterns ?? [];
    const denyPatterns = options?.denyPatterns ?? [];

    return accessors.filter((path) => {
      // allow list check
      if (
        allowPatterns.length > 0 &&
        !allowPatterns.some((pattern) => this.matchesPattern(path, pattern))
      ) {
        return false;
      }

      // deny overrides allow
      if (denyPatterns.some((pattern) => this.matchesPattern(path, pattern))) {
        return false;
      }

      return true;
    });
  }

  /**
   * Parses the DSL string, filters the resulting paths through `options`, then
   * reduces them to a `{ prismaPath: true }` map ready for `lodash.set`.
   * The leading `custom.` segment is stripped at this stage so the keys align
   * with Prisma's `include` / `select` shape.
   */
  private buildAccessorMap(v: string, options?: RepresentationOptions) {
    const accessors = this.parseAccessors(v);
    const filteredAccessors = this.filterAccessors(accessors, options);

    return filteredAccessors.reduce<Record<string, boolean>>(
      (acc, accessor) => {
        acc[
          accessor.replace(
            `${CustomRepresentationService.REPRESENTATION_KEY}.`,
            '',
          )
        ] = true;

        return acc;
      },
      {},
    );
  }

  /**
   * Converts a `v=custom:…` DSL query string into a Prisma `include` / `select` object.
   *
   * Returns `{}` when `queryString` is absent or does not start with `custom:`,
   * so the result can always be safely spread into a Prisma `findMany` / `findFirst` call.
   *
   * The optional `options` parameter controls which accessor paths survive into the
   * final query — use it to enforce per-endpoint or per-role access boundaries:
   *
   * @example — deny sensitive fields globally
   * this.representation.buildCustomRepresentationQuery(query.v, {
   *   denyPatterns: ['**.passwordHash', '**.twoFactorSecret', '**.session**'],
   * })
   *
   * @example — whitelist a specific subtree
   * this.representation.buildCustomRepresentationQuery(query.v, {
   *   allowPatterns: ['custom.include.verifications', 'custom.include.foundCase.**'],
   * })
   *
   * @example — combine: allow a subtree, block sensitive leaves inside it
   * this.representation.buildCustomRepresentationQuery(query.v, {
   *   allowPatterns: ['custom.include.user.**'],
   *   denyPatterns:  ['**.passwordHash', '**.twoFactor**'],
   * })
   *
   * @example — condition-based (role-aware)
   * const denyPatterns = isAdmin
   *   ? ['**.passwordHash']
   *   : ['**.passwordHash', 'custom.**.user.**', 'custom.**.account.**'];
   * this.representation.buildCustomRepresentationQuery(query.v, { denyPatterns })
   */
  buildCustomRepresentationQuery(
    queryString?: string,
    options?: RepresentationOptions,
  ) {
    if (
      queryString &&
      queryString.startsWith(
        `${CustomRepresentationService.REPRESENTATION_KEY}:`,
      )
    ) {
      const flatRep = this.buildAccessorMap(queryString, options);

      const query: Record<string, any> = {};

      for (const [path, value] of Object.entries(flatRep)) {
        set(query, path, value);
      }

      return query;
    }

    return {};
  }
}
