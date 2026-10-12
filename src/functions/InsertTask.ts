import { randomUUID } from 'node:crypto';
import { app } from '@azure/functions';
import { getTasksContainer } from '../shared/cosmos';
import { validateCustomFields } from '../shared/customFields';
import { loadFormSetting } from '../shared/formSetting';
import { handle, json, readJsonBody } from '../shared/http';
import type { CreateTaskInput, Task } from '../shared/taskModel';
import { resolveOrganizationId } from '../shared/identity';
import { validateCreateTask } from '../shared/validation';

app.http('InsertTask', {
  methods: ['POST'],
  route: 'tasks',
  handler: handle(async (request) => {
    const input = validateCreateTask(await readJsonBody(request)) as unknown as CreateTaskInput;
    const organizationId = resolveOrganizationId(request);
    const setting = await loadFormSetting(organizationId);

    const { customFields: rawCustomFields, ...rest } = input;
    const customFields = validateCustomFields(setting, rawCustomFields, { enforceRequired: true });

    const container = await getTasksContainer();
    const task: Task = {
      ...rest,
      ...(Object.keys(customFields).length > 0 ? { customFields } : {}),
      organizationId,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const { resource } = await container.items.create<Task>(task);

    return json(201, resource);
  }),
});
