import { SimpleWorkflowBase } from './simple-workflow.generated'
import { Task1Payload, Task2Payload } from './simple-workflow.types'

export class SimpleWorkflow extends SimpleWorkflowBase {
    constructor() {
        super()
    }

    task1(payload: Task1Payload): Promise<Task2Payload> {
        console.log(`Successfully handled payload ${payload}!`)

        return Promise.resolve(`${payload} number 2`)
    }

    task2(payload: Task2Payload): Promise<void> {
        console.log(`Successfully handled payload ${payload}!`)

        return Promise.resolve()
    }
}
