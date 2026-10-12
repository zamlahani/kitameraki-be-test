import type { Container } from '@azure/cosmos';
import { app } from '@azure/functions';
import { DEFAULT_FORM_SETTING_ID, type FormSetting } from '../models/formSettingModel';
import { getFormSettingsContainer } from '../shared/cosmos';
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

    const now = new Date().toISOString();
    const setting: FormSetting = {
      id: DEFAULT_FORM_SETTING_ID,
      organizationId,
      rows,
      createdAt: (await readCreatedAt(container, organizationId)) ?? now,
      updatedAt: now,
    };

    const { resource } = await container.items.upsert<FormSetting>(setting);
    return json(200, resource);
  }),
});

async function readCreatedAt(container: Container, organizationId: string): Promise<string | undefined> {
  try {
    const { resource } = await container
      .item(DEFAULT_FORM_SETTING_ID, organizationId)
      .read<FormSetting>();
    return resource?.createdAt;
  } catch (error) {
    if (isCosmosNotFound(error)) {
      return undefined;
    }
    throw error;
  }
}
