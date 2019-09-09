/*
 * vertretungsplan.io indiware crawler
 * Copyright (C) 2019 Jonas Lochmann
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

import { Router } from 'express'
import { SchoolConfiguration } from '../config'
import { PlanData } from '../data'
import { query } from '../query'
import { sleep } from '../util/sleep'

function urlSafeClassName (input: string) {
  return input.split('/').join('-')
}

export class SchoolWorker {
  readonly config: SchoolConfiguration
  lastPromise: Promise<PlanData>
  lastSuccessPromise: Promise<PlanData>

  constructor (config: SchoolConfiguration) {
    this.config = config

    const firstPromise = sleep(Math.random() * 1000 * 10 /* wait up to 10 seconds */).then(() => (
      query({
        url: config.url,
        locale: config.locale,
        timezone: config.timezone
      })
    ))

    firstPromise.catch((ex) => { console.warn('initial query failed for ' + config.id, ex) })

    this.lastPromise = this.lastSuccessPromise = firstPromise

    this.initWorker().catch((ex) => {
      console.warn('worker crashed', ex)

      process.exit(1)
    })
  }

  private async initWorker () {
    try {
      await this.lastPromise
    } catch (ex) {
      // ignore
    }

    while (true) {
      await sleep(1000 * 60 * 5 /* 5 minutes */)

      try {
        const newResponse = await query({
          url: this.config.url,
          locale: this.config.locale,
          timezone: this.config.timezone
        })

        this.lastPromise = Promise.resolve(newResponse)
        this.lastSuccessPromise = Promise.resolve(newResponse)
      } catch (ex) {
        console.warn('crawling failed', ex)

        this.lastPromise = Promise.reject(ex)
      }
    }
  }

  createRouter (): Router {
    const router = Router()

    router.get('/config/default', (_, res, next) => {
      this.lastSuccessPromise.then((data) => {
        res.json({
          config: data.classes.map((className) => ({
            param: this.config.classNameField,
            type: 'radio',
            value: className,
            label: className,
            visibilityConditionId: '_true'
          })),
          configValidationConditionId: 'hasClassSelection',
          contentBucketSets: data.classes.map((className) => ({
            id: urlSafeClassName(className),
            usageConditionId: 'isClassSelected-' + className,
            type: 'plan'
          })),
          conditionSets: [
            ...data.classes.map((className) => ({
              id: 'isClassSelected-' + className,
              type: 'paramIs',
              left: this.config.classNameField,
              right: className
            })),
            ...data.classes.map((className, index) => ({
              id: index === 0 ? 'hasClassSelection' : ('hasClassSelection' + index),
              type: 'or',
              left: 'isClassSelected-' + className,
              right: index < data.classes.length - 1 ? ('hasClassSelection' + (index + 1)) : '_false'
            }))
          ]
        })
      }).catch((ex) => next(ex))
    })

    router.get('/plan/:planid', (req, res, next) => {
      const planId: string = req.params.planid

      this.lastSuccessPromise.then((data) => {
        const className = data.classes.find((item) => urlSafeClassName(item) === planId)

        if (!className) {
          res.sendStatus(404)
          return
        }

        const items: Array<{
          date: string
          class: string
          lesson: number
          subject: string | null
          subjectChanged: boolean
          teacher: string | null
          teacherChanged: boolean
          room: string | null
          roomChanged: boolean
          info: string | null
        }> = []

        data.plans.forEach((planDay) => {
          const planClass = planDay.classes.find((planClass) => planClass.title === className)

          if (planClass) {
            planClass.plan.forEach((item) => {
              items.push({
                date: planDay.date,
                class: className,
                lesson: item.lesson,
                subject: item.subject,
                subjectChanged: item.subjectChanged,
                teacher: item.teacher,
                teacherChanged: item.teacherChanged,
                room: item.room,
                roomChanged: item.roomChanged,
                info: item.info
              })
            })
          }
        })

        res.json({
          items
        })
      }).catch((ex) => next(ex))
    })

    return router
  }
}
