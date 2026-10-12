import { app } from '@azure/functions';
import { getTasksContainer } from '../shared/cosmos';
import { handle, isCosmosNotFound, json, readJsonBody } from '../shared/http';
import { resolveOrganizationId } from '../shared/identity';
import { validateBulkDeleteBody } from '../shared/validation';

app.http('BulkDeleteTasks', {
  methods: ['POST'],
  route: 'tasks/bulk-delete',
  handler: handle(async (request) => {
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
