import { Ajv, ValidateFunction } from "ajv";
import { FormField, FormSetting } from "../../models/formSettingModel";
import { HttpError } from "../infra/errors";
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const VALUE_VALIDATORS: Record<FormField['type'], ValidateFunction> = {
  text: ajv.compile({ type: 'string', maxLength: 1000 }),
  email: ajv.compile({ type: 'string', format: 'email', maxLength: 254 }),
  date: ajv.compile({ type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }),
  datetime: ajv.compile({ type: 'string', format: 'date-time' }),
};

export function validateCustomFields(
  setting: FormSetting | undefined,
  input: Record<string, string> = {},
  options: { enforceRequired: boolean },
): Record<string, string> {
  const { active, deleted } = indexFields(setting);
  const values: Record<string, string> = {};

  for (const [id, raw] of Object.entries(input)) {
    if (deleted.has(id)) {
      continue;
    }
    const field = active.get(id);
    if (!field) {
      throw new HttpError(400, 'Invalid custom field value', [`unknown field: ${id}`]);
    }
    if (field.disabled) {
      throw new HttpError(400, 'Invalid custom field value', [`field is disabled: ${id}`]);
    }

    const value = raw.trim();
    if (!value) {
      continue;
    }

    const validate = VALUE_VALIDATORS[field.type];
    if (!validate(value)) {
      throw new HttpError(400, 'Invalid custom field value', [
        `${id}: ${validate.errors?.[0]?.message ?? 'is invalid'}`,
      ]);
    }
    values[id] = value;
  }

  if (options.enforceRequired) {
    for (const field of active.values()) {
      if (!field.disabled && field.required && !(field.id in values)) {
        throw new HttpError(400, 'Invalid task payload', [`missing required field: ${field.id}`]);
      }
    }
  }

  return values;
}

function indexFields(setting: FormSetting | undefined): {
  active: Map<string, FormField>;
  deleted: Set<string>;
} {
  const active = new Map<string, FormField>();
  const deleted = new Set<string>();

  for (const row of setting?.rows ?? []) {
    for (const field of row.fields) {
      if (field.deletedAt) {
        deleted.add(field.id);
      } else {
        active.set(field.id, field);
      }
    }
  }

  return { active, deleted };
}

export function filterCustomFields(
  setting: FormSetting | undefined,
  customFields: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!customFields) {
    return undefined;
  }

  const { active } = indexFields(setting);
  const filtered: Record<string, string> = {};
  for (const [id, value] of Object.entries(customFields)) {
    if (active.has(id)) {
      filtered[id] = value;
    }
  }

  return Object.keys(filtered).length > 0 ? filtered : undefined;
}