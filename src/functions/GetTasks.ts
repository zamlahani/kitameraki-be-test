import { app } from '@azure/functions';
import { getTasksContainer } from '../shared/cosmos';
import { handle, json } from '../shared/http';
import type { Task } from '../shared/taskModel';
import { resolveOrganizationId } from '../shared/identity';
import { parseListTasksQuery, planListTasksQuery } from '../shared/taskQuery';

app.http('GetTasks', {
  methods: ['GET'],
  route: 'tasks',
  handler: handle(async (request) => {
    const query = { ...parseListTasksQuery(request.query), organizationId: resolveOrganizationId(request) };
    const plan = planListTasksQuery(query);
    const container = await getTasksContainer();

    const countResult = await container.items
      .query<number>({ query: plan.countSql, parameters: plan.parameters })
      .fetchAll();
    const total = countResult.resources[0] ?? 0;

    const pageResult = await container.items
      .query<Task>({ query: plan.listSql, parameters: plan.parameters })
      .fetchNext();

    return json(200, {
      items: pageResult.resources,
      total,
    });
  }),
});
