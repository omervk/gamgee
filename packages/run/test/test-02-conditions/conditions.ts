import { CompleteWorkflow } from '@gamgee/run'
import { ConditionsWorkflowBase } from './conditions.generated'
import { trace } from '@opentelemetry/api'

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

type Failures = { decide: number; left?: number; right?: number }

const failures: { [testId: string]: Failures } = {}

export class ConditionsWorkflow extends ConditionsWorkflowBase {
    constructor() {
        super()
    }

    decide(payload: DecidePayload) {
        trace.getActiveSpan()?.setAttributes({
            testId: payload.testId,
            choose: payload.choose,
            failuresRequested: payload.failuresRequested.decideFailures,
        })

        const knownFailures = (failures[payload.testId] ??= {
            decide: 0,
        })

        if (knownFailures.decide < payload.failuresRequested.decideFailures) {
            knownFailures.decide++
            throw new Error('Task failed successfully :)')
        }

        return payload.choose === 'left'
            ? Promise.resolve(
                  this.choice.chooseLeft({
                      testId: payload.testId,
                      failuresRequested: payload.failuresRequested.leftFailures,
                  }),
              )
            : Promise.resolve(
                  this.choice.chooseRight({
                      testId: payload.testId,
                      failuresRequested: payload.failuresRequested.rightFailures,
                  }),
              )
    }

    left(payload: LeftPayload): Promise<CompleteWorkflow> {
        trace.getActiveSpan()?.setAttributes({
            testId: payload.testId,
            failuresRequested: payload.failuresRequested,
        })

        failures[payload.testId].left = 0

        if (failures[payload.testId].left! < payload.failuresRequested) {
            failures[payload.testId].left!++
            throw new Error('Task failed successfully :)')
        }

        return Promise.resolve(CompleteWorkflow)
    }

    right(payload: RightPayload): Promise<CompleteWorkflow> {
        trace.getActiveSpan()?.setAttributes({
            testId: payload.testId,
            failuresRequested: payload.failuresRequested,
        })

        failures[payload.testId].right = 0

        if (failures[payload.testId].right! < payload.failuresRequested) {
            failures[payload.testId].right!++
            throw new Error('Task failed successfully :)')
        }

        return Promise.resolve(CompleteWorkflow)
    }
}
