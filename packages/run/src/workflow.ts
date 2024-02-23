import { JSONValue } from '@gamgee/interfaces/json'
import { StateStore } from '@gamgee/interfaces/store'
import { WorkflowTask } from '@gamgee/interfaces/task'
import { workflowFactory } from './workflow-factory'
import { context, propagation, Span, SpanStatusCode, trace } from '@opentelemetry/api'

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

type StepDefinition<T> = {
    name: string
    run: (payload: T) => Promise<StepResult>
    attempts: number
    backoffMs: number
}

export type WorkflowExecutionResult = 'Workflow Completed' | 'Workflow Stopped' | 'Workflow Unrecoverable'

function getCurrentOTelContext(): { traceparent: string; tracestate: string } {
    const otelContext = {}
    propagation.inject(context.active(), otelContext)
    return otelContext as { traceparent: string; tracestate: string }
}

export abstract class WorkflowBase {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly steps: { [name: string]: Omit<StepDefinition<any>, 'name'> } = {}

    protected constructor(readonly workflowType: string) {
        // TODO: When trying to register two distinct implementations with the same name, throw (e.g. use a hash in the generated file)
        workflowFactory.register(workflowType, () => new (this.constructor as new () => this)())
    }

    protected _registerStep<T>(def: StepDefinition<T>): void {
        this.steps[def.name] = Object.assign({}, def, { run: def.run.bind(this) })
    }

    async _runTask(task: WorkflowTask, store: StateStore): Promise<WorkflowTask | WorkflowExecutionResult> {
        // TODO: Validate stuff
        const stepDef = this.steps[task.taskName]

        return await trace.getTracer('@gamgee/run').startActiveSpan(
            `${task.typeId}.${task.taskName}`,
            {
                attributes: {},
            },
            propagation.extract(context.active(), task.otelContext),
            async (span: Span) => {
                try {
                    const result = await stepDef.run(task.payload)

                    if (result.targetTaskName === null) {
                        await store.clearTask(task.instanceId)
                        span.setStatus({ code: SpanStatusCode.OK, message: 'Workflow Completed' })
                        return 'Workflow Completed'
                    }

                    const nextTask = await this._enqueueImpl(store, {
                        instanceId: task.instanceId,
                        typeId: this.workflowType,
                        taskName: result.targetTaskName, // TODO: Clearly separate between Task and Step
                        payload: result.payload,
                        attempts: 0,
                        otelContext: getCurrentOTelContext(),
                    })

                    span.setStatus({ code: SpanStatusCode.OK, message: `Continuing to ${result.targetTaskName}` })
                    return nextTask
                } catch (e) {
                    // TODO: Notify of failure
                    // @ts-expect-error We won't make assumptions about the type here
                    // because the implementation checks it anyway
                    span.recordException(e)

                    const attemptsThatHappened = task.attempts + 1

                    if (stepDef.attempts <= attemptsThatHappened) {
                        await store.registerUnrecoverable(task)
                        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Workflow Unrecoverable' })
                        return 'Workflow Unrecoverable'
                    }

                    // For context see https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
                    const exponentialBackoffWithFullJitterMs =
                        Math.random() * stepDef.backoffMs * Math.pow(attemptsThatHappened, 2)

                    await this._enqueueImpl(
                        store,
                        Object.assign({}, task, {
                            attempts: attemptsThatHappened,
                            onlyRunAfterTsMs: Date.now() + exponentialBackoffWithFullJitterMs,
                        }),
                    )

                    span.setStatus({ code: SpanStatusCode.ERROR })

                    return 'Workflow Stopped'
                } finally {
                    span.end()
                }
            },
        )
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
            otelContext: getCurrentOTelContext(),
        }

        return await this._enqueueImpl(store, newTask)
    }

    private async _enqueueImpl(store: StateStore, newTask: WorkflowTask): Promise<WorkflowTask> {
        await store.upsertTask(newTask)
        return newTask
    }
}
