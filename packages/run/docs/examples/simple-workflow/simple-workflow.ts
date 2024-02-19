import { SimpleWorkflowBase } from './simple-workflow.generated'
import { CompleteWorkflow } from '@gamgee/run'

export type MyTaskPayload = string

export class SimpleWorkflow extends SimpleWorkflowBase {
    constructor() {
        super()
    }

    async myTask(payload: MyTaskPayload): Promise<CompleteWorkflow> {
        console.log(`Successfully handled payload ${payload}!`)
        return Promise.resolve(CompleteWorkflow)
    }
}
