/* This file is automatically generated. It gets overwritten on build */
import {CompleteWorkflow, WrongTimingError, WorkflowBase} from "@gamgee/run";
import {StateStore} from "@gamgee/interfaces/store";
import {WorkflowTask} from "@gamgee/interfaces/task";

import {DecidePayload, LeftPayload, RightPayload} from "./conditions";

export abstract class ConditionsWorkflowBase extends WorkflowBase {
    protected constructor() {
        super('ConditionsWorkflow');

        super._registerStep({ name: 'decide', run: this.decide, attempts: 1, backoffMs: 1000 });
        super._registerStep({ name: 'left', run: this.invokeLeft, attempts: 1, backoffMs: 1000 });
        super._registerStep({ name: 'right', run: this.invokeRight, attempts: 1, backoffMs: 1000 });
    }

    async submit(payload: DecidePayload, store: StateStore, uniqueInstanceId?: string): Promise<string> {
        const task = await super._enqueue('decide', payload, store, uniqueInstanceId);
        return task.instanceId;
    }

    abstract decide(payload: DecidePayload): Promise<ReturnType<(typeof this.choice)['chooseLeft']>> | Promise<ReturnType<(typeof this.choice)['chooseRight']>>;

    private async invokeLeft(payload: LeftPayload): Promise<CompleteWorkflow> {
        await this.left(payload);
        return Promise.resolve(CompleteWorkflow);
    }

    abstract left(payload: LeftPayload): Promise<void>;

    private async invokeRight(payload: RightPayload): Promise<CompleteWorkflow> {
        await this.right(payload);
        return Promise.resolve(CompleteWorkflow);
    }

    abstract right(payload: RightPayload): Promise<void>;

    protected choice = {
        chooseLeft(payload: LeftPayload) {
            return {
                targetTaskName: 'left',
                payload,
            }
        },
        chooseRight(payload: RightPayload) {
            return {
                targetTaskName: 'right',
                payload,
            }
        },
    }

    protected _registerStep() {
        throw new WrongTimingError();
    }

    protected _enqueue(): Promise<WorkflowTask> {
        throw new WrongTimingError();
    }
}