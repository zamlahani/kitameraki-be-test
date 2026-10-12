import { app } from '@azure/functions';
import { DEFAULT_FORM_SETTING_ID, type FormSetting } from '../models/formSettingModel';
import { getFormSettingsContainer } from '../shared/cosmos';
import { handle, isCosmosNotFound, json } from '../shared/http';
import { resolveOrganizationId } from '../shared/identity';

app.http('GetFormSetting', {
  methods: ['GET'],
  route: 'form-settings',
  handler: handle(async (request) => {
    const organizationId = resolveOrganizationId(request);
    const container = await getFormSettingsContainer();

    try {
      const { resource } = await container
        .item(DEFAULT_FORM_SETTING_ID, organizationId)
        .read<FormSetting>();
      return json(200, resource);
    } catch (error) {
      if (!isCosmosNotFound(error)) {
        throw error;
      }
      return json(200, { id: DEFAULT_FORM_SETTING_ID, organizationId, rows: [] });
    }
  }),
});
