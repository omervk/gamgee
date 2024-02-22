import { CompleteWorkflow } from '@gamgee/run'
import { ChoiceDecision, ConditionsWorkflowBase } from './conditions.generated'

export type DecidePayload = {
    testId: string
    choose: 'left' | 'right'
    failuresRequested: {
        decideFailures: number
        leftFailures: number
        rightFailures: number
    }
}

export type LeftPayload = {
    testId: string
    failuresRequested: number
}

export type RightPayload = LeftPayload

type Counters = { failureCount: number; successCount: number }
type ExecutionInfo = { decide: Counters; left?: Counters; right?: Counters }

const executionRegistry: { [testId: string]: ExecutionInfo } = {}

export class ConditionsWorkflow extends ConditionsWorkflowBase {
    constructor() {
        super()
    }

    async decide(payload: DecidePayload): Promise<ChoiceDecision> {
        const executionInfo = (executionRegistry[payload.testId] ??= {
            decide: {
                failureCount: 0,
                successCount: 0,
            },
        })

        if (executionInfo.decide.failureCount < payload.failuresRequested.decideFailures) {
            executionInfo.decide.failureCount++
            throw new Error('Task failed successfully :)')
        }

        executionInfo.decide.successCount++

        return payload.choose === 'left'
            ? Promise.resolve({
                  decision: 'chooseLeft',
                  targetTaskName: 'left',
                  payload: { testId: payload.testId, failuresRequested: payload.failuresRequested.leftFailures },
              })
            : Promise.resolve({
                  decision: 'chooseRight',
                  targetTaskName: 'right',
                  payload: { testId: payload.testId, failuresRequested: payload.failuresRequested.rightFailures },
              })
    }

    left(payload: LeftPayload): Promise<CompleteWorkflow> {
        const executionInfo = (executionRegistry[payload.testId].left = {
            failureCount: 0,
            successCount: 0,
        })

        if (executionInfo.failureCount < payload.failuresRequested) {
            executionInfo.failureCount++
            throw new Error('Task failed successfully :)')
        }

        executionInfo.successCount++

        return Promise.resolve(CompleteWorkflow)
    }

    right(payload: RightPayload): Promise<CompleteWorkflow> {
        const executionInfo = (executionRegistry[payload.testId].right = {
            failureCount: 0,
            successCount: 0,
        })

        if (executionInfo.failureCount < payload.failuresRequested) {
            executionInfo.failureCount++
            throw new Error('Task failed successfully :)')
        }

        executionInfo.successCount++

        return Promise.resolve(CompleteWorkflow)
    }

    getExecutionRegistry(): typeof executionRegistry {
        return executionRegistry
    }
}
