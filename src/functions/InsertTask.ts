import { randomUUID } from 'node:crypto';
import { app } from '@azure/functions';
import { getTasksContainer } from '../shared/infra/cosmos';
import { validateCreateTask } from '../shared/domain/taskValidation';
import { loadFormSetting } from '../shared/domain/formSetting';
import { json, readJsonBody, withErrorBoundary } from '../shared/infra/http';
import type { CreateTaskInput, Task } from '../models/taskModel';
import { resolveOrganizationId } from '../shared/infra/identity';
import { validateCustomFields } from "../shared/domain/customFieldValidation";

app.http('InsertTask', {
  methods: ['POST'],
  route: 'tasks',
  handler: withErrorBoundary(async (request) => {
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
