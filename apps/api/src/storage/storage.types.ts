export const FILE_STORAGE = Symbol('FILE_STORAGE');

/**
 * File storage contract. Development uses local disk (served at /uploads);
 * production can swap in an S3/GCS implementation without touching callers.
 */
export interface FileStorage {
  /** Persists the buffer and returns its public relative path (/uploads/…). */
  save(params: { buffer: Buffer; directory: string; extension: string }): Promise<string>;
  /** Best-effort removal; never throws for missing files. */
  remove(relativePath: string): Promise<void>;
}
