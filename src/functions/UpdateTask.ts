import type { PatchOperation } from '@azure/cosmos';
import { app } from '@azure/functions';
import { getTasksContainer } from '../shared/infra/cosmos';
import { validateUpdateTask } from '../shared/domain/taskValidation';
import { loadFormSetting } from '../shared/domain/formSetting';
import { json, readJsonBody, withErrorBoundary } from '../shared/infra/http';
import type { Task } from '../models/taskModel';
import { resolveOrganizationId } from '../shared/infra/identity';
import { validateCustomFields } from "../shared/domain/customFieldValidation";

app.http('UpdateTask', {
  methods: ['PUT'],
  route: 'tasks/{id:guid}',
  handler: withErrorBoundary(async (request) => {
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
