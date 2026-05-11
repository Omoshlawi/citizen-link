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
  /**
   * Automatically injects Prisma `omit` clauses for sensitive fields whenever a
   * matched relation appears in the query — whether the caller used a nested
   * `select` / `include` or referenced the relation as a bare field.
   *
   * Key:   glob pattern matched against the relation's **raw** accessor path
   *        (including the `custom` prefix and any operation keyword).
   *        e.g. `**.verifications`, `custom.select.user`
   * Value: field names to omit on that relation.
   *
   * The omit is skipped for a field when the caller already named it explicitly
   * inside a nested `select` — in that case `denyPatterns` is the right guard.
   *
   * @example
   * autoOmit: {
   *   '**.verifications': ['code', 'token'],
   *   '**.user':          ['passwordHash', 'twoFactorSecret'],
   * }
   */
  autoOmit?: Record<string, string[]>;
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

      if (current) fields.push(current.trim());

      return fields;
    };

    const buildPaths = (prefix: string, query: string): string[] => {
      const results: string[] = [];
      const match = query.match(/^\s*(\w+)\s*:\s*(\w+)\s*\((.*)\)\s*$/);

      if (match) {
        const [, key, type, fields] = match.map((s) => s.trim());
        const newPrefix = `${prefix}.${key}.${type}`;
        for (const field of splitFields(fields)) {
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
      (s) => s.trim(),
    );

    const topLevelPrefix = `${topLevelKey}.${topLevelType}`;
    const accessors: string[] = [];

    for (const field of splitFields(topLevelFields)) {
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

    return new RegExp(`^${regexPattern}$`).test(path);
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
        !allowPatterns.some((p) => this.matchesPattern(path, p))
      ) {
        return false;
      }

      // deny overrides allow
      if (denyPatterns.some((p) => this.matchesPattern(path, p))) {
        return false;
      }

      return true;
    });
  }

  /**
   * Injects synthetic `omit` paths for relations matched by `autoOmit` patterns.
   *
   * Handles three cases:
   *   1. Bare leaf:
   *      `custom.select.verifications`
   *        → injects `custom.select.verifications.omit.<field>`
   *
   *   2. Nested select:
   *      `custom.select.verifications.select.id`
   *        → skipped; caller was explicit about scalar fields, use `denyPatterns`
   *
   *   3. Nested include:
   *      `custom.select.verifications.include.exchange`
   *        → injects `custom.select.verifications.omit.<field>`
   *          because `include` expands the relation but does not restrict
   *          the relation's own scalar fields.
   *
   * A path is only treated as a bare leaf when no other accessor in the list
   * starts with `accessor + '.'` — this prevents intermediate segments like
   * `custom.select.verifications` from being treated as leaves when
   * `custom.select.verifications.select.id` is also present.
   */
  private applyAutoOmit(
    accessors: string[],
    options?: RepresentationOptions,
  ): string[] {
    const autoOmit = options?.autoOmit;
    if (!autoOmit || Object.keys(autoOmit).length === 0) {
      return accessors;
    }

    const injected = new Set<string>(accessors);

    for (const accessor of accessors) {
      const segments = accessor.split('.');

      // -------------------------------------------------------------------------
      // Case 3: Nested include traversal
      //
      // Walk every prefix of the path looking for a relation segment immediately
      // followed by `include`. When found, inject omit guards on that relation
      // since `include` expands all scalar fields but does not restrict them.
      //
      // Prefixes followed by `select` or `omit` are skipped — the caller was
      // explicit about scalar fields in those cases.
      // -------------------------------------------------------------------------
      for (let i = 0; i < segments.length - 1; i++) {
        const nextSegment = segments[i + 1];
        const isOperation =
          nextSegment === 'include' ||
          nextSegment === 'select' ||
          nextSegment === 'omit';

        if (!isOperation) continue;

        // Explicit nested select / omit → caller controls scalar fields
        if (nextSegment !== 'include') continue;

        const relationPath = segments.slice(0, i + 1).join('.');

        for (const [pattern, fieldsToOmit] of Object.entries(autoOmit)) {
          if (!this.matchesPattern(relationPath, pattern)) continue;

          for (const field of fieldsToOmit) {
            injected.add(`${relationPath}.omit.${field}`);
          }
        }
      }

      // -------------------------------------------------------------------------
      // Case 1 & 2: Bare leaf guard
      //
      // Only proceed when this accessor has no deeper children in the list.
      // If another accessor starts with `accessor + '.'`, this path is an
      // intermediate node (case 2) and omit injection is skipped entirely —
      // the nested operation that follows determines the correct handling above.
      // -------------------------------------------------------------------------
      const hasNestedChildren = accessors.some(
        (other) => other !== accessor && other.startsWith(accessor + '.'),
      );

      if (hasNestedChildren) continue;

      for (const [pattern, fieldsToOmit] of Object.entries(autoOmit)) {
        if (!this.matchesPattern(accessor, pattern)) continue;

        for (const field of fieldsToOmit) {
          injected.add(`${accessor}.omit.${field}`);
        }
      }
    }

    return [...injected];
  }

  /**
   * Parses the DSL string, filters the resulting paths through `options`, then
   * reduces them to a `{ prismaPath: true }` map ready for `lodash.set`.
   * The leading `custom.` segment is stripped at this stage so the keys align
   * with Prisma's `include` / `select` shape.
   */
  private buildAccessorMap(v: string, options?: RepresentationOptions) {
    const accessors = this.parseAccessors(v);
    const filtered = this.filterAccessors(accessors, options);
    const withOmits = this.applyAutoOmit(filtered, options);

    return withOmits.reduce<Record<string, boolean>>((acc, accessor) => {
      acc[
        accessor.replace(
          `${CustomRepresentationService.REPRESENTATION_KEY}.`,
          '',
        )
      ] = true;
      return acc;
    }, {});
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
   *
   * @example — auto-omit sensitive fields on bare relations
   * this.representation.buildCustomRepresentationQuery(query.v, {
   *   autoOmit: {
   *     '**.verifications': ['code', 'token'],
   *     '**.user':          ['passwordHash', 'twoFactorSecret'],
   *   },
   * })
   */
  buildCustomRepresentationQuery(
    queryString?: string,
    options?: RepresentationOptions,
  ) {
    if (
      queryString?.startsWith(
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
