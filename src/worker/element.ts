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

import auth from 'basic-auth'
import { Request, Response, Router } from 'express'
import timeoutSignal from 'timeout-signal'
import { SchoolConfiguration } from '../config'
import { query } from '../query/index.js'
import { sleep } from '../util/sleep.js'
import { buildServableContent, ServableContent } from './servable-content/index.js'

export class SchoolWorker {
  readonly config: SchoolConfiguration
  lastPromise: Promise<ServableContent>
  lastSuccessPromise: Promise<ServableContent>

  constructor (config: SchoolConfiguration) {
    this.config = config

    const firstPromise = sleep(Math.random() * 1000 * 10 /* wait up to 10 seconds */).then(() => this.doQuery())

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

    for (;;) {
      await sleep(1000 * 60 * 5 /* 5 minutes */)

      try {
        const newContent = await this.doQuery()

        this.lastPromise = Promise.resolve(newContent)
        this.lastSuccessPromise = Promise.resolve(newContent)
      } catch (ex) {
        console.warn('crawling failed', ex)

        this.lastPromise = Promise.reject(ex)

        // required to prevent an unhandled Promise rejection
        this.lastPromise.catch(() => null)
      }
    }
  }

  private async doQuery() {
    const studentResponse = await query({
      url: this.config.student.url,
      username: 'schueler',
      password: this.config.student.password,
      locale: this.config.locale,
      timezone: this.config.timezone,
      type: 'student',
      signal: timeoutSignal(1000 * 60 * 10)
    })

    const student = {
      data: studentResponse,
      password: this.config.skipPasswordCheck ? null : this.config.student.password
    }

    const teacher = await (async () => {
      if (this.config.teacher === null) return null

      const teacherResponse = await query({
        url: this.config.teacher.url,
        username: 'lehrer',
        password: this.config.teacher.password,
        locale: this.config.locale,
        timezone: this.config.timezone,
        type: 'teacher',
        signal: timeoutSignal(1000 * 60 * 10)
      })

      return {
        data: teacherResponse,
        password: this.config.skipPasswordCheck ? null : this.config.teacher.password
      }
    })()

    const newContent = buildServableContent({
      legacy: this.config.legacy,
      student,
      teacher
    })

    return newContent
  }

  createRouter (): Router {
    const router = Router()

    const isAuthValid = (req: Request, res: Response, password: string) => {
        const authData = auth(req)

        if ((!authData) || authData.pass !== password) {
          res.setHeader('WWW-Authenticate', 'Basic realm="Login"')
          res.sendStatus(401)
          return false
        }

      return true
    }

    router.get('/config/:name', (req, res, next) => {
      this.lastSuccessPromise.then((data) => {
        const config = data.configs.get(req.params.name)

        if (config === undefined) res.sendStatus(404)
        else if (config.password !== null && !isAuthValid(req, res, config.password)) return
        else res.json(config.content)
      }).catch((ex) => next(ex))
    })

    router.get('/content/:name', (req, res, next) => {
      this.lastSuccessPromise.then((data) => {
        const content = data.contents.get(req.params.name)

        if (content === undefined) res.sendStatus(404)
        else if (content.password !== null && !isAuthValid(req, res, content.password)) return
        else res.json(content.content)
      }).catch((ex) => next(ex))
    })

    router.get('/plan/:name', (req, res, next) => {
      this.lastSuccessPromise.then((data) => {
        const plan = data.plans.get(req.params.name)

        if (plan === undefined) res.sendStatus(404)
        else if (plan.password !== null && !isAuthValid(req, res, plan.password)) return
        else res.json(plan.content)
      }).catch((ex) => next(ex))
    })

    return router
  }
}
