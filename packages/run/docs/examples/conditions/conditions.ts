import { CompleteWorkflow } from '@gamgee/run'
import { ChoiceDecision, ConditionsWorkflowBase } from './conditions.generated'

export type DecidePayload = Record<string, never>
export type LeftPayload = Record<string, never>
export type RightPayload = Record<string, never>

export class ConditionsWorkflow extends ConditionsWorkflowBase {
    constructor() {
        super()
    }

    decide(payload: DecidePayload): Promise<ChoiceDecision> {
        if (Math.random() < 0.5) {
            return Promise.resolve({
                decision: 'chooseLeft',
                targetTaskName: 'left',
                payload: {},
            })
        } else {
            return Promise.resolve({
                decision: 'chooseRight',
                targetTaskName: 'right',
                payload: {},
            })
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
