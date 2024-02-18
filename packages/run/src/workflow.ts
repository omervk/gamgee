import { JSONValue } from '@gamgee/interfaces/json'
import { StateStore } from '@gamgee/interfaces/store'
import { WorkflowTask } from '@gamgee/interfaces/task'
import { workflowFactory } from './workflow-factory'

export class WrongTimingError extends Error {
    constructor() {
        super('Unable to do this at runtime. Please refer to your mermaid diagram.')
        Object.setPrototypeOf(this, WrongTimingError.prototype)
    }
}

export const CompleteWorkflow = { targetTaskName: null, payload: null }
export type CompleteWorkflow = typeof CompleteWorkflow

type StepResult = {
    targetTaskName: string | null
    payload: JSONValue
}

type StepDefinition<T, R extends StepResult> = {
    name: string
    run: (payload: T) => Promise<R>
    attempts: number
    backoffMs: number
}

export abstract class WorkflowBase {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly steps: { [name: string]: Omit<StepDefinition<any, StepResult>, 'name'> } = {}

    protected constructor(readonly workflowType: string) {
        // TODO: When trying to register two distinct implementations with the same name, throw (e.g. use a hash in the generated file)
        workflowFactory.register(workflowType, () => new (this.constructor as new () => this)())
    }

    protected _registerStep<T extends JSONValue, R extends StepResult>(def: StepDefinition<T, R>): void {
        this.steps[def.name] = Object.assign({}, def, { run: def.run.bind(this) })
    }

    async _runTask(
        task: WorkflowTask,
        store: StateStore,
    ): Promise<WorkflowTask | 'Workflow Completed' | 'Workflow Unrecoverable'> {
        // TODO: Validate stuff
        const stepDef = this.steps[task.taskName]
        const payload = JSON.parse(task.serializedPayload)

        try {
            // TODO: On failure, increment attempts counter and persist
            const result = await stepDef.run(payload)

            if (result.targetTaskName === null) {
                await store.clearTask(task.id)
                return 'Workflow Completed'
            }

            return await this._enqueueImpl(result.targetTaskName, result.payload, store, task.id)
        } catch (e) {
            // TODO: Notify of failure

            const attemptsThatHappened = task.attempts + 1

            if (stepDef.attempts <= attemptsThatHappened) {
                await store.registerUnrecoverable(task)
                return 'Workflow Unrecoverable'
            }

            return await this._enqueueImpl(task.taskName, payload, store, task.id, attemptsThatHappened)
        }
    }

    protected async _enqueue(
        taskName: string,
        payload: JSONValue,
        store: StateStore,
        taskId?: string,
        attemptsMade: number = 0,
    ): Promise<WorkflowTask> {
        return await this._enqueueImpl(taskName, payload, store, taskId, attemptsMade)
    }

    private async _enqueueImpl(
        taskName: string,
        payload: JSONValue,
        store: StateStore,
        taskId?: string,
        attemptsMade: number = 0,
    ) {
        const newTask: WorkflowTask = {
            id: taskId ?? Math.random().toString(36).slice(2),
            typeId: this.workflowType,
            taskName,
            serializedPayload: JSON.stringify(payload),
            attempts: attemptsMade,
        }

        await store.upsertTask(newTask)

        return newTask
    }
}
