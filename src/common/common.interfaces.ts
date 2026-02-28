export type ResultSuccess<T> = {
  success: true;
  data: T;
};
export type ResultError<E = Error> = {
  success: false;
  error: E;
};

export type Results<T, E = Error> = ResultSuccess<T> | ResultError<E>;
