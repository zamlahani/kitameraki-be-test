import { app } from '@azure/functions';
import { getTasksContainer, isCosmosNotFound } from '../shared/infra/cosmos';
import { json, readJsonBody, withErrorBoundary } from '../shared/infra/http';
import { resolveOrganizationId } from '../shared/infra/identity';
import { validateBulkDeleteBody } from '../shared/domain/taskValidation';

app.http('BulkDeleteTasks', {
  methods: ['POST'],
  route: 'tasks/bulk-delete',
  handler: withErrorBoundary(async (request) => {
    const organizationId = resolveOrganizationId(request);
    const ids = validateBulkDeleteBody(await readJsonBody(request));
    const container = await getTasksContainer();

    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          await container.item(id, organizationId).delete();
          return true;
        } catch (error) {
          if (isCosmosNotFound(error)) {
            return false;
          }
          throw error;
        }
      }),
    );

    return json(200, { deleted: results.filter(Boolean).length });
  }),
});
