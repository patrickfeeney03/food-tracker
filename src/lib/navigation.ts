type QueryValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export function withQuery<TPath extends string>(
  path: TPath,
  values: Record<string, QueryValue>
): TPath | `${TPath}?${string}` {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  const query = searchParams.toString();

  return query === ''
    ? path
    : `${path}?${query}`;
}
