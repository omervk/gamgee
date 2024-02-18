import { SimpleWorkflowBase } from './simple-workflow.generated'
import { CompleteWorkflow } from '@gamgee/run'

export type MyTaskPayload = {
    testId: string
    failuresRequested: number
}

type ExecutionInfo = { failureCount: number; successCount: number }

const executionRegistry: { [id: MyTaskPayload['testId']]: ExecutionInfo } = {}

export class SimpleWorkflow extends SimpleWorkflowBase {
    constructor() {
        super()
    }

    async myTask(payload: MyTaskPayload): Promise<CompleteWorkflow> {
        const executionInfo = (executionRegistry[payload.testId] ??= {
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
