import type { Container } from '@azure/cosmos';
import { app } from '@azure/functions';
import { DEFAULT_FORM_SETTING_ID, type FormSetting } from '../models/formSettingModel';
import { getFormSettingsContainer } from '../shared/cosmos';
import { invalidateFormSetting, mergeFormSettingRows } from '../shared/formSetting';
import { handle, isCosmosNotFound, json, readJsonBody } from '../shared/http';
import { resolveOrganizationId } from '../shared/identity';
import { validateFormSetting } from '../shared/validation';

app.http('SaveFormSetting', {
  methods: ['PUT'],
  route: 'form-settings',
  handler: handle(async (request) => {
    const { rows } = validateFormSetting(await readJsonBody(request));
    const organizationId = resolveOrganizationId(request);
    const container = await getFormSettingsContainer();
    const stored = await readStored(container, organizationId);

    const now = new Date().toISOString();
    const setting: FormSetting = {
      id: DEFAULT_FORM_SETTING_ID,
      organizationId,
      rows: mergeFormSettingRows(stored, rows, now),
      createdAt: stored?.createdAt ?? now,
      updatedAt: now,
    };

    await container.items.upsert<FormSetting>(setting);
    invalidateFormSetting(organizationId);

    return json(200, setting);
  }),
});

async function readStored(container: Container, organizationId: string): Promise<FormSetting | undefined> {
  try {
    const { resource } = await container
      .item(DEFAULT_FORM_SETTING_ID, organizationId)
      .read<FormSetting>();
    return resource;
  } catch (error) {
    if (isCosmosNotFound(error)) {
      return undefined;
    }
    throw error;
  }
}
