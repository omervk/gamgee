import { SimpleWorkflow } from './simple-workflow'
import InMemoryStateStore from '@gamgee/test/stateStores/in-memory'
import { WorkflowWorker } from '../../src/worker'
import { FetchStrategy } from '@gamgee/interfaces/store'

function randomString(): string {
    return Math.random().toString(36).slice(2)
}

describe('test simple workflow', () => {
    it.concurrent('runs the workflow', async () => {
        // TODO: Document that the workflow instance is ephemeral. State is persisted using the store or side-effects.
        const workflow = new SimpleWorkflow()
        const store = new InMemoryStateStore()
        const testId = randomString()
        await workflow.submit(
            {
                testId,
                failuresRequested: 0,
            },
            store,
        )

        const worker = new WorkflowWorker()
        const result = await worker.executeWaitingWorkflow(
            store,
            { workflowType: workflow.workflowType },
            FetchStrategy.Random,
            1000,
        )

        expect(result).toStrictEqual('Workflow Completed')
        expect(store.getStats()).toStrictEqual({
            taskUpdatesSeen: 2, // Create, done
            tasksRemaining: 0,
            unrecoverableTasks: 0,
        })
        expect(workflow.getExecutionRegistry()[testId]).toStrictEqual({
            failureCount: 0,
            successCount: 1,
        })
    })

    it.concurrent('runs the workflow if the step fails once', async () => {
        const workflow = new SimpleWorkflow()
        const store = new InMemoryStateStore()
        const testId = randomString()
        const uniqueTaskId = await workflow.submit(
            {
                testId,
                failuresRequested: 1,
            },
            store,
        )

        const worker = new WorkflowWorker()
        const result = await worker.executeWaitingWorkflow(
            store,
            { workflowType: workflow.workflowType },
            FetchStrategy.Random,
            1000,
        )

        expect(result).toStrictEqual('Workflow Stopped')
        expect(store.getStats()).toStrictEqual({
            taskUpdatesSeen: 2, // Create, retry
            tasksRemaining: 1,
            unrecoverableTasks: 0,
        })
        expect(workflow.getExecutionRegistry()[testId]).toStrictEqual({
            failureCount: 1,
            successCount: 0,
        })

        store.assumingTaskIsWaitingMakeItAvailable(uniqueTaskId)

        const result2 = await worker.executeWaitingWorkflow(
            store,
            { workflowType: workflow.workflowType },
            FetchStrategy.Random,
            1000,
        )

        expect(result2).toStrictEqual('Workflow Completed')
        expect(store.getStats()).toStrictEqual({
            taskUpdatesSeen: 3, // Create, retry, done
            tasksRemaining: 0,
            unrecoverableTasks: 0,
        })
        expect(workflow.getExecutionRegistry()[testId]).toStrictEqual({
            failureCount: 1,
            successCount: 1,
        })
    })

    it.concurrent('turns the workflow unrecoverable if the step fails twice', async () => {
        const workflow = new SimpleWorkflow()
        const store = new InMemoryStateStore()
        const testId = randomString()
        const uniqueTaskId = await workflow.submit(
            {
                testId,
                failuresRequested: 2,
            },
            store,
        )

        const worker = new WorkflowWorker()
        const attempt1 = await worker.executeWaitingWorkflow(
            store,
            { workflowType: workflow.workflowType },
            FetchStrategy.Random,
            1000,
        )

        expect(attempt1).toStrictEqual('Workflow Stopped')
        expect(store.getStats()).toStrictEqual({
            taskUpdatesSeen: 2, // Create, retry
            tasksRemaining: 1,
            unrecoverableTasks: 0,
        })
        expect(workflow.getExecutionRegistry()[testId]).toStrictEqual({
            failureCount: 1,
            successCount: 0,
        })

        store.assumingTaskIsWaitingMakeItAvailable(uniqueTaskId)

        const attempt2 = await worker.executeWaitingWorkflow(
            store,
            { workflowType: workflow.workflowType },
            FetchStrategy.Random,
            1000,
        )

        expect(attempt2).toStrictEqual('Workflow Unrecoverable')
        expect(store.getStats()).toStrictEqual({
            taskUpdatesSeen: 3, // Create, retry, permanent failure
            tasksRemaining: 0,
            unrecoverableTasks: 1,
        })
        expect(workflow.getExecutionRegistry()[testId]).toStrictEqual({
            failureCount: 2,
            successCount: 0,
        })
    })
})
