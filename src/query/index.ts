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

import lodash from 'lodash'
import moment, { Moment } from 'moment-timezone'
import fetch from 'node-fetch'
import { mergePlanFiles, PlanData } from '../data/index.js'
import { ParsedPlanFile, parsePlanFile } from '../xml/index.js'

const { without } = lodash

type PlanType = 'student' | 'teacher'

export async function query ({ url, username, password, timezone, locale, signal, type }: {
  url: string
  username: string
  password: string
  timezone: string
  locale: string
  signal: AbortSignal
  type: PlanType
}): Promise<PlanData> {
  const skipClassNameValidation = type === 'teacher'

  const time = moment()
  const dates: Array<Moment> = []

  for (let i = 0; i < 7; i++) {
    dates.push(time.clone())
    time.add(1, 'day')
  }

  const headers = {
    'Authorization': 'Basic ' + Buffer.from(username + ':' + password, 'utf8').toString('base64')
  }

  const dataByDate: Array<ParsedPlanFile | null> = await Promise.all(dates.map(async (date) => {
    const dateForUrl = date.format('YYYYMMDD')
    const expectedDate = date.format('YYYY-MM-DD')

    const planUrl = url + 'Plan' + (type === 'student' ? 'Kl' : 'Le') + dateForUrl + '.xml'
    const planContent = await fetch(planUrl, { headers, signal })

    if ((planContent.status === 300) || (planContent.status === 404) || (planContent.status === 503)) {
      // ignore this date, there is no plan for it

      return null
    }

    if (planContent.status !== 200) {
      throw new Error('failed to query ' + planUrl + ' - ' + planContent.status)
    }

    const parsedPlanFile = parsePlanFile({
      input: await planContent.text(),
      timezone,
      locale,
      skipClassNameValidation
    })

    if (parsedPlanFile.date !== expectedDate) {
      throw new Error('requested plan for ' + expectedDate + ' but got data for ' + parsedPlanFile.date)
    }

    return parsedPlanFile
  }))

  const data = without(dataByDate, null) as Array<ParsedPlanFile>

  if (data.length === 0) {
    const planUrl = url + (type === 'student' ? 'Klassen' : 'Lehrer') + '.xml'
    const planContent = await fetch(planUrl, { headers, signal })

    if ((planContent.status === 300) || (planContent.status === 404)) {
      throw new Error('no fallback plan found')
    }

    if (planContent.status !== 200) {
      throw new Error('failed to query ' + planUrl + ' - ' + planContent.status)
    }

    const parsedPlanFile = parsePlanFile({
      input: await planContent.text(),
      timezone,
      locale,
      skipClassNameValidation
    })

    return mergePlanFiles([ parsedPlanFile ])
  }

  return mergePlanFiles(data)
}
