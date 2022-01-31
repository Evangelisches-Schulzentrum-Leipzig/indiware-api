/*
 * vertretungsplan.io indiware crawler
 * Copyright (C) 2019 - 2022 Jonas Lochmann
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, version 3 of the
 * License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import express from 'express'
import { createSchoolWorkers } from './worker/index.js'

const app = express()
const workers = createSchoolWorkers()

app.get('/vp-content', (_, res) => {
  res.json({
    institutions: workers.map((worker) => ({
      id: worker.config.id,
      title: worker.config.title
    }))
  })
})

async function getStatus () {
  const institutions: Array<{
    id: string
    promise: Promise<string>
  }> = []

  workers.forEach((worker) => {
    institutions.push({
      id: worker.config.id,
      promise: worker.lastPromise
        .then(() => 'OK')
        .catch(() => 'issues at ' + worker.config.id)
    })
  })

  const resolvedPromises = await Promise.all(institutions.map((item) => item.promise))
  const filteredPromises = resolvedPromises.filter((item) => item !== 'OK')

  if (filteredPromises.length === 0) {
    if (institutions.length === 0) {
      return 'no institutions configured'
    } else {
      return 'OK'
    }
  } else {
    return filteredPromises.join('\n')
  }
}

app.get('/vp-status', (_, res) => {
  getStatus().then((result) => res.end(result)).catch(() => res.end('failed to get status'))
})

workers.forEach((worker) => {
  app.use('/vp-institution/' + worker.config.id, worker.createRouter())
})

app.listen(process.env.PORT || 8080)

console.log('ready')
