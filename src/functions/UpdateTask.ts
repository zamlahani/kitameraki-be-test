import type { PatchOperation } from '@azure/cosmos';
import { app } from '@azure/functions';
import { getTasksContainer } from '../shared/cosmos';
import { validateCustomFields } from '../shared/customFields';
import { loadFormSetting } from '../shared/formSetting';
import { handle, json, readJsonBody } from '../shared/http';
import type { Task } from '../models/taskModel';
import { resolveOrganizationId } from '../shared/identity';
import { validateUpdateTask } from '../shared/validation';

app.http('UpdateTask', {
  methods: ['PUT'],
  route: 'tasks/{id:guid}',
  handler: handle(async (request) => {
    const organizationId = resolveOrganizationId(request);
    const body = validateUpdateTask(await readJsonBody(request));
    const container = await getTasksContainer();

    const setting = 'customFields' in body ? await loadFormSetting(organizationId) : undefined;

    const operations: PatchOperation[] = Object.entries(body).map(([key, value]) => ({
      op: 'set',
      path: `/${key}`,
      value:
        key === 'customFields'
          ? validateCustomFields(setting, value as Record<string, string>, { enforceRequired: true })
          : value,
    }));

    const { resource } = await container.item(request.params.id, organizationId).patch<Task>(operations);
    return json(200, resource);
  }),
});
