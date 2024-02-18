import { workflowFactory } from './workflow-factory'
import { FetchStrategy, Query, StateStore } from '@gamgee/interfaces/store'
import { WorkflowTask } from '@gamgee/interfaces/task'
import { WorkflowBase, WorkflowExecutionResult } from './workflow'

// TODO: Task locking 🤔
export class WorkflowWorker {
    // Runs only a single task
    async executeWaitingTask(
        store: StateStore,
        query: Query,
        fetchStrategy: FetchStrategy,
        fetchTimeoutMs: number,
    ): Promise<WorkflowTask | WorkflowExecutionResult | 'No Tasks Waiting'> {
        const maybeTask = await store.tryFetchingTask(query, fetchStrategy, fetchTimeoutMs)

        if (maybeTask === null) {
            return 'No Tasks Waiting'
        }

        const workflow = workflowFactory.create(maybeTask.typeId)
        return await workflow._runTask(maybeTask, store)
    }

    // Runs a workflow to completion or until it fails
    async executeWaitingWorkflow(
        store: StateStore,
        query: Query,
        fetchStrategy: FetchStrategy,
        fetchTimeoutMs: number,
    ): Promise<WorkflowExecutionResult | 'No Tasks Waiting'> {
        const maybeTask = await store.tryFetchingTask(query, fetchStrategy, fetchTimeoutMs)

        if (maybeTask === null) {
            return 'No Tasks Waiting'
        }

        const workflow: WorkflowBase = workflowFactory.create(maybeTask.typeId)

        async function executeUntilComplete(task: WorkflowTask): Promise<WorkflowExecutionResult> {
            const result = await workflow._runTask(task, store)

            if (
                result === 'Workflow Completed' ||
                result === 'Workflow Stopped' ||
                result === 'Workflow Unrecoverable'
            ) {
                return result
            }

            return await executeUntilComplete(result)
        }

        return await executeUntilComplete(maybeTask)
    }
}
