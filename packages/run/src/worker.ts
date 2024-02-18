import { workflowFactory } from './workflow-factory'
import { Query, StateStore } from '@gamgee/interfaces/store'
import { WorkflowTask } from '@gamgee/interfaces/task'

// TODO: Task locking 🤔
export class WorkflowWorker {
    // Runs only a single task
    async executeWaitingTask(
        store: StateStore,
        query: Query,
        fetchTimeoutMs: number,
    ): Promise<WorkflowTask | 'Workflow Completed' | 'No Tasks Waiting'> {
        const maybeTask = await store.tryFetchingTask(query, fetchTimeoutMs)

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
        fetchTimeoutMs: number,
    ): Promise<'Workflow Completed' | 'No Tasks Waiting'> {
        const maybeTask = await store.tryFetchingTask(query, fetchTimeoutMs)

        if (maybeTask === null) {
            return 'No Tasks Waiting'
        }

        const workflow = workflowFactory.create(maybeTask.typeId)

        async function executeUntilComplete(task: WorkflowTask): Promise<'Workflow Completed' | 'No Tasks Waiting'> {
            const result = await workflow._runTask(task, store)

            if (result === 'Workflow Completed') {
                return 'Workflow Completed'
            }

            return await executeUntilComplete(result)
        }

        return await executeUntilComplete(maybeTask)
    }
}
