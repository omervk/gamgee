// TODO: This is very error prone in its current naive state
import { WorkflowBase } from './workflow'

class WorkflowFactory {
    private readonly workflows: { [key: string]: () => WorkflowBase } = {}

    register(workflowType: string, create: () => WorkflowBase) {
        this.workflows[workflowType] = create
    }

    create(workflowType: string) {
        const workflowCreator = this.workflows[workflowType]

        if (!workflowCreator) {
            throw new Error(
                `Unable to initialize workflow of type ${workflowType}. Please check that it was registered by the generated code.`,
            )
        }

        return workflowCreator()
    }
}

export const workflowFactory = new WorkflowFactory()
