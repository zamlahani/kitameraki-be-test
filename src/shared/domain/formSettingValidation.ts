import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { HttpError } from '../infra/errors';
import formSettingSchema from '../../../formSetting.schema.json';
import type { FormRow } from '../../models/formSettingModel';

type JsonObject = Record<string, unknown>;

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

let formSchema: ValidateFunction | undefined;

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