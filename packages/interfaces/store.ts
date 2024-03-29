import { WorkflowTask } from './task'

export enum FetchStrategy {
    Newest = 'LIFO',
    Oldest = 'FIFO',
    Random = 'Random',
}

export type Query = Partial<{ workflowType: string; taskName: string }>

export interface StateStore {
    /**
     * Creates a new task.
     */
    insertTask(newTask: WorkflowTask): Promise<void>

    /**
     * Updates a task by its instance id and task name.
     * Rejects if the task with the specific search criteria was not found.
     */
    updateTaskBy(fromTaskName: string, task: WorkflowTask): Promise<void>

    /**
     * Try fetching any task fitting the query, then by the fetch strategy
     */
    tryFetchingTask(query: Query, strategy: FetchStrategy, timeoutMs: number): Promise<WorkflowTask | null>

    /**
     * Remove the task from state. This may be implemented as a soft deletion.
     */
    clearTask(id: WorkflowTask['instanceId']): Promise<void>

    /**
     * Register the task as unrecoverable and remove it from the list of waiting tasks.
     */
    registerUnrecoverable(task: WorkflowTask): Promise<void>

    /**
     * Recover a maximum number of tasks by query,
     * removing them from the list of unrecoverable tasks and adding them back into the list of waiting tasks.
     */
    recoverTasks(query: Query, limit: number): Promise<WorkflowTask[]>
}
