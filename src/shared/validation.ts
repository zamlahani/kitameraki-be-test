import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { HttpError } from './errors';
import taskSchema from '../../task.schema.json';
import formSettingSchema from '../../formSetting.schema.json';
import type { FormRow } from '../models/formSettingModel';

type JsonObject = Record<string, unknown>;

const EDITABLE_FIELDS = ['title', 'description', 'dueDate', 'priority', 'status', 'tags', 'customFields'] as const;

function compileSchemas(): { create: ValidateFunction; update: ValidateFunction } {
  const base = taskSchema as JsonObject;
  const baseProperties = (base.properties ?? {}) as JsonObject;

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

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
let formSchema: ValidateFunction | undefined;

function getSchemas(): ReturnType<typeof compileSchemas> {
  schemas ??= compileSchemas();
  return schemas;
}

function compileFormSchema(): ValidateFunction {
  const base = formSettingSchema as JsonObject;
  const baseProperties = (base.properties ?? {}) as JsonObject;

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  return ajv.compile({
    type: 'object',
    properties: { rows: baseProperties.rows },
    required: ['rows'],
    additionalProperties: false,
  });
}

function getFormSchema(): ValidateFunction {
  formSchema ??= compileFormSchema();
  return formSchema;
}

function formatErrors(validate: ValidateFunction): string[] {
  return (validate.errors ?? []).map((error) => {
    const location = error.instancePath || (error.params as { missingProperty?: string }).missingProperty || 'body';
    return `${location} ${error.message ?? 'is invalid'}`;
  });
}

export function validateCreateTask(body: unknown): JsonObject {
  const validate = getSchemas().create;
  if (!validate(body)) {
    throw new HttpError(400, 'Invalid task payload', formatErrors(validate));
  }
  return body as JsonObject;
}

export function validateUpdateTask(body: unknown): JsonObject {
  const validate = getSchemas().update;
  if (!validate(body)) {
    throw new HttpError(400, 'Invalid task payload', formatErrors(validate));
  }
  return body as JsonObject;
}

export function validateFormSetting(body: unknown): { rows: FormRow[] } {
  const validate = getFormSchema();
  if (!validate(body)) {
    throw new HttpError(400, 'Invalid form setting payload', formatErrors(validate));
  }

  const rows = (body as { rows: FormRow[] }).rows.map((row) => ({
    ...row,
    fields: row.fields.map((field) => ({ ...field, deletedAt: null })),
  }));

  const fieldIds = rows.flatMap((row) => row.fields.map((field) => field.id));
  if (new Set(fieldIds).size !== fieldIds.length) {
    throw new HttpError(400, 'Invalid form setting payload', ['field ids must be unique across the form']);
  }

  return { rows };
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
