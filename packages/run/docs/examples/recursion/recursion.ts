import { RecursionWorkflowBase } from './recursion.generated'

export type CountDownPayload = number

export class RecursionWorkflow extends RecursionWorkflowBase {
    constructor() {
        super()
    }

    countDown(count: CountDownPayload) {
        if (count === 0) {
            return Promise.resolve(this.decision.zero())
        }

        return Promise.resolve(this.decision.nonZero(count - 1))
    }
}
