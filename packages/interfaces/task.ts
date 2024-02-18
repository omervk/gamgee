import { JSONValue } from './json'

export type WorkflowTask = {
    /**
     * The unique identifier of the workflow instance. Usually assigned automatically.
     */
    readonly instanceId: string

    /**
     * The unique identifier of the workflow, of which this task is an instance.
     * Generated in the workflow's scaffolding.
     */
    readonly typeId: string

    /**
     * The name of the task in the workflow waiting to be executed.
     */
    readonly taskName: string

    /**
     * The unserialized payload that will be provided to the task when it's run.
     */
    readonly payload: JSONValue

    /**
     * The number of times this task has already been tried.
     */
    readonly attempts: number

    /**
     * The earliest this task can run again.
     * Usually used by the exponential backoff algorithm, but may also be used to schedule workflows.
     */
    readonly onlyRunAfterTsMs?: number
}
