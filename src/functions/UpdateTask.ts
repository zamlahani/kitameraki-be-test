import type { PatchOperation } from '@azure/cosmos';
import { app } from '@azure/functions';
import { getTasksContainer } from '../shared/cosmos';
import { handle, json, readJsonBody } from '../shared/http';
import type { Task } from '../shared/taskModel';
import { resolveOrganizationId } from '../shared/identity';
import { validateUpdateTask } from '../shared/validation';

app.http('UpdateTask', {
  methods: ['PUT'],
  route: 'tasks/{id:guid}',
  handler: handle(async (request) => {
    const organizationId = resolveOrganizationId(request);
    const body = validateUpdateTask(await readJsonBody(request));
    const container = await getTasksContainer();

    const operations: PatchOperation[] = Object.entries(body).map(([key, value]) => ({
      op: 'set',
      path: `/${key}`,
      value,
    }));

    const { resource } = await container.item(request.params.id, organizationId).patch<Task>(operations);
    return json(200, resource);
  }),
});
