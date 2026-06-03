/**
 * Minimal Fuse.js type declarations for the admin-frontend.
 * This file provides enough types to compile; it is replaced by the real
 * @types bundled inside fuse.js once `pnpm install` runs.
 */
declare module 'fuse.js' {
  export interface FuseOptionKey<T> {
    name: keyof T | string;
    weight?: number;
  }

  export interface IFuseOptions<T> {
    keys?: Array<string | FuseOptionKey<T>>;
    threshold?: number;
    includeScore?: boolean;
    ignoreLocation?: boolean;
    [key: string]: unknown;
  }

  export interface FuseResult<T> {
    item: T;
    score?: number;
  }

  class Fuse<T> {
    constructor(list: readonly T[], options?: IFuseOptions<T>);
    search(pattern: string): FuseResult<T>[];
  }

  export default Fuse;
}
