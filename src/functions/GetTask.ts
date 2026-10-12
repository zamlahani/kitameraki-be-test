import { app } from '@azure/functions';
import { getTasksContainer } from '../shared/cosmos';
import { filterCustomFields } from '../shared/customFields';
import { loadFormSetting } from '../shared/formSetting';
import { handle, json } from '../shared/http';
import type { Task } from '../shared/taskModel';
import { resolveOrganizationId } from '../shared/identity';

app.http('GetTask', {
  methods: ['GET'],
  route: 'tasks/{id:guid}',
  handler: handle(async (request) => {
    const organizationId = resolveOrganizationId(request);
    const container = await getTasksContainer();
    const setting = await loadFormSetting(organizationId);

    const { resource } = await container.item(request.params.id, organizationId).read<Task>();
    return json(200, {
      ...resource,
      customFields: filterCustomFields(setting, resource?.customFields),
    });
  }),
});
