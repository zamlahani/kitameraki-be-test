import { CosmosClient, type Container } from '@azure/cosmos';
import { getConfig } from './config';

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 200;
const MAX_DELAY_MS = 2000;

let containerPromise: Promise<Container> | undefined;
let formSettingsContainerPromise: Promise<Container> | undefined;

export function getTasksContainer(): Promise<Container> {
  if (!containerPromise) {
    containerPromise = createTasksContainer().catch((error) => {
      containerPromise = undefined;
      throw error;
    });
  }
  return containerPromise;
}

export function getFormSettingsContainer(): Promise<Container> {
  if (!formSettingsContainerPromise) {
    formSettingsContainerPromise = createFormSettingsContainer().catch((error) => {
      formSettingsContainerPromise = undefined;
      throw error;
    });
  }
  return formSettingsContainerPromise;
}

function isTransientCosmosError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'string') {
    return (
      code === 'ECONNREFUSED' ||
      code === 'ECONNRESET' ||
      code === 'ETIMEDOUT' ||
      code === 'ENOTFOUND' ||
      code === 'EAI_AGAIN'
    );
  }
  const status = (error as { statusCode?: unknown } | null)?.statusCode;
  return status === 429 || status === 503;
}

async function retryTransient<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS || !isTransientCosmosError(error)) {
        throw error;
      }
      const delay = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function createTasksContainer(): Promise<Container> {
  const { cosmosConnectionString, cosmosDatabaseId, cosmosContainerId } = getConfig();

  return retryTransient(async () => {
    const client = new CosmosClient(cosmosConnectionString);
    const { database } = await client.databases.createIfNotExists({ id: cosmosDatabaseId });
    const { container } = await database.containers.createIfNotExists({
      id: cosmosContainerId,
      partitionKey: { paths: ['/organizationId'] },
      indexingPolicy: {
        compositeIndexes: [
          [
            { path: '/createdAt', order: 'descending' },
            { path: '/id', order: 'ascending' },
          ],
        ],
      },
    });
    return container;
  });
}

async function createFormSettingsContainer(): Promise<Container> {
  const { cosmosConnectionString, cosmosDatabaseId, cosmosFormSettingsContainerId } = getConfig();

  return retryTransient(async () => {
    const client = new CosmosClient(cosmosConnectionString);
    const { database } = await client.databases.createIfNotExists({ id: cosmosDatabaseId });
    const { container } = await database.containers.createIfNotExists({
      id: cosmosFormSettingsContainerId,
      partitionKey: { paths: ['/organizationId'] },
    });
    return container;
  });
}
