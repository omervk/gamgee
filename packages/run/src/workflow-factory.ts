// TODO: This is very error prone in its current naive state
import {WorkflowBase} from "./workflow";

class WorkflowFactory {
    private readonly workflows: { [key: string]: () => WorkflowBase } = {};

    register(workflowType: string, create: () => WorkflowBase) {
        this.workflows[workflowType] = create;
    }

    create(workflowType: string) {
        return this.workflows[workflowType]();
    }
}

export const workflowFactory = new WorkflowFactory();
