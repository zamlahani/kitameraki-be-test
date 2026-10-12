import type { SqlParameter } from '@azure/cosmos';
import { HttpError } from './errors';
import { TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus } from '../models/taskModel';

export interface ListTasksQuery {
  organizationId: string;
  q?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  tag?: string;
  page: number;
  pageSize: number;
}

export interface TaskListQueryPlan {
  listSql: string;
  countSql: string;
  parameters: SqlParameter[];
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

const MAX_SEARCH_LENGTH = 200;
const MAX_TAG_LENGTH = 50;

export function parseListTasksQuery(params: URLSearchParams): Omit<ListTasksQuery, 'organizationId'> {
  return {
    q: parseOptionalText(params.get('q'), MAX_SEARCH_LENGTH, 'q'),
    status: parseEnum(params.get('status'), TASK_STATUSES, 'status'),
    priority: parseEnum(params.get('priority'), TASK_PRIORITIES, 'priority'),
    tag: parseOptionalText(params.get('tag'), MAX_TAG_LENGTH, 'tag'),
    page: parseInteger(params.get('page'), 1, 1, Number.MAX_SAFE_INTEGER, 'page'),
    pageSize: parseInteger(params.get('pageSize'), DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE, 'pageSize'),
  };
}

export function planListTasksQuery(query: ListTasksQuery): TaskListQueryPlan {
  const conditions = ['c.organizationId = @organizationId'];
  const parameters: SqlParameter[] = [{ name: '@organizationId', value: query.organizationId }];

  if (query.q) {
    conditions.push('(CONTAINS(LOWER(c.title), @q) OR CONTAINS(LOWER(c.description), @q) OR ARRAY_CONTAINS(c.tags, @q))');
    parameters.push({ name: '@q', value: query.q.toLowerCase() });
  }

  if (query.status) {
    conditions.push('c.status = @status');
    parameters.push({ name: '@status', value: query.status });
  }

  if (query.priority) {
    conditions.push('c.priority = @priority');
    parameters.push({ name: '@priority', value: query.priority });
  }

  if (query.tag) {
    conditions.push('ARRAY_CONTAINS(c.tags, @tag)');
    parameters.push({ name: '@tag', value: query.tag });
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const offset = (query.page - 1) * query.pageSize;

  return {
    listSql: `SELECT * FROM c ${where} ORDER BY c.createdAt DESC, c.id ASC OFFSET ${offset} LIMIT ${query.pageSize}`,
    countSql: `SELECT VALUE COUNT(1) FROM c ${where}`,
    parameters,
  };
}

function parseOptionalText(value: string | null, maxLength: number, name: string): string | undefined {
  const text = value?.trim();
  if (!text) {
    return undefined;
  }
  if (text.length > maxLength) {
    throw new HttpError(400, `${name} must be at most ${maxLength} characters`);
  }
  return text;
}

function parseEnum<T extends readonly string[]>(
  value: string | null,
  allowed: T,
  name: string,
): T[number] | undefined {
  if (!value) {
    return undefined;
  }
  if (!allowed.includes(value)) {
    throw new HttpError(400, `${name} must be one of: ${allowed.join(', ')}`);
  }
  return value as T[number];
}

function parseInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
  name: string,
): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new HttpError(400, `${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}
