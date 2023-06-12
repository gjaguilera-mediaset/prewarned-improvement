export type ComputedDifferences = {
    startRunningDiff: number,
    startFinishedDiff: number,
    totalRecords: number,
    title: string,
}

export type ComputedDifferencesWithAverage = ComputedDifferences & {
    startRunningDiffAvg: number,
    startFinishedDiffAvg: number,
}