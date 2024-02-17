// This is what is implemented by the user
import {SimpleWorkflowBase} from './simple-workflow.generated';
import {CompleteWorkflow} from "@gamgee/run";

export type MyTaskPayload = string;

const executionRegistry: MyTaskPayload[] = [];

export class SimpleWorkflow extends SimpleWorkflowBase {
    constructor() {
        super();
    }

    async myTask(payload: MyTaskPayload): Promise<CompleteWorkflow> {
        executionRegistry.push(payload);
        return CompleteWorkflow;
    }
    
    getExecutionRegistry(): MyTaskPayload[] {
        return executionRegistry;
    }
}