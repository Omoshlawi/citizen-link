import { Primitive } from './settings.interfaces';
import { flattie } from 'flattie';
import { Setting } from '../../../generated/prisma/client';
import { nestie } from 'nestie';
export class SettingsUtils {
  /**
   * Auto coerce a value to a primitive
   * @param raw The raw string value from the database
   * @returns The coerced value
   * */
  static autoCoerce(raw: string): Primitive {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw === 'null') return null;
    const n = Number(raw);
    if (!isNaN(n) && raw.trim() !== '') return n;
    return raw;
  }

  /**
   * Serialize a value to a string
   * @param value
   * @returns
   */
  static serialize(value: unknown): string {
    if (value === null || value === undefined) return 'null';
    if (value instanceof Date) return value.toISOString();
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return String(value);
  }

  /**
   * Flatten settings and coerse the value
   * @param setting The settings to flatten
   * @param keyPrefix The prefix to strip from the keys
   * @param coerce Whether to coerce the values
   * @param includePrefix Whether to include the prefix in the keys
   * @returns
   */
  static flattenSettings(
    setting: Setting[],
    keyPrefix: string,
    coerce: boolean = true,
    includePrefix: boolean = false,
  ) {
    // Build a flat object from stored rows, stripping the prefix
    const strip = `${keyPrefix}.`.length;
    const flat: Record<string, any> = {};
    for (const row of setting) {
      flat[includePrefix ? row.key : row.key.slice(strip)] = coerce
        ? this.autoCoerce(row.value)
        : row.value;
    }
    return flat;
  }

  /**
   * Nest settings
   * @param setting The settings to nest
   * @param keyPrefix The prefix to strip from the keys
   * @param coerce Whether to coerce the values
   * @param includePrefix Whether to include the prefix in the keys
   * @returns The nested settings
   */
  static nestSettings(
    setting: Setting[],
    keyPrefix: string,
    coerce: boolean = true,
    includePrefix: boolean = false,
  ) {
    const flat = this.flattenSettings(
      setting,
      keyPrefix,
      coerce,
      includePrefix,
    );
    return nestie(flat);
  }

  /**
   * Flatten an object
   * @param obj The object to flatten
   * @param serialize Whether to serialize the values
   * @param keyPrefix The prefix to prepend to the keys
   * @returns The flattened object
   */
  static flattenObject(
    obj: Record<string, unknown>,
    keyPrefix?: string,
    serialize: boolean = true,
  ) {
    const flat = flattie(obj);
    if (serialize) {
      return Object.fromEntries(
        Object.entries(flat).map(([key, value]) => [
          keyPrefix ? `${keyPrefix}.${key}` : key,
          this.serialize(value),
        ]),
      );
    }
    return flat;
  }

  /**
   * Nest a flat object
   * @param flat The flat object to nest
   * @param coerce Whether to coerce the values
   * @returns The nested object
   */
  static nestFlatObject(flat: Record<string, unknown>, coerce: boolean = true) {
    if (coerce) {
      return nestie(
        Object.fromEntries(
          Object.entries(flat).map(([key, value]) => [
            key,
            coerce && typeof value === 'string'
              ? this.autoCoerce(value)
              : value,
          ]),
        ),
      );
    }
    return nestie(flat);
  }
}
