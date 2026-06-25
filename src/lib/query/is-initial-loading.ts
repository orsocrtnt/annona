/** True only on first fetch when no cached or initial data exists yet. */
export function isInitialQueryLoading(isLoading: boolean, data: unknown): boolean {
  return isLoading && data === undefined;
}
