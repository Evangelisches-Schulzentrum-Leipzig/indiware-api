/*
 * vertretungsplan.io indiware crawler
 * Copyright (C) 2019 - 2025 Jonas Lochmann
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
import { fetchOptions } from '../request.js'
import { mergePlanFiles, PlanData } from '../data/index.js'
import { ParsedPlanFile, parsePlanFile } from '../xml/index.js'

const { without } = lodash

const lastETagByUrl: Map<string, string> = new Map()
const lastModifiedByUrl: Map<string, string> = new Map()

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
    const headersWithETag = { 
      ...headers, 
      'If-None-Match': lastETagByUrl.get(planUrl) || ''
    }

    // Prefetch HEAD to get ETag   
    const headResponse = await fetch(planUrl, { method: 'HEAD', ...fetchOptions, headers: headers, signal })

    if ((headResponse.status === 300) || (headResponse.status === 404) || (headResponse.status === 503)) {
      // ignore this date, there is no plan for it

      return null
    }
    
    // console.log('fetching GET plan url', planUrl)
    const planContent = await fetch(planUrl, { ...fetchOptions, headers: headersWithETag, signal })

    if (planContent.status === 304) {
      // check if last modified date is 24 hours from last fetch
      const lastModified = planContent.headers.get('Last-Modified')
      const previousLastModified = lastModifiedByUrl.get(planUrl)
      
      if (lastModified && previousLastModified) {
        const lastModifiedTime = new Date(lastModified).getTime()
        const previousLastModifiedTime = new Date(previousLastModified).getTime()
        if ((lastModifiedTime - previousLastModifiedTime) < (24 * 60 * 60 * 1000)) {
          // not modified based on ETag and Last Modified Date diffrence smaller than 24 hours, skip this date

          return null
        }
        // continue to fetch the plan as it might have changed
      } else {
        // not modified based on ETag, skip this date

        return null
      }
    }

    if (planContent.status !== 200) {
      throw new Error('failed to query ' + planUrl + ' - ' + planContent.status)
    }

    if (planContent.headers.has('ETag') && planContent.headers.get('ETag') !== null) {
      lastETagByUrl.set(planUrl, planContent.headers.get('ETag') || "")
    }
    if (planContent.headers.has('Last-Modified') && planContent.headers.get('Last-Modified') !== null) {
      lastModifiedByUrl.set(planUrl, planContent.headers.get('Last-Modified') || "")
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
    const planContent = await fetch(planUrl, { ...fetchOptions, headers, signal })

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
