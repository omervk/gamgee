import { SimpleWorkflow } from './simple-workflow'
import InMemoryStateStore from '@gamgee/test/stateStores/in-memory'
import { WorkflowWorker } from '../../src/worker'
import { FetchStrategy } from '@gamgee/interfaces/store'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { TracedTestsSpanProcessor } from '../tests-trace-exporter'
import { Span, SpanStatusCode, trace } from '@opentelemetry/api'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { expect } from '@jest/globals'

function randomString(): string {
    return Math.random().toString(36).slice(2)
}

describe('test simple workflow', () => {
    const processor = new TracedTestsSpanProcessor()
    const sdk: NodeSDK = new NodeSDK({
        spanProcessors: [processor],
    })
    sdk.start()

    afterAll(async () => {
        await sdk.shutdown()
    })

    it.concurrent('runs the workflow', async () => {
        const testId = randomString()
        const store = new InMemoryStateStore()

        const parentSpanContext = await trace
            .getTracer('test')
            .startActiveSpan(expect.getState().currentTestName!, { root: true }, async (span: Span) => {
                // TODO: Document that the workflow instance is ephemeral. State is persisted using the store or side-effects.
                const workflow = new SimpleWorkflow()
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

                return span.spanContext()
            })

        await processor.forceFlush()
        
        expect(store.getStats()).toStrictEqual({
            taskUpdatesSeen: 2, // Create, done
            tasksRemaining: 0,
            unrecoverableTasks: 0,
        })
        
        const spansByTraceId = processor.getSpansByTraceId(parentSpanContext.traceId)
        expect(spansByTraceId).toMatchObject([
            {
                name: 'SimpleWorkflow.myTask',
                parentSpanId: parentSpanContext.spanId,
                status: { code: SpanStatusCode.OK, message: 'Workflow Completed' },
                attributes: {
                    payload: testId,
                },
            },
        ])
    })

    it.concurrent('runs the workflow if the step fails once', async () => {
        const testId = randomString()
        const store = new InMemoryStateStore()

        const parentSpanContext = await trace
            .getTracer('test')
            .startActiveSpan(expect.getState().currentTestName!, { root: true }, async (span: Span) => {
                const workflow = new SimpleWorkflow()
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

                store.assumingTaskIsWaitingMakeItAvailable(uniqueTaskId)

                const result2 = await worker.executeWaitingWorkflow(
                    store,
                    { workflowType: workflow.workflowType },
                    FetchStrategy.Random,
                    1000,
                )

                expect(result2).toStrictEqual('Workflow Completed')

                return span.spanContext()
            })

        await processor.forceFlush()

        expect(store.getStats()).toStrictEqual({
            taskUpdatesSeen: 3, // Create, retry, done
            tasksRemaining: 0,
            unrecoverableTasks: 0,
        })

        const spansByTraceId = processor.getSpansByTraceId(parentSpanContext.traceId)
        expect(spansByTraceId).toMatchObject([
            {
                name: 'SimpleWorkflow.myTask',
                parentSpanId: parentSpanContext.spanId,
                status: { code: SpanStatusCode.ERROR },
                attributes: {
                    payload: testId,
                },
            },
            {
                name: 'SimpleWorkflow.myTask',
                parentSpanId: parentSpanContext.spanId,
                status: { code: SpanStatusCode.OK, message: 'Workflow Completed' },
                attributes: {
                    payload: testId,
                },
            },
        ])
    })

    it.concurrent('turns the workflow unrecoverable if the step fails twice', async () => {
        const testId = randomString()
        const store = new InMemoryStateStore()

        const parentSpanContext = await trace
            .getTracer('test')
            .startActiveSpan(expect.getState().currentTestName!, { root: true }, async (span: Span) => {
                const workflow = new SimpleWorkflow()
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

                store.assumingTaskIsWaitingMakeItAvailable(uniqueTaskId)

                const attempt2 = await worker.executeWaitingWorkflow(
                    store,
                    { workflowType: workflow.workflowType },
                    FetchStrategy.Random,
                    1000,
                )

                expect(attempt2).toStrictEqual('Workflow Unrecoverable')

                return span.spanContext()
            })

        await processor.forceFlush()

        expect(store.getStats()).toStrictEqual({
            taskUpdatesSeen: 3, // Create, retry, permanent failure
            tasksRemaining: 0,
            unrecoverableTasks: 1,
        })

        const spansByTraceId = processor.getSpansByTraceId(parentSpanContext.traceId)
        expect(spansByTraceId).toMatchObject([
            {
                name: 'SimpleWorkflow.myTask',
                parentSpanId: parentSpanContext.spanId,
                status: { code: SpanStatusCode.ERROR },
                attributes: {
                    payload: testId,
                },
            },
            {
                name: 'SimpleWorkflow.myTask',
                parentSpanId: parentSpanContext.spanId,
                status: { code: SpanStatusCode.ERROR, message: 'Workflow Unrecoverable' },
                attributes: {
                    payload: testId,
                },
            },
        ])
    })
})
