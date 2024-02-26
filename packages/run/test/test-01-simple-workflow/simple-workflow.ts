import { SimpleWorkflowBase } from './simple-workflow.generated'
import { trace } from '@opentelemetry/api'

export type MyTaskPayload = {
    testId: string
    failuresRequested: number
}

const failures: { [id: MyTaskPayload['testId']]: number } = {}

export class SimpleWorkflow extends SimpleWorkflowBase {
    constructor() {
        super()
    }

    async myTask(payload: MyTaskPayload): Promise<void> {
        trace.getActiveSpan()?.setAttribute('payload', payload.testId)

        if ((failures[payload.testId] ??= 0) < payload.failuresRequested) {
            failures[payload.testId]++
            throw new Error('Task failed successfully :)')
        }

        return Promise.resolve()
    }
}
