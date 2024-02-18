import { WorkflowTask } from './task'

export enum FetchStrategy {
    Newest = 'LIFO',
    Oldest = 'FIFO',
}

export type Query = Partial<{ workflowType: string; taskName: string; strategy: FetchStrategy }>

export interface StateStore {
    upsertTask(newTask: WorkflowTask): Promise<void>

    tryFetchingTask(query: Query, timeoutMs: number): Promise<WorkflowTask | null>

    clearTask(id: WorkflowTask['id']): Promise<void>
}
