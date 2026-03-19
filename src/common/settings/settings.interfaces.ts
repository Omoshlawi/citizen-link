export type Primitive = string | number | boolean | null;
export type NestedObject = {
  [k: string]: Primitive | NestedObject | NestedArray;
};
export type NestedArray = (Primitive | NestedObject)[];
