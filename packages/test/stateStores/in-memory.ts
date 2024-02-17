import {FetchStrategy, StateStore} from "@gamgee/interfaces/store";
import {WorkflowTask} from "@gamgee/interfaces/task";

export default class InMemoryStateStore implements StateStore {
    private clock: number = 0;
    private readonly tasks: { [id: string]: WorkflowTask & { clock: number } } = {};

    async upsertTask(newTask: WorkflowTask): Promise<void> {
        this.tasks[newTask.id] = Object.assign({ clock: this.clock }, newTask);
        this.clock++;
    }

    async tryFetchingTask(query: Partial<{
        workflowType: string;
        taskName: string;
        strategy: FetchStrategy;
    }>, timeoutMs: number): Promise<WorkflowTask | null> {
        const validTasks: (WorkflowTask & { clock: number })[] = Object.values(this.tasks)
            .filter((task) => {
                if (query.workflowType && task.typeId !== query.workflowType) {
                    return false;
                }

                if (query.taskName && task.taskName !== query.taskName) {
                    return false;
                }
                
                return true;
            })
        
        if (validTasks.length === 0) {
            return null;
        }
        
        const sortedTasks = validTasks.sort((a, b) => a.clock - b.clock)
        
        switch (query.strategy) {
            case undefined: case FetchStrategy.Oldest:
                return sortedTasks[0];
                
            case FetchStrategy.Newest:
                return sortedTasks[sortedTasks.length - 1];
                
            default:
                throw new Error("Not implemented... yet.");
        }
    }

    async clearTask(id: WorkflowTask['id']): Promise<void> {
        delete this.tasks[id];
        this.clock++;
    }
    
    getStats(): { taskUpdatesSeen: number; tasksRemaining: number } {
        return {
            tasksRemaining: Object.values(this.tasks).length,
            taskUpdatesSeen: this.clock,
        }
    }
}