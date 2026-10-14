import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { HttpError, formatValidationErrors } from '../infra/errors';
import taskSchema from '../../../task.schema.json';

type JsonObject = Record<string, unknown>;

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const EDITABLE_FIELDS = ['title', 'description', 'dueDate', 'priority', 'status', 'tags', 'customFields'] as const;

function compileSchemas(): { create: ValidateFunction; update: ValidateFunction } {
  const base = taskSchema as JsonObject;
  const baseProperties = (base.properties ?? {}) as JsonObject;

  const create: JsonObject = {
    ...base,
    required: ['title', 'status'],
  };

  const update: JsonObject = {
    type: 'object',
    properties: Object.fromEntries(EDITABLE_FIELDS.map((field) => [field, baseProperties[field]])),
    additionalProperties: false,
    minProperties: 1,
  };

  return {
    create: ajv.compile(create),
    update: ajv.compile(update),
  };
}

let schemas: ReturnType<typeof compileSchemas> | undefined;

function getSchemas(): ReturnType<typeof compileSchemas> {
  schemas ??= compileSchemas();
  return schemas;
}

export function validateCreateTask(body: unknown): JsonObject {
  const validate = getSchemas().create;
  if (!validate(body)) {
    throw new HttpError(400, 'Invalid task payload', formatValidationErrors(validate));
  }
  return body as JsonObject;
}

export function validateUpdateTask(body: unknown): JsonObject {
  const validate = getSchemas().update;
  if (!validate(body)) {
    throw new HttpError(400, 'Invalid task payload', formatValidationErrors(validate));
  }
  return body as JsonObject;
}

export function validateBulkDeleteBody(body: unknown): string[] {
  if (typeof body !== 'object' || body === null || !Array.isArray((body as { ids?: unknown }).ids)) {
    throw new HttpError(400, 'Body must contain an "ids" array');
  }

  const { ids } = body as { ids: unknown[] };
  if (ids.length === 0) {
    throw new HttpError(400, '"ids" must not be empty');
  }
  if (ids.length > 100) {
    throw new HttpError(400, '"ids" must contain at most 100 entries');
  }
  if (ids.some((id) => typeof id !== 'string' || id.trim() === '' || id.length > 128)) {
    throw new HttpError(400, '"ids" must only contain non-empty strings of at most 128 characters');
  }

  return ids as string[];
}
