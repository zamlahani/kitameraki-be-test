import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { HttpError } from './errors';

export type HttpHandler = (request: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;

export function json(status: number, body: unknown): HttpResponseInit {
  return { status, jsonBody: body };
}

export function handle(handler: HttpHandler): HttpHandler {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof HttpError) {
        return json(error.status, {
          error: error.message,
          ...(error.details ? { details: error.details } : {}),
        });
      }

      if (isCosmosNotFound(error)) {
        return json(404, { error: 'Not found' });
      }

      context.error(error);
      return json(500, { error: 'Internal server error' });
    }
  };
}

const MAX_BODY_BYTES = 256 * 1024;

export async function readJsonBody(request: HttpRequest): Promise<unknown> {
  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new HttpError(413, 'Request body is too large');
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON');
  }
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    throw new HttpError(413, 'Request body is too large');
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON');
  }
}

export function isCosmosNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 404;
}
