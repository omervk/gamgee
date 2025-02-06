import { ChoiceOptions, ConditionsWorkflowBase } from './conditions.generated'
import { DecidePayload, LeftPayload, RightPayload } from './conditions.types'

export class ConditionsWorkflow extends ConditionsWorkflowBase {
    constructor() {
        super()
    }

    decide(payload: DecidePayload): ChoiceOptions {
        if (Math.random() < 0.5) {
            return Promise.resolve(this.choice.chooseLeft({}))
        } else {
            return Promise.resolve(this.choice.chooseRight({}))
        }
    }

    left(payload: LeftPayload): Promise<void> {
        console.log('We chose left')
        return Promise.resolve()
    }

    right(payload: RightPayload): Promise<void> {
        console.log('We chose right')
        return Promise.resolve()
    }
}
