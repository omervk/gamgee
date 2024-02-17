import {SimpleWorkflow} from "./simple-workflow";
import InMemoryStateStore from "@gamgee/test/stateStores/in-memory";
import {WorkflowWorker} from "../../src/worker";

describe('test simple workflow', () => {
    it('runs the workflow', async () => {
        const workflow = new SimpleWorkflow();
        const store = new InMemoryStateStore();
        await workflow.submit('test', store);

        const worker = new WorkflowWorker();
        const result = await worker.executeWaitingWorkflow(store, { workflowType: workflow.workflowType }, 1000);
        
        expect(result).toStrictEqual("Workflow Completed");
        expect(store.getStats()).toStrictEqual({ taskUpdatesSeen: 2, tasksRemaining: 0 });
        expect(workflow.getExecutionRegistry()).toStrictEqual(['test']);
    })
})