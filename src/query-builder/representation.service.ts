import { Injectable } from '@nestjs/common';
import { set } from 'lodash';

@Injectable()
export class CustomRepresentationService {
  static REPRESENTATION_KEY = 'custom';
  /**
   * Parses a custom query string into an array of dot-notation accessor paths
   *
   * @param input - A string in the format "key:type(fields)" where type is 'select' or 'include' or any other operation
   * @returns Array of dot-notation paths
   * @throws {Error} If the input format is invalid
   *
   * @example
   * parseAccessors('user:select(name, profile:include(avatar, settings))');
   * // Returns:
   * // [
   * //   'user.select.name',
   * //   'user.select.profile.include.avatar',
   * //   'user.select.profile.include.settings'
   * // ]
   */
  private parseAccessors(input: string): string[] {
    // Helper function to split each level of the string while maintaining nesting
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

    // Recursive function to build accessor paths
    const buildPaths = (prefix: string, query: string): string[] => {
      const results: string[] = [];
      const match = query.match(/^\s*(\w+)\s*:\s*(\w+)\s*\((.*)\)\s*$/);

      if (match) {
        const [, key, type, fields] = match.map((str) => str.trim()); // Trim each part
        const newPrefix = `${prefix}.${key}.${type}`;
        const subFields = splitFields(fields);

        for (const field of subFields) {
          results.push(...buildPaths(newPrefix, field));
        }
      } else {
        results.push(`${prefix}.${query.trim()}`); // Trim the final field
      }

      return results;
    };

    // Starting point: remove the initial "custom:" and process the rest
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

  private buildAccessorMap(v: string) {
    const accessors = this.parseAccessors(v);
    return accessors.reduce((acc, accessor) => {
      acc[
        accessor.replace(
          `${CustomRepresentationService.REPRESENTATION_KEY}.`,
          '',
        )
      ] = true;
      return acc;
    }, {});
  }

  buildCustomRepresentationQuery(queryString?: string) {
    if (
      queryString &&
      queryString.startsWith(
        `${CustomRepresentationService.REPRESENTATION_KEY}:`,
      )
    ) {
      const flatRep = this.buildAccessorMap(queryString);
      const query: Record<string, any> = {};

      for (const [path, value] of Object.entries(flatRep)) {
        set(query, path, value);
      }
      return query;
    }
    return {};
  }
}
