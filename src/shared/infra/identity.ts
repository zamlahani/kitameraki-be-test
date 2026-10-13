import type { HttpRequest } from '@azure/functions';
import { HttpError } from './errors';

const DEFAULT_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000001';

interface ClientPrincipal {
  claims?: Array<{ typ?: string; val?: string }>;
}

export function resolveOrganizationId(request: HttpRequest): string {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) {
    return process.env.ORGANIZATION_ID?.trim() || DEFAULT_ORGANIZATION_ID;
  }

  let principal: ClientPrincipal;
  try {
    principal = JSON.parse(Buffer.from(header, 'base64').toString('utf8')) as ClientPrincipal;
  } catch {
    throw new HttpError(400, 'Malformed client principal header');
  }

  const claim = principal.claims?.find((entry) => entry.typ === 'organizationId');
  if (!claim?.val) {
    throw new HttpError(403, 'Authenticated principal has no organization claim');
  }
  return claim.val;
}
