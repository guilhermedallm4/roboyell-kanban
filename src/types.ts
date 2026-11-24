export type Status = 'backlog' | 'analysis' | 'todo' | 'doing' | 'review' | 'done';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type TaskType = 'feature' | 'bugfix' | 'improvement' | 'refactor' | 'research' | 'docs' | 'chore';
export type TeamId = 'ai' | 'frontend' | 'backend' | 'devops' | 'embedded' | 'qa' | 'design' | 'data' | 'product';

/** Where a field value came from: the classifier, or a person. */
export type FieldSource = 'auto' | 'manual';

export interface Task {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  type: TaskType;
  status: Status;
  team: TeamId;
  teamSource: FieldSource;
  assignee?: string;
  dueDate?: string; // yyyy-mm-dd
  createdAt: number;
  updatedAt: number;
}

export interface BoardState {
  tasks: Record<string, Task>;
  /** Ordered task ids for each column. Source of truth for ordering. */
  columns: Record<Status, string[]>;
  /** Tombstones (id → deletion time) so a sync merge never brings deleted tasks back. */
  deleted?: Record<string, number>;
  /** Last local change to the board (used to pick column ordering when merging). */
  updatedAt?: number;
}

export interface Filters {
  query: string;
  teams: TeamId[];
  severities: Severity[];
  types: TaskType[];
}

export type TaskDraft = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>;
