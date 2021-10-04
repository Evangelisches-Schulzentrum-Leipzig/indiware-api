/*
 * vertretungsplan.io indiware crawler
 * Copyright (C) 2019 - 2021 Jonas Lochmann
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

import { sortBy, uniq, uniqBy } from 'lodash'
import { ParsedPlanFile } from '../xml'
import { PlanData } from './schema'

export function mergePlanFiles (files: Array<ParsedPlanFile>): PlanData {
  if (files.length !== uniqBy(files, (item) => item.date).length) {
    throw new Error('duplicate plan files')
  }

  let freeDays: Array<string> = []
  files.forEach((item) => freeDays = [...freeDays, ...item.freeDays])
  freeDays = sortBy(uniq(freeDays))

  let classes: Array<string> = []
  files.forEach((item) => classes = [...classes, ...item.classes.map((item) => item.title)])

  classes = sortBy(uniq(classes), (className) => {
    let result = className

    for (let item of files) {
      for (let classItem of item.classes) {
        if (classItem.title === className) {
          result = classItem.sortTitle
        }
      }
    }

    return result
  })

  const plans = files.map((file) => {
    const { date, lastModified } = file

    const classPlans = classes.map((className) => {
      const dayClassData = file.classes.find((item) => item.title === className)
      const plan = (dayClassData ? dayClassData.plan : []).map((item) => ({
        lesson: item.lesson,
        subject: item.subject,
        subjectChanged: item.subjectChanged,
        teacher: item.teacher,
        teacherChanged: item.teacherChanged,
        room: item.room,
        roomChanged: item.roomChanged,
        info: item.info
      }))

      return {
        title: className,
        plan
      }
    })

    return {
      date,
      lastModified,
      classes: classPlans,
      messages: file.messages
    }
  })

  return {
    freeDays,
    classes,
    plans
  }
}
