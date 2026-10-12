import { randomUUID } from 'node:crypto';
import { app } from '@azure/functions';
import { getTasksContainer } from '../shared/cosmos';
import { handle, json, readJsonBody } from '../shared/http';
import type { CreateTaskInput, Task } from '../shared/taskModel';
import { resolveOrganizationId } from '../shared/identity';
import { validateCreateTask } from '../shared/validation';

app.http('InsertTask', {
  methods: ['POST'],
  route: 'tasks',
  handler: handle(async (request) => {
    const input = validateCreateTask(await readJsonBody(request)) as unknown as CreateTaskInput;
    const container = await getTasksContainer();

    const task: Task = {
      ...input,
      organizationId: resolveOrganizationId(request),
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const { resource } = await container.items.create<Task>(task);

    return json(201, resource);
  }),
});
