import { app } from '@azure/functions';
import { getTasksContainer } from '../shared/infra/cosmos';
import { withErrorBoundary } from '../shared/infra/http';
import { resolveOrganizationId } from '../shared/infra/identity';

app.http('DeleteTask', {
  methods: ['DELETE'],
  route: 'tasks/{id:guid}',
  handler: withErrorBoundary(async (request) => {
    const organizationId = resolveOrganizationId(request);
    const container = await getTasksContainer();

    await container.item(request.params.id, organizationId).delete();
    return { status: 204 };
  }),
});
