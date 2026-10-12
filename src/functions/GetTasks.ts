import { app } from '@azure/functions';
import { getTasksContainer } from '../shared/cosmos';
import { filterCustomFields } from '../shared/customFields';
import { loadFormSetting } from '../shared/formSetting';
import { handle, json } from '../shared/http';
import type { Task } from '../shared/taskModel';
import { resolveOrganizationId } from '../shared/identity';
import { parseListTasksQuery, planListTasksQuery } from '../shared/taskQuery';

app.http('GetTasks', {
  methods: ['GET'],
  route: 'tasks',
  handler: handle(async (request) => {
    const organizationId = resolveOrganizationId(request);
    const query = { ...parseListTasksQuery(request.query), organizationId };
    const plan = planListTasksQuery(query);
    const container = await getTasksContainer();

    const [countResult, pageResult, setting] = await Promise.all([
      container.items.query<number>({ query: plan.countSql, parameters: plan.parameters }).fetchAll(),
      container.items.query<Task>({ query: plan.listSql, parameters: plan.parameters }).fetchNext(),
      loadFormSetting(organizationId),
    ]);

    return json(200, {
      items: pageResult.resources.map((task) => ({
        ...task,
        customFields: filterCustomFields(setting, task.customFields),
      })),
      total: countResult.resources[0] ?? 0,
    });
  }),
});
