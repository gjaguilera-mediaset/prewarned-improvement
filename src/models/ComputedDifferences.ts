export type ComputedDifferences = {
    createQueueDiff: number,
    createFinishedDiff: number,
    totalRecords: number,
    title: string,
}

export type ComputedDifferencesWithAverage = ComputedDifferences & {
    createQueueDiffAvg: number,
    createFinishedDiffAvg: number,
}