import { FetchStrategy, StateStore } from '@gamgee/interfaces/store'
import { WorkflowTask } from '@gamgee/interfaces/task'

export default class InMemoryStateStore implements StateStore {
    private clock: number = 0
    private readonly tasks: { [id: string]: WorkflowTask & { clock: number } } = {}
    private readonly unrecoverableTasks: { [id: string]: WorkflowTask } = {}

    async upsertTask(newTask: WorkflowTask): Promise<void> {
        this.tasks[newTask.id] = Object.assign({ clock: this.clock }, newTask)
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

            return true
        })
    }

    async clearTask(id: WorkflowTask['id']): Promise<void> {
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
        await this.clearTask(task.id)
        this.unrecoverableTasks[task.id] = task
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
            await this.upsertTask(recoveredTask)
            delete this.unrecoverableTasks[task.id]
            recoveredTasks.push(recoveredTask)
        }

        return tasksToRecover
    }
}
