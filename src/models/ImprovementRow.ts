export type ImprovementRow = {
    id: string
    startedAt: string
    queuedAt: string
    finishedAt: string
    createQueuedDiffSeconds: number
    createFinishedDiffSeconds: number
}