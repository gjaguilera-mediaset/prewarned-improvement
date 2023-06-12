export type ComputedDifferences = {
    createRunningDiff: number,
    createFinishedDiff: number,
    totalRecords: number,
    title: string,
}

export type ComputedDifferencesWithAverage = ComputedDifferences & {
    createRunningDiffAvg: number,
    createFinishedDiffAvg: number,
}