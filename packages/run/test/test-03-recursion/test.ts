import InMemoryStateStore from '@gamgee/test/stateStores/in-memory'
import { WorkflowWorker } from '../../src/worker'
import { FetchStrategy } from '@gamgee/interfaces/store'
import { TestsTraceExporter } from '../tests-trace-exporter'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { Span, SpanStatusCode, trace } from '@opentelemetry/api'
import { expect } from '@jest/globals'
import { RecursionWorkflow } from './recursion'

function randomString(): string {
    return Math.random().toString(36).slice(2)
}

describe('test recursion workflow', () => {
    const testsTraceExporter = new TestsTraceExporter()
    const sdk: NodeSDK = new NodeSDK({
        spanProcessor: new SimpleSpanProcessor(testsTraceExporter),
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
                const workflow = new RecursionWorkflow()
                await workflow.submit(
                    {
                        testId,
                        count: 4,
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

        expect(store.getStats()).toStrictEqual({
            taskUpdatesSeen: 6, // Create, ran countDown(4), ran countDown(3), ran countDown(2), ran countDown(1), and done
            tasksRemaining: 0,
            unrecoverableTasks: 0,
        })

        const spansByTraceId = testsTraceExporter.getSpansByTraceId(parentSpanContext.traceId)
        expect(spansByTraceId).toMatchObject([
            {
                name: 'RecursionWorkflow.countDown',
                parentSpanId: parentSpanContext.spanId,
                status: { code: SpanStatusCode.OK, message: 'Continuing to countDown' },
                attributes: {
                    testId,
                    count: 4,
                    failuresRequested: 0,
                },
            },
            {
                name: 'RecursionWorkflow.countDown',
                parentSpanId: spansByTraceId[0].spanId,
                status: { code: SpanStatusCode.OK, message: 'Continuing to countDown' },
                attributes: {
                    testId,
                    count: 3,
                    failuresRequested: 0,
                },
            },
            {
                name: 'RecursionWorkflow.countDown',
                parentSpanId: spansByTraceId[1].spanId,
                status: { code: SpanStatusCode.OK, message: 'Continuing to countDown' },
                attributes: {
                    testId,
                    count: 2,
                    failuresRequested: 0,
                },
            },
            {
                name: 'RecursionWorkflow.countDown',
                parentSpanId: spansByTraceId[2].spanId,
                status: { code: SpanStatusCode.OK, message: 'Continuing to countDown' },
                attributes: {
                    testId,
                    count: 1,
                    failuresRequested: 0,
                },
            },
            {
                name: 'RecursionWorkflow.countDown',
                parentSpanId: spansByTraceId[3].spanId,
                status: { code: SpanStatusCode.OK, message: 'Workflow Completed' },
                attributes: {
                    testId,
                    count: 0,
                    failuresRequested: 0,
                },
            },
        ])
    })
})
