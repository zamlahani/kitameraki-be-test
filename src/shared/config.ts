export interface AppConfig {
  cosmosConnectionString: string;
  cosmosDatabaseId: string;
  cosmosContainerId: string;
}

let cached: AppConfig | undefined;

export function getConfig(): AppConfig {
  if (cached) {
    return cached;
  }

  const cosmosConnectionString = process.env.COSMOS_CONNECTION_STRING;
  if (!cosmosConnectionString) {
    throw new Error('COSMOS_CONNECTION_STRING is not configured');
  }

  cached = {
    cosmosConnectionString,
    cosmosDatabaseId: process.env.COSMOS_DATABASE_ID ?? 'TaskApp',
    cosmosContainerId: process.env.COSMOS_CONTAINER_ID ?? 'Tasks',
  };
  return cached;
}
