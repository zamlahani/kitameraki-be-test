import type { ValidateFunction } from 'ajv';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: string[],
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function formatValidationErrors(validate: ValidateFunction): string[] {
  return (validate.errors ?? []).map((error) => {
    const path = error.instancePath.replace(/\//g, '.').replace(/^\./, '');
    const location = path || (error.params as { missingProperty?: string }).missingProperty || 'body';
    return `${location} ${error.message ?? 'is invalid'}`;
  });
}
