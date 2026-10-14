# Kitameraki Task API

Task management back end built with **TypeScript**, **Azure Functions (Node.js v4 programming model)** and **Azure Cosmos DB (NoSQL API)**. It is designed to be deployed to an Azure Function App.

## Endpoints

All routes are under the Functions prefix (`/api` locally). The organization (tenant) is **resolved from the caller's identity**, not from the request, it is never read from a query parameter or body, so clients do not send it (see [Security notes](#security-notes)).

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/tasks` | List tasks. Query: `q`, `status`, `priority`, `tag`, `page` (default 1), `pageSize` (default 20, max 100). Sorted by `createdAt` desc (`id` asc tiebreak). Returns `{ items, total }`. |
| `POST` | `/api/tasks` | Create a task. Body is validated against `task.schema.json`; `id` and `organizationId` are set server side. |
| `PUT` | `/api/tasks/{id}` | Update a task. Body accepts `title`, `description`, `dueDate`, `priority`, `status`, `tags`, `customFields`. |
| `DELETE` | `/api/tasks/{id}` | Delete a task. Returns `204`. |
| `POST` | `/api/tasks/bulk-delete` | Delete many tasks. Body `{ "ids": ["..."] }`; returns `{ "deleted": <n> }`. |
| `GET` | `/api/form-settings` | Get the organization's form setting (singleton). Soft-deleted fields and their empty rows are filtered out. Returns a default empty setting (`rows: []`) when none is stored. |
| `PUT` | `/api/form-settings` | Upsert the organization's form setting. Body `{ "rows": [{ "id", "fields": [1-2 fields] }] }`. A previously-active field omitted from the payload is soft-deleted (retained with `deletedAt`, not physically removed). |

### Form settings and custom fields

The form setting is one document per organization and applies to every task. It only declares **additional** fields; the built-in task properties from Part 1 stay fixed and come first. Each custom field has a stable `id` (its value key), a `type` (`text`, `date`, `datetime`, `email`), a `label`, `required`, `disabled` and `deletedAt`.

- Task values live in `customFields`, a sparse map keyed by field `id`.
- Writes (`POST`/`PUT /api/tasks`) load the current setting and reject (`400`) unknown field ids, values for `disabled` fields, type mismatches and missing `required` fields. Values for soft-deleted fields are ignored.
- Reads never expose values for soft-deleted or unknown fields.
- Deleting a field is soft: omit it from `PUT /api/form-settings` and it gets a `deletedAt`; re-sending the id reactivates it.

### Example

```bash
curl "http://localhost:7071/api/tasks?q=report&status=todo&page=1&pageSize=10"

curl -X POST "http://localhost:7071/api/tasks" -H "Content-Type: application/json" \
  -d '{"title":"Write report","status":"todo","priority":"high"}'
```

## Prerequisites

- Node.js 20, 22 or 24
- [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local#install-the-azure-functions-core-tools) (`npm i -g azure-functions-core-tools@4 --allow-scripts=azure-functions-core-tools`)
- Docker (for the Cosmos DB emulator)

## Run locally

1. **Start the Cosmos DB emulator** (Linux-based vNext container, NoSQL API in gateway mode):

   ```bash
   docker run --detach --name cosmos-emulator -p 8081:8081 -p 1234:1234 \
     mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:vnext-preview --protocol http
   ```

   The well-known emulator key is: `C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==`. Data Explorer: <http://localhost:1234>

2. **Create your local settings**:

   ```bash
   cp local.settings.sample.json local.settings.json
   ```

   Then fill `COSMOS_CONNECTION_STRING`. For the emulator above:

   ```
   AccountEndpoint=http://localhost:8081/;AccountKey=C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==;
   ```

   `local.settings.json` is git-ignored and must never be committed.

3. **Install, seed and start**:

   ```bash
   npm install
   npm run seed   # optional: inserts 40 sample tasks
   npm start      # builds and runs `func start` on http://localhost:7071
   ```

## Configuration

| Setting | Required | Default | Description |
| --- | --- | --- | --- |
| `COSMOS_CONNECTION_STRING` | yes | - | Cosmos DB connection string (emulator or Azure). |
| `COSMOS_DATABASE_ID` | no | `TaskApp` | Database name. |
| `COSMOS_CONTAINER_ID` | no | `Tasks` | Container name (partition key `/organizationId`). |
| `COSMOS_FORM_SETTINGS_CONTAINER_ID` | no | `FormSettings` | Form settings container name (partition key `/organizationId`). |
| `ORGANIZATION_ID` | no | `00000000-0000-0000-0000-000000000001` | Tenant used when no authenticated principal is present (local dev fallback). |

The database and container are created on first use, so no manual provisioning is required.

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Clean, build and run the Functions host. |
| `npm run build` | Compile TypeScript to `dist/`. |
| `npm run watch` | Compile on change. |
| `npm run seed` | Build and insert sample tasks. |
| `npm run typecheck` | Type-check without emitting. |
| `npm test` | Run unit tests (Vitest). |

## Project layout

```
src/
  functions/   # one file per HTTP function (registers itself via app.http)
  models/      # task & form setting document shapes
  shared/
    infra/     # config, cosmos client, http helpers, errors, identity
    domain/    # query builder, validation, form setting, custom fields
scripts/       # seed script
test/          # unit tests
task.schema.json   # single source of truth for the task shape
formSetting.schema.json   # single source of truth for the form setting shape
```

## Security notes

Improvements over the original implementation:

- No hard-coded secrets: the connection string comes from `COSMOS_CONNECTION_STRING`.
- The organization (tenant) is derived from the authenticated principal (the `x-ms-client-principal` header set by platform auth), falling back to `ORGANIZATION_ID` locally. Client-supplied `organizationId` is ignored, so a caller cannot read or mutate another organization's tasks.
- All Cosmos queries are parameterized; user input is never concatenated into SQL.
- Request bodies are validated against `task.schema.json` (AJV); unknown fields are rejected.
- Updates are limited to a whitelist of editable fields.
- Unexpected errors are logged and returned as a generic `500`; internal details never reach the client.
- Bulk deletes are awaited (the original `forEach(async ...)` returned before the deletes finished).

**Authentication.** The functions rely on the anonymous authorization level (the default in the Node.js v4 model) because a browser SPA cannot hold a secret and this project has no identity provider. In production, enforce authentication at the platform edge (Function App built-in authentication / API Management) and scope requests to the caller's `organizationId`. Function keys are intentionally not shipped to the client.
