import { CompleteWorkflow } from '@gamgee/run'
import { ConditionsWorkflowBase } from './conditions.generated'

export type DecidePayload = Record<string, never>
export type LeftPayload = Record<string, never>
export type RightPayload = Record<string, never>

export class ConditionsWorkflow extends ConditionsWorkflowBase {
    constructor() {
        super()
    }

    decide(payload: DecidePayload) {
        if (Math.random() < 0.5) {
            return Promise.resolve(this.choice.chooseLeft({}))
        } else {
            return Promise.resolve(this.choice.chooseRight({}))
        }
    }

    left(payload: LeftPayload): Promise<CompleteWorkflow> {
        console.log('We chose left')
        return Promise.resolve(CompleteWorkflow)
    }

    right(payload: RightPayload): Promise<CompleteWorkflow> {
        console.log('We chose right')
        return Promise.resolve(CompleteWorkflow)
    }
}
