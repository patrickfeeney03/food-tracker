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

export function withHash<TPath extends string>(
  path: TPath,
  hash: string
): `${TPath}#${string}` {
  return `${path}#${hash}`;
}

export function isUnmodifiedPrimaryClick(event: MouseEvent): boolean {
  return event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey;
}
