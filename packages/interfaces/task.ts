export type WorkflowTask = {
    readonly id: string
    readonly typeId: string
    readonly taskName: string
    readonly serializedPayload: string
    readonly attempts: number
}
