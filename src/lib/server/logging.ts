type LogValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly string[];

export type LogFields = Record<string, LogValue>;

export interface RequestLogger {
  info(event: string, fields?: LogFields): void;
  error(event: string, error: unknown, fields?: LogFields): void;
}

export function createRequestLogger(
  correlationId: string,
  requestContext: () => LogFields
): RequestLogger {
  function base(event: string, fields: LogFields) {
    return {
      timestamp: new Date().toISOString(),
      correlationId,
      ...requestContext(),
      event,
      ...fields
    };
  }

  return {
    info(event, fields = {}) {
      console.info(JSON.stringify({
        ...base(event, fields),
        level: 'info',
      }));
    },
    error(event, error, fields = {}) {
      console.error(JSON.stringify({
        ...base(event, fields),
        level: 'error',
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }));
    }
  };
}
