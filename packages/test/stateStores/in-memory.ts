import { FetchStrategy, StateStore } from '@gamgee/interfaces/store'
import { WorkflowTask } from '@gamgee/interfaces/task'

export default class InMemoryStateStore implements StateStore {
    private clock: number = 0
    private readonly tasks: { [id: string]: WorkflowTask & { clock: number } } = {}
    private readonly unrecoverableTasks: { [id: string]: WorkflowTask } = {}

    async insertTask(newTask: WorkflowTask): Promise<void> {
        this.tasks[newTask.instanceId] = Object.assign({ clock: this.clock }, newTask)
        this.clock++
        return Promise.resolve()
    }

    async updateTaskBy(fromTaskName: string, task: WorkflowTask): Promise<void> {
        const oldTask = this.tasks[task.instanceId]
        if (!oldTask || oldTask.taskName !== fromTaskName) {
            return Promise.reject(
                new Error(
                    `Unable to find task by search criteria instanceId=${task.instanceId}, taskName=${fromTaskName}`,
                ),
            )
        }

        this.tasks[task.instanceId] = Object.assign({ clock: this.clock }, task)
        this.clock++
        return Promise.resolve()
    }

    async tryFetchingTask(
        query: Partial<{
            workflowType: string
            taskName: string
        }>,
        strategy: FetchStrategy,
    ): Promise<WorkflowTask | null> {
        const validTasks = this._filterTasks(this.tasks, query)

        if (validTasks.length === 0) {
            return Promise.resolve(null)
        }

        const sortedTasks = validTasks.sort((a, b) => a.clock - b.clock)

        switch (strategy) {
            case undefined:
            case FetchStrategy.Oldest:
                return Promise.resolve(sortedTasks[0])

            case FetchStrategy.Newest:
                return Promise.resolve(sortedTasks[sortedTasks.length - 1])

            case FetchStrategy.Random:
                return Promise.resolve(sortedTasks[Math.floor(Math.random() * sortedTasks.length)])

            default:
                throw new Error('Not implemented... yet.')
        }
    }

    private _filterTasks<T extends WorkflowTask>(
        tasks: { [p: string]: T },
        query: Partial<{
            workflowType: string
            taskName: string
        }>,
    ): T[] {
        return Object.values(tasks).filter(task => {
            if (query.workflowType && task.typeId !== query.workflowType) {
                return false
            }

            if (query.taskName && task.taskName !== query.taskName) {
                return false
            }

            const now = Date.now()

            if ((task.onlyRunAfterTsMs ?? 0) > now) {
                return false
            }

            return true
        })
    }

    async clearTask(id: WorkflowTask['instanceId']): Promise<void> {
        delete this.tasks[id]
        this.clock++
        return Promise.resolve()
    }

    getStats(): { taskUpdatesSeen: number; tasksRemaining: number; unrecoverableTasks: number } {
        return {
            tasksRemaining: Object.values(this.tasks).length,
            taskUpdatesSeen: this.clock,
            unrecoverableTasks: Object.values(this.unrecoverableTasks).length,
        }
    }

    async registerUnrecoverable(task: WorkflowTask): Promise<void> {
        await this.clearTask(task.instanceId)
        this.unrecoverableTasks[task.instanceId] = task
    }

    async recoverTasks(
        query: Partial<{ workflowType: string; taskName: string }>,
        limit: number,
    ): Promise<WorkflowTask[]> {
        // TODO: Validate limit
        const tasksToRecover = this._filterTasks(this.unrecoverableTasks, query).slice(0, limit)
        const recoveredTasks: WorkflowTask[] = []

        for (const task of tasksToRecover) {
            // Reset the attempts counter, since this is a recovered task
            const recoveredTask: WorkflowTask = Object.assign({}, task, { attempts: 0 })
            await this.updateTaskBy(recoveredTask.taskName, recoveredTask)
            delete this.unrecoverableTasks[task.instanceId]
            recoveredTasks.push(recoveredTask)
        }

        return tasksToRecover
    }

    assumingTaskIsWaitingMakeItAvailable(taskInstanceId: string): void {
        if (!this.tasks[taskInstanceId]) {
            throw new Error(`Expected task ${taskInstanceId} to be waiting, but it doesn't exist.`)
        }

        if (!this.tasks[taskInstanceId].onlyRunAfterTsMs) {
            throw new Error(`Expected task ${taskInstanceId} to be waiting, but it's not.`)
        }

        this.tasks[taskInstanceId] = Object.assign({}, this.tasks[taskInstanceId], { onlyRunAfterTsMs: undefined })
    }
}
