import { ImprovementRow, ComputedDifferences } from "./models"
import * as path from 'path'
import * as fs from 'fs'
import * as csvWriter from 'csv-writer'
import { differenceInSeconds } from 'date-fns'

type JsonsFolders = 'prewarmed' | 'nonPrewarned'

function includePrewarned(item) {
  return item.labels.includes('prewarmed')
}

function notIncludePrewarned(item) {
  const previousToPrewarnedTags = ['atlas', 'nius']
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
  const jsonsInDir = fs.readdirSync(jsonsFolder).filter(file => path.extname(file) === '.json')

  const writer = csvWriter.createObjectCsvWriter({
    path: path.resolve(outputFile),
    header: [
      { id: 'id', title: 'ID' },
      { id: 'startedAt', title: 'StartedAt' },
      { id: 'queuedAt', title: 'QueuedAt' },
      { id: 'finishedAt', title: 'FinishedAt' },
      { id: 'createQueuedDiffSeconds', title: 'CreateQueuedDiffSeconds' },
      { id: 'createFinishedDiffSeconds', title: 'createFinishedDiffSeconds' },
    ]
  })

  let differenceSums: ComputedDifferences = {
    createQueueDiff: 0,
    createFinishedDiff: 0,
    totalRecords: 0
  }

  for (const file in jsonsInDir) {
    const fileName = jsonsInDir[file]
    const fileData = fs.readFileSync(path.join(jsonsFolder, fileName))
    const jsonData = JSON.parse(fileData.toString())
    const items = jsonData.data.result.items
    const filteredItems = items.filter(filterFunction)

    const mappedRows = filteredItems.map(getImprovementRow)
    differenceSums = mappedRows.reduce((acc: ComputedDifferences, item: ImprovementRow) => {
      return {
        createQueueDiff: acc.createQueueDiff + item.createQueuedDiffSeconds,
        createFinishedDiff: acc.createFinishedDiff + item.createFinishedDiffSeconds,
        totalRecords: acc.totalRecords + 1,
      }
    }, differenceSums)

    await writer.writeRecords(mappedRows)
  }

  return differenceSums
}

async function main() {
  try {
    const result = await generateOutput('result.csv', 'prewarmed', includePrewarned)
    console.log("Result", result)
  } catch(error) {
    console.error("An error occurred while writing records to file", error)
  }
}

main().then()