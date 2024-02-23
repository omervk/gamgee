import { RecursionWorkflowBase } from './recursion.generated'
import { trace } from '@opentelemetry/api'

export type CountDownPayload = { testId: string; count: number; failuresRequested: number }

const failures: { [testId: string]: number } = {}

export class RecursionWorkflow extends RecursionWorkflowBase {
    constructor() {
        super()
    }

    countDown(payload: CountDownPayload) {
        trace.getActiveSpan()?.setAttributes(payload)

        if (payload.failuresRequested > (failures[payload.testId] ??= 0)) {
            failures[payload.testId]++
            throw new Error('Task failed successfully :)')
        }

        if (payload.count === 0) {
            return Promise.resolve(this.decision.zero())
        }

        return Promise.resolve(this.decision.nonZero(Object.assign({}, payload, { count: payload.count - 1 })))
    }
}
