import { ImprovementRow, ComputedDifferences, ComputedDifferencesWithAverage } from "./models"
import * as path from 'path'
import * as fs from 'fs'
import * as csvWriter from 'csv-writer'
import { differenceInSeconds } from 'date-fns'
import logger from './logger'
import { PrewarmedError } from "./PrewarmedError"

type JsonsFolders = 'prewarmed' | 'pre-prewarmed'

function includePrewarned(item) {
  return item.labels.includes('prewarmed')
}

function notIncludePrewarned(item) {
  const previousToPrewarnedTags = ['atlas', 'television', 'nius', 'deportes']
  return !item.labels.includes('prewarmed') && item.labels.some(label => previousToPrewarnedTags.includes(label))
}

function getImprovementRow(item): ImprovementRow {
  const { id, startedAt, queuedAt, finishedAt } = item

  const startDate = new Date(startedAt)
  const queuedDate = new Date(queuedAt)
  const finishedDate = new Date(finishedAt)

  return {
    id,
    startedAt,
    queuedAt,
    finishedAt,
    createFinishedDiffSeconds: differenceInSeconds(finishedDate, startDate),
    createQueuedDiffSeconds: differenceInSeconds(queuedDate, startDate),
  }
}

async function generateOutput(outputFile: string, jsonsFolder: JsonsFolders, filterFunction): Promise<ComputedDifferences> {
  logger.info({ message: `Reading json files from ${jsonsFolder}`, label: jsonsFolder })
  
  if (!fs.existsSync(jsonsFolder)) {
    throw new PrewarmedError(jsonsFolder, `${jsonsFolder} directory does not exist.`)
  }
  const jsonsInDir = fs.readdirSync(jsonsFolder).filter(file => path.extname(file) === '.json')

  const writer = csvWriter.createObjectCsvWriter({
    path: path.resolve(outputFile),
    header: [
      { id: 'id', title: 'ID' },
      { id: 'startedAt', title: 'Started At' },
      { id: 'queuedAt', title: 'Queued At' },
      { id: 'finishedAt', title: 'Finished At' },
      { id: 'createQueuedDiffSeconds', title: 'Create Queued Diff Seconds' },
      { id: 'createFinishedDiffSeconds', title: 'Create Finished Diff Seconds' },
    ]
  })

  let differenceSums: ComputedDifferences = {
    createQueueDiff: 0,
    createFinishedDiff: 0,
    totalRecords: 0,
    title: jsonsFolder,
  }

  for (const file of jsonsInDir) {
    logger.info({ message: `Reading json content from ${jsonsFolder}/${file}`, label: jsonsFolder })
    const fileData = fs.readFileSync(path.join(jsonsFolder, file))
    const jsonData = JSON.parse(fileData.toString())
    const items = jsonData.data.result.items
    const filteredItems = items.filter(filterFunction)

    const mappedRows = filteredItems.map(getImprovementRow)
    differenceSums = mappedRows.reduce((acc: ComputedDifferences, item: ImprovementRow) => {
      return {
        ...differenceSums,
        createQueueDiff: acc.createQueueDiff + item.createQueuedDiffSeconds,
        createFinishedDiff: acc.createFinishedDiff + item.createFinishedDiffSeconds,
        totalRecords: acc.totalRecords + 1,
      }
    }, differenceSums)

    try {
      logger.info({ message: `Writing json content from ${jsonsFolder}/${file} to ${outputFile}`, label: jsonsFolder })
      await writer.writeRecords(mappedRows)
    } catch(error: any) {
      throw new PrewarmedError(jsonsFolder, error.message)
    }
  }

  return differenceSums
}

async function generateDifferenceOutputFile(results: ComputedDifferences[], outputFile?: string) {
  const writer = csvWriter.createObjectCsvWriter({
    path: path.resolve(outputFile || 'result.csv'),
    header: [
      { id: 'title', title: 'Title' },
      { id: 'createQueueDiff', title: 'Total Create Queue Diff (All records Queue - Start)' },
      { id: 'createFinishedDiff', title: 'Total Create Finished Diff (All records Finished - Start)' },
      { id: 'totalRecords', title: 'Total Records' },
      { id: 'createQueueDiffAvg', title: 'Create Queue Diff Avg' },
      { id: 'createFinishedDiffAvg', title: 'create Finished Diff Avg' },
    ]
  })

  const resultsMapped: ComputedDifferencesWithAverage[] = results.map(result => {
    return {
      ...result,
      createQueueDiffAvg: result.totalRecords !== 0 ? result.createQueueDiff / result.totalRecords : 0,
      createFinishedDiffAvg: result.totalRecords !== 0 ? result.createFinishedDiff / result.totalRecords : 0,
    }
  })

  await writer.writeRecords(resultsMapped)
}

async function main() {
  try {
    const prewarmedResult = await generateOutput('prewarmed.csv', 'prewarmed', includePrewarned)
    const prePrewarmedResult = await generateOutput('pre-prewarmed.csv', 'pre-prewarmed', notIncludePrewarned)
    await generateDifferenceOutputFile([prewarmedResult, prePrewarmedResult], 'differences.csv')
    logger.info({ message: 'Files generated successfully', label: 'all' })
  } catch(error: any) {
    logger.error({ message: error.message, label: error.label})
  }
}

main().then()