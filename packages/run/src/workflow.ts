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

export type WorkflowExecutionResult = 'Workflow Completed' | 'Workflow Stopped' | 'Workflow Unrecoverable'

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

    async _runTask(task: WorkflowTask, store: StateStore): Promise<WorkflowTask | WorkflowExecutionResult> {
        // TODO: Validate stuff
        const stepDef = this.steps[task.taskName]

        try {
            // TODO: On failure, increment attempts counter and persist
            const result = await stepDef.run(task.payload)

            if (result.targetTaskName === null) {
                await store.clearTask(task.instanceId)
                return 'Workflow Completed'
            }

            return await this._enqueueImpl(store, {
                instanceId: task.instanceId,
                typeId: this.workflowType,
                taskName: result.targetTaskName, // TODO: Clearly separate between Task and Step
                payload: result.payload,
                attempts: 0,
            })
        } catch (e) {
            // TODO: Notify of failure

            const attemptsThatHappened = task.attempts + 1

            if (stepDef.attempts <= attemptsThatHappened) {
                await store.registerUnrecoverable(task)
                return 'Workflow Unrecoverable'
            }

            // For context see https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
            const exponentialBackoffWithFullJitterMs =
                Math.random() * stepDef.backoffMs * Math.pow(attemptsThatHappened, 2)

            await this._enqueueImpl(store, {
                instanceId: task.instanceId,
                typeId: this.workflowType,
                taskName: task.taskName,
                payload: task.payload,
                attempts: attemptsThatHappened,
                onlyRunAfterTsMs: Date.now() + exponentialBackoffWithFullJitterMs,
            })

            return 'Workflow Stopped'
        }
    }

    protected async _enqueue(
        taskName: string,
        payload: JSONValue,
        store: StateStore,
        instanceId: string = Math.random().toString(36).slice(2),
    ): Promise<WorkflowTask> {
        const newTask: WorkflowTask = {
            instanceId,
            typeId: this.workflowType,
            taskName,
            payload,
            attempts: 0,
        }

        return await this._enqueueImpl(store, newTask)
    }

    private async _enqueueImpl(store: StateStore, newTask: WorkflowTask): Promise<WorkflowTask> {
        await store.upsertTask(newTask)
        return newTask
    }
}
