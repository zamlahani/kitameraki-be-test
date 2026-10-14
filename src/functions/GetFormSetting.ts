import { app } from '@azure/functions';
import { DEFAULT_FORM_SETTING_ID } from '../models/formSettingModel';
import { activeFormSetting, loadFormSetting } from '../shared/domain/formSetting';
import { json, withErrorBoundary } from '../shared/infra/http';
import { resolveOrganizationId } from '../shared/infra/identity';

app.http('GetFormSetting', {
  methods: ['GET'],
  route: 'form-settings',
  handler: withErrorBoundary(async (request) => {
    const organizationId = resolveOrganizationId(request);
    const stored = await loadFormSetting(organizationId);

    if (!stored) {
      return json(200, { id: DEFAULT_FORM_SETTING_ID, organizationId, rows: [] });
    }

    return json(200, activeFormSetting(stored));
  }),
});
