import { app } from '@azure/functions';
import { getTasksContainer } from '../shared/cosmos';
import { handle } from '../shared/http';
import { resolveOrganizationId } from '../shared/identity';

app.http('DeleteTask', {
  methods: ['DELETE'],
  route: 'tasks/{id:guid}',
  handler: handle(async (request) => {
    const organizationId = resolveOrganizationId(request);
    const container = await getTasksContainer();

    await container.item(request.params.id, organizationId).delete();
    return { status: 204 };
  }),
});
