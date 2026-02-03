import { Injectable } from '@nestjs/common';
import { set } from 'lodash';

@Injectable()
export class SortService {
  static SORT_STRING_REGEX =
    /^-?[a-zA-Z_][a-zA-Z0-9_.]*(?:,-?[a-zA-Z_][a-zA-Z0-9_.]*)*$/;
  /**
   * Builds a sort query from a comma-separated string of field names.
   * Supports descending order with '-' prefix (e.g., "-createdAt,name,-updatedAt")
   * Supports nested fields with dot notation (e.g., "owner.user.name")
   *
   * @param queryString - Comma-separated field names, optionally prefixed with '-' for desc
   * @returns Object with orderBy property containing the parsed sort configuration
   */
  buildSortQuery(queryString?: string): Record<string, any> {
    if (!queryString?.trim()) {
      return {};
    }

    return {
      // NB:As at curr prisma version, you cant order by two fields in object, walk aroud is using array instead
      //   orderBy: this.parseFields(queryString),
      orderBy: this.parseFieldsToArr(queryString),
    };
  }

  private parseFields(queryString: string): Record<string, any> {
    const normalizedString = queryString.trim().replace(/\s+/g, '');
    const fields = normalizedString
      .split(',')
      .filter((field) => field.length > 0);

    const flatFields = fields.reduce<Record<string, 'asc' | 'desc'>>(
      (acc, field) => {
        const isDescending = field.startsWith('-');
        const fieldName = isDescending ? field.slice(1) : field;

        if (fieldName) {
          acc[fieldName] = isDescending ? 'desc' : 'asc';
        }

        return acc;
      },
      {},
    );

    return this.buildNestedObject(flatFields);
  }
  private parseFieldsToArr(queryString: string): Record<string, any> {
    const normalizedString = queryString.trim().replace(/\s+/g, '');
    const fields = normalizedString
      .split(',')
      .filter((field) => field.length > 0);

    return fields.map((field) => {
      if (field.startsWith('-')) {
        return this.buildNestedObject({ [field.slice(1)]: 'desc' });
      } else {
        return this.buildNestedObject({ [field]: 'asc' });
      }
    });
  }

  private buildNestedObject(
    flatFields: Record<string, 'asc' | 'desc'>,
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [path, sortOrder] of Object.entries(flatFields)) {
      set(result, path, sortOrder);
    }

    return result;
  }
}
