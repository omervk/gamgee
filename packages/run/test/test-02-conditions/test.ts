import InMemoryStateStore from '@gamgee/test/stateStores/in-memory'
import { WorkflowWorker } from '../../src/worker'
import { ConditionsWorkflow } from './conditions'
import { FetchStrategy } from '@gamgee/interfaces/store'

function randomString(): string {
    return Math.random().toString(36).slice(2)
}

describe('test conditions workflow', () => {
    it.concurrent('runs the workflow', async () => {
        const workflow = new ConditionsWorkflow()
        const store = new InMemoryStateStore()
        const testId = randomString()
        await workflow.submit(
            {
                testId,
                choose: 'left',
                failuresRequested: {
                    decideFailures: 0,
                    leftFailures: 0,
                    rightFailures: 0,
                },
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
            taskUpdatesSeen: 3, // Create, ran choose, ran left and done
            tasksRemaining: 0,
            unrecoverableTasks: 0,
        })
        expect(workflow.getExecutionRegistry()[testId]).toStrictEqual({
            decide: {
                failureCount: 0,
                successCount: 1,
            },
            left: {
                failureCount: 0,
                successCount: 1,
            },
        })
    })
})
