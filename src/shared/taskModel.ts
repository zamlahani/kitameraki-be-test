export const TASK_STATUSES = ['todo', 'in-progress', 'completed'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface Task {
  id: string;
  organizationId: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority?: TaskPriority;
  status: TaskStatus;
  tags?: string[];
  customFields?: Record<string, string>;
  createdAt: string;
}

export type CreateTaskInput = Omit<Task, 'id' | 'organizationId' | 'createdAt'>;
