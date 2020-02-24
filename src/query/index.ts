/*
 * vertretungsplan.io indiware crawler
 * Copyright (C) 2019 - 2020 Jonas Lochmann
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

import { without } from 'lodash'
import * as moment from 'moment-timezone'
import * as request from 'request-promise-native'
import { mergePlanFiles, PlanData } from '../data'
import { ParsedPlanFile, parsePlanFile } from '../xml'

export async function query ({ url, timezone, locale }: {
  url: string
  timezone: string
  locale: string
}): Promise<PlanData> {
  const time = moment()
  const dates: Array<moment.Moment> = []

  for (let i = 0; i < 7; i++) {
    dates.push(time.clone())
    time.add(1, 'day')
  }

  const dataByDate: Array<ParsedPlanFile | null> = await Promise.all(dates.map(async (date) => {
    const dateForUrl = date.format('YYYYMMDD')
    const expectedDate = date.format('YYYY-MM-DD')

    const planUrl = url + 'PlanKl' + dateForUrl + '.xml'
    const planContent: request.FullResponse = await request({
      uri: planUrl,
      simple: false,
      resolveWithFullResponse: true
    })

    if ((planContent.statusCode === 300) || (planContent.statusCode === 404)) {
      // ignore this date, there is no plan for it

      return null
    }

    if (planContent.statusCode !== 200) {
      throw new Error('failed to query ' + planUrl + ' - ' + planContent.statusCode)
    }

    const parsedPlanFile = parsePlanFile({
      input: planContent.body,
      timezone,
      locale
    })

    if (parsedPlanFile.date !== expectedDate) {
      throw new Error('requested plan for ' + expectedDate + ' but got data for ' + parsedPlanFile.date)
    }

    return parsedPlanFile
  }))

  const data = without(dataByDate, null) as Array<ParsedPlanFile>

  if (data.length === 0) {
    const planUrl = url + 'Klassen.xml'
    const planContent: request.FullResponse = await request({
      uri: planUrl,
      simple: false,
      resolveWithFullResponse: true
    })

    if ((planContent.statusCode === 300) || (planContent.statusCode === 404)) {
      throw new Error('no fallback plan found')
    }

    if (planContent.statusCode !== 200) {
      throw new Error('failed to query ' + planUrl + ' - ' + planContent.statusCode)
    }

    const parsedPlanFile = parsePlanFile({
      input: planContent.body,
      timezone,
      locale
    })

    return mergePlanFiles([ parsedPlanFile ])
  }

  return mergePlanFiles(data)
}
