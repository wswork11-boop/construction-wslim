export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function parseSort(
  sortStr: string | undefined,
  allowedFields: string[],
  defaultField = 'createdAt',
  defaultDir: 'asc' | 'desc' = 'desc',
): Record<string, 'asc' | 'desc'> {
  if (!sortStr) {
    return { [defaultField]: defaultDir };
  }
  const desc = sortStr.startsWith('-');
  const rawField = desc ? sortStr.slice(1) : sortStr.startsWith('+') ? sortStr.slice(1) : sortStr;
  const field = allowedFields.includes(rawField) ? rawField : defaultField;
  return { [field]: desc ? 'desc' : 'asc' };
}
