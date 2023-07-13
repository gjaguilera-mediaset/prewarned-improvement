import "dotenv/config"
import { ImprovementRow, ComputedDifferences, ComputedDifferencesWithAverage } from "./models"
import * as path from 'path'
import * as csvWriter from 'csv-writer'
import { differenceInSeconds, format } from 'date-fns'
import logger from './logger'
import { PrewarmedError } from "./PrewarmedError"
import bitmovinApi from "./bitmovin"
import flatten from 'lodash/flatten'
import { Encoding } from "@bitmovin/api-sdk"

function includePrewarned(item) {
  return item.labels.includes('prewarmed')
}

function notIncludePrewarned(item) {
  const previousToPrewarnedTags = ['atlas', 'television', 'nius', 'deportes']
  return !item.labels.includes('prewarmed') && item.labels.some(label => previousToPrewarnedTags.includes(label))
}

function getImprovementRow(item): ImprovementRow {
  const { id, startedAt, runningAt, finishedAt } = item

  const startDate = new Date(startedAt)
  const runningDate = new Date(runningAt)
  const finishedDate = new Date(finishedAt)

  return {
    id,
    startedAt,
    runningAt,
    finishedAt,
    startFinishedDiffSeconds: differenceInSeconds(finishedDate, startDate),
    startRunningDiffSeconds: differenceInSeconds(runningDate, startDate),
  }
}

async function generateOutput(outputFile: string, items: Encoding[], filterFunction?: (item: Encoding) => boolean): Promise<ComputedDifferences> {
  const filename = path.parse(outputFile).name

  logger.info({ message: `Initializing writer to write content to ${outputFile}`, label: filename })
  const writer = csvWriter.createObjectCsvWriter({
    path: path.resolve(outputFile),
    header: [
      { id: 'id', title: 'ID' },
      { id: 'startedAt', title: 'Started At' },
      { id: 'runningAt', title: 'Running At' },
      { id: 'finishedAt', title: 'Finished At' },
      { id: 'startRunningDiffSeconds', title: 'Running - Start Diff Seconds' },
      { id: 'startFinishedDiffSeconds', title: 'Finished - Start Diff Seconds' },
    ]
  })

  let differenceSums: ComputedDifferences = {
    startRunningDiff: 0,
    startFinishedDiff: 0,
    totalRecords: 0,
    title: filename,
  }

  const filteredItems = filterFunction ? items.filter(filterFunction) : items

  const mappedRows = filteredItems.map(getImprovementRow)
  differenceSums = mappedRows.reduce((acc: ComputedDifferences, item: ImprovementRow): ComputedDifferences => {
    return {
      ...differenceSums,
      startRunningDiff: acc.startRunningDiff + item.startRunningDiffSeconds,
      startFinishedDiff: acc.startFinishedDiff + item.startFinishedDiffSeconds,
      totalRecords: acc.totalRecords + 1,
    }
  }, differenceSums)

  try {
    logger.info({ message: `Writing content to ${outputFile}`, label: filename })
    await writer.writeRecords(mappedRows)
  } catch(error: any) {
    throw new PrewarmedError(filename, error.message)
  }

  return differenceSums
}

async function generateDifferenceOutputFile(results: ComputedDifferences[], outputFile?: string) {
  logger.info({ message: `Initializing writer to write content to ${outputFile}`, label: 'local'})
  const writer = csvWriter.createObjectCsvWriter({
    path: path.resolve(outputFile || 'result.csv'),
    header: [
      { id: 'title', title: 'Title' },
      { id: 'startRunningDiff', title: 'Total Running - Start Diff (All records Running - Start) - Seconds' },
      { id: 'startFinishedDiff', title: 'Total Finished - Start Diff (All records Finished - Start) - Seconds' },
      { id: 'totalRecords', title: 'Total Records' },
      { id: 'startRunningDiffAvg', title: 'Running - Start Diff Avg (Seconds)' },
      { id: 'startFinishedDiffAvg', title: 'Finished - Start Diff Avg (Seconds)' },
    ]
  })

  const resultsMapped: ComputedDifferencesWithAverage[] = results.map((result: ComputedDifferences): ComputedDifferencesWithAverage => {
    return {
      ...result,
      startRunningDiffAvg: result.totalRecords !== 0 ? result.startRunningDiff / result.totalRecords : 0,
      startFinishedDiffAvg: result.totalRecords !== 0 ? result.startFinishedDiff / result.totalRecords : 0,
    }
  })

  try {
    logger.info({ message: `Writing differences to ${outputFile}`, label: 'local'})
    await writer.writeRecords(resultsMapped)
  } catch(error: any) {
    throw new PrewarmedError('local', error.message)
  }
}

async function fetchEncodingsFromGivenRange(createdAtNewerThan: Date, createdAtOlderThan: Date): Promise<Array<Encoding>> {
  try {
    const dateFormat = 'yyyy-MM-dd'
    logger.info({ 
      message: `Fetching total amount of records from ${format(createdAtNewerThan, dateFormat)} to ${format(createdAtOlderThan, dateFormat)}`, 
      label: 'bitmovin' 
    })
    const result = await bitmovinApi.encoding.encodings.list({ 
      status: "FINISHED",
      limit: 100,
      offset: 0,
      createdAtNewerThan,
      createdAtOlderThan,
     })

     const amountOfPages = (result.totalCount || 0) / 100
     const realAmountOfPages: number = Math.ceil(amountOfPages)

     const requests = Array.from({ length: realAmountOfPages }).map((_, index) => {
      return bitmovinApi.encoding.encodings.list({
        status: "FINISHED",
        limit: 100,
        offset: 100 * index,
        createdAtNewerThan,
        createdAtOlderThan,
        includeTotalCount: true,
      })
     })

    logger.info({ 
      message: `Initializing requests to fetch ${result.totalCount} records`,
      label: 'bitmovin' 
    })
     const requestsResponse = await Promise.all([...requests])
     const requestsResponseMapped = requestsResponse.map(response => response.items)
     const items: Encoding[] = flatten(requestsResponseMapped)

     return items
  } catch(error: any) {
    throw new PrewarmedError('bitmovin', error.message)
  }
}

async function main() {
  try {
    const prewarmedApiResponse = await fetchEncodingsFromGivenRange(
      new Date('2023-05-01T01:00:00.000Z'), 
      new Date('2023-05-28T23:59:59.999Z')
    )

    const prePrewarmedApiResponse = await fetchEncodingsFromGivenRange(
      new Date('2023-02-01T01:00:00.000Z'), 
      new Date('2023-02-28T23:59:59.999Z')
    )

    const prewarmedResult = await generateOutput('prewarmed.csv', prewarmedApiResponse, includePrewarned)
    const prePrewarmedResult = await generateOutput('pre-prewarmed.csv', prePrewarmedApiResponse, notIncludePrewarned)

    await generateDifferenceOutputFile([prewarmedResult, prePrewarmedResult], 'differences.csv')

    logger.info({ message: 'Files generated successfully', label: 'local' })
  } catch(error: any) {
    logger.error({ message: error.message, label: error.label})
  }
}

main().then()