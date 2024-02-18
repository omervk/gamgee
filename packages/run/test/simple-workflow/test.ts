import { MyTaskPayload, SimpleWorkflow } from './simple-workflow'
import InMemoryStateStore from '@gamgee/test/stateStores/in-memory'
import { WorkflowWorker } from '../../src/worker'
import { FetchStrategy } from '@gamgee/interfaces/store'
import { CompleteWorkflow } from '../../src/workflow'
import { afterEach } from '@jest/globals'

describe('test simple workflow', () => {
    afterEach(() => {
        new SimpleWorkflow().postTestCleanup()
    })

    it('runs the workflow', async () => {
        const workflow = new SimpleWorkflow()
        const store = new InMemoryStateStore()
        await workflow.submit('test', store)

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
        expect(workflow.getExecutionRegistry()).toStrictEqual(['test'])
    })

    it('runs the workflow if the step fails once', async () => {
        let failureCounter = 0

        const workflow = new (class extends SimpleWorkflow {
            async myTask(payload: MyTaskPayload): Promise<CompleteWorkflow> {
                if (failureCounter === 0) {
                    failureCounter++
                    throw new Error('Task failed successfully :)')
                }

                return super.myTask(payload)
            }
        })()

        const store = new InMemoryStateStore()
        await workflow.submit('test', store)

        const worker = new WorkflowWorker()
        const result = await worker.executeWaitingWorkflow(
            store,
            { workflowType: workflow.workflowType },
            FetchStrategy.Random,
            1000,
        )

        expect(result).toStrictEqual('Workflow Completed')
        expect(store.getStats()).toStrictEqual({
            taskUpdatesSeen: 3, // Create, retry, done
            tasksRemaining: 0,
            unrecoverableTasks: 0,
        })
        expect(workflow.getExecutionRegistry()).toStrictEqual(['test'])
    })

    it('turns the workflow unrecoverable if the step fails twice', async () => {
        let failureCounter = 0

        const workflow = new (class extends SimpleWorkflow {
            async myTask(payload: MyTaskPayload): Promise<CompleteWorkflow> {
                if (failureCounter < 2) {
                    failureCounter++
                    throw new Error('Task failed successfully :)')
                }

                return super.myTask(payload)
            }
        })()

        const store = new InMemoryStateStore()
        await workflow.submit('test', store)

        const worker = new WorkflowWorker()
        const result = await worker.executeWaitingWorkflow(
            store,
            { workflowType: workflow.workflowType },
            FetchStrategy.Random,
            1000,
        )

        expect(result).toStrictEqual('Workflow Unrecoverable')
        expect(store.getStats()).toStrictEqual({
            taskUpdatesSeen: 3, // Create, retry, permanent failure
            tasksRemaining: 0,
            unrecoverableTasks: 1,
        })
        expect(workflow.getExecutionRegistry()).toStrictEqual([])
    })
})
