import InMemoryStateStore from '@gamgee/test/stateStores/in-memory'
import { WorkflowWorker } from '../../src/worker'
import { ConditionsWorkflow } from './conditions'
import { FetchStrategy } from '@gamgee/interfaces/store'
import { TestsTraceExporter } from '../tests-trace-exporter'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { Span, SpanStatusCode, trace } from '@opentelemetry/api'
import { expect } from '@jest/globals'

function randomString(): string {
    return Math.random().toString(36).slice(2)
}

describe('test conditions workflow', () => {
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
                const workflow = new ConditionsWorkflow()
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

                return span.spanContext()
            })

        expect(store.getStats()).toStrictEqual({
            taskUpdatesSeen: 3, // Create, ran choose, ran left and done
            tasksRemaining: 0,
            unrecoverableTasks: 0,
        })

        const spansByTraceId = testsTraceExporter.getSpansByTraceId(parentSpanContext.traceId)
        expect(spansByTraceId).toMatchObject([
            {
                name: 'ConditionsWorkflow.decide',
                parentSpanId: parentSpanContext.spanId,
                status: { code: SpanStatusCode.OK, message: 'Continuing to left' },
                attributes: {
                    testId,
                    choose: 'left',
                    failuresRequested: 0,
                },
            },
            {
                name: 'ConditionsWorkflow.left',
                parentSpanId: spansByTraceId?.[0]?.spanId,
                status: { code: SpanStatusCode.OK, message: 'Workflow Completed' },
                attributes: {
                    testId,
                    failuresRequested: 0,
                },
            },
        ])
    })
})
