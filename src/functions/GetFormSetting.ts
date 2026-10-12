import { app } from '@azure/functions';
import { DEFAULT_FORM_SETTING_ID } from '../models/formSettingModel';
import { activeFormSetting, loadFormSetting } from '../shared/formSetting';
import { handle, json } from '../shared/http';
import { resolveOrganizationId } from '../shared/identity';

app.http('GetFormSetting', {
  methods: ['GET'],
  route: 'form-settings',
  handler: handle(async (request) => {
    const organizationId = resolveOrganizationId(request);
    const stored = await loadFormSetting(organizationId);

    if (!stored) {
      return json(200, { id: DEFAULT_FORM_SETTING_ID, organizationId, rows: [] });
    }

    return json(200, activeFormSetting(stored));
  }),
});
