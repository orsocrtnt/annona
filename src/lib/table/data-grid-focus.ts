export function getHighlightedPage(
  rowIds: string[],
  highlightedRowId: string | null | undefined,
  pageSize: number
) {
  if (!highlightedRowId || pageSize <= 0) return null;
  const index = rowIds.indexOf(highlightedRowId);
  return index < 0 ? null : Math.floor(index / pageSize);
}
