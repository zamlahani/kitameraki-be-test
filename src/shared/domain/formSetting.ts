import {
  DEFAULT_FORM_SETTING_ID,
  type FormField,
  type FormRow,
  type FormSetting,
} from '../../models/formSettingModel';
import { getFormSettingsContainer, isCosmosNotFound } from '../infra/cosmos';

const TTL_MS = 30_000;
const cache = new Map<string, { value: FormSetting | undefined; expiresAt: number }>();

export async function loadFormSetting(organizationId: string): Promise<FormSetting | undefined> {
  const cached = cache.get(organizationId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const container = await getFormSettingsContainer();
  let value: FormSetting | undefined;
  try {
    const { resource } = await container
      .item(DEFAULT_FORM_SETTING_ID, organizationId)
      .read<FormSetting>();
    value = resource;
  } catch (error) {
    if (!isCosmosNotFound(error)) {
      throw error;
    }
  }

  cache.set(organizationId, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}

export function invalidateFormSetting(organizationId: string): void {
  cache.delete(organizationId);
}

export function mergeFormSettingRows(
  stored: FormSetting | undefined,
  activeRows: FormRow[],
  now: string,
): FormRow[] {
  const activeIds = new Set(activeRows.flatMap((row) => row.fields.map((field) => field.id)));
  const result: FormRow[] = activeRows.map((row) => ({
    id: row.id,
    fields: row.fields.map((field) => ({ ...field, deletedAt: null })),
  }));
  const byId = new Map(result.map((row) => [row.id, row]));

  for (const row of stored?.rows ?? []) {
    for (const field of row.fields) {
      if (activeIds.has(field.id)) {
        continue;
      }
      const tombstone: FormField = { ...field, deletedAt: field.deletedAt ?? now };
      let host = byId.get(row.id);
      if (!host) {
        host = { id: row.id, fields: [] };
        byId.set(row.id, host);
        result.push(host);
      }
      host.fields.push(tombstone);
    }
  }

  return result;
}

export function activeFormSetting(setting: FormSetting): FormSetting {
  return {
    ...setting,
    rows: setting.rows
      .map((row) => ({ id: row.id, fields: row.fields.filter((field) => !field.deletedAt) }))
      .filter((row) => row.fields.length > 0),
  };
}
