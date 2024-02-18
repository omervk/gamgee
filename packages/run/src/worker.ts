import { workflowFactory } from './workflow-factory'
import { FetchStrategy, Query, StateStore } from '@gamgee/interfaces/store'
import { WorkflowTask } from '@gamgee/interfaces/task'

// TODO: Task locking 🤔
export class WorkflowWorker {
    // Runs only a single task
    async executeWaitingTask(
        store: StateStore,
        query: Query,
        fetchStrategy: FetchStrategy,
        fetchTimeoutMs: number,
    ): Promise<WorkflowTask | 'Workflow Completed' | 'Workflow Unrecoverable' | 'No Tasks Waiting'> {
        const maybeTask = await store.tryFetchingTask(query, fetchStrategy, fetchTimeoutMs)

        if (maybeTask === null) {
            return 'No Tasks Waiting'
        }

        const workflow = workflowFactory.create(maybeTask.typeId)
        return await workflow._runTask(maybeTask, store)
    }

    // Runs a workflow to completion
    async executeWaitingWorkflow(
        store: StateStore,
        query: Query,
        fetchStrategy: FetchStrategy,
        fetchTimeoutMs: number,
    ): Promise<'Workflow Completed' | 'Workflow Unrecoverable' | 'No Tasks Waiting'> {
        const maybeTask = await store.tryFetchingTask(query, fetchStrategy, fetchTimeoutMs)

        if (maybeTask === null) {
            return 'No Tasks Waiting'
        }

        const workflow = workflowFactory.create(maybeTask.typeId)

        async function executeUntilComplete(
            task: WorkflowTask,
        ): Promise<'Workflow Completed' | 'Workflow Unrecoverable' | 'No Tasks Waiting'> {
            const result = await workflow._runTask(task, store)

            if (result === 'Workflow Completed' || result === 'Workflow Unrecoverable') {
                return result
            }

            return await executeUntilComplete(result)
        }

        return await executeUntilComplete(maybeTask)
    }
}
