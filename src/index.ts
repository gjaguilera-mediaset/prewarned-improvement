import { ImprovementRow } from "./models/ImprovementRow"
import * as path from 'path'
import * as fs from 'fs'
import * as csvWriter from 'csv-writer'
import { differenceInSeconds } from 'date-fns'

function includePrewarned(item) {
  return item.labels.includes('prewarmed')
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

function main() {
  const writer = csvWriter.createObjectCsvWriter({
    path: path.resolve('result.csv'),
    header: [
      { id: 'id', title: 'ID' },
      { id: 'startedAt', title: 'StartedAt' },
      { id: 'queuedAt', title: 'QueuedAt' },
      { id: 'finishedAt', title: 'FinishedAt' },
      { id: 'createQueuedDiffSeconds', title: 'CreateQueuedDiffSeconds' },
      { id: 'createFinishedDiffSeconds', title: 'createFinishedDiffSeconds' },
    ]
  })

  const jsonsInDir = fs.readdirSync('./jsons').filter(file => path.extname(file) === '.json')

  let differenceSums = {
    createQueueDiff: 0,
    createFinishedDiff: 0,
    totalRecords: 0
  }

  jsonsInDir.forEach(file => {
    const fileData = fs.readFileSync(path.join('./jsons', file))
    const jsonData = JSON.parse(fileData.toString())
    const items = jsonData.data.result.items
    const filteredItems = items.filter(includePrewarned)

    const mappedRows = filteredItems.map(getImprovementRow)
    differenceSums = mappedRows.reduce((acc, item: ImprovementRow) => {
      return {
        createQueueDiff: acc.createQueueDiff + item.createQueuedDiffSeconds,
        createFinishedDiff: acc.createFinishedDiff + item.createFinishedDiffSeconds,
        totalRecords: acc.totalRecords + 1,
      }
    }, differenceSums)

    writer.writeRecords(mappedRows).then(() => console.info('File written successfully!'))

    console.info("Results", differenceSums)
  })
}

main()