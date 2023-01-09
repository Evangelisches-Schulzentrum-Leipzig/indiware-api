/*
 * vertretungsplan.io indiware crawler
 * Copyright (C) 2019 - 2023 Jonas Lochmann
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
import { ParsedPlanFile } from '../xml/index.js'
import { PlanData, PlanSupervision } from './schema.js'

const { sortBy, uniq, uniqBy } = lodash

export function mergePlanFiles (files: Array<ParsedPlanFile>): PlanData {
  if (files.length !== uniqBy(files, (item) => item.date).length) {
    throw new Error('duplicate plan files')
  }

  let freeDays: Array<string> = []
  files.forEach((item) => freeDays = [...freeDays, ...item.freeDays])
  freeDays = sortBy(uniq(freeDays))

  const classesTemp = new Map<string, {
    courses: Map<string, { /* teacher: string */ }>
    sortTitle: string
    supervisions: Array<PlanSupervision>
  }>()

  files.forEach((filesItem) => {
    filesItem.classes.forEach((newClassItem) => {
      const existingItem = classesTemp.get(newClassItem.title)
      let courses: Map<string, { /* teacher: string */ }>

      if (existingItem) {
        courses = existingItem.courses
      } else {
        courses = new Map<string, { teacher: string }>()

        classesTemp.set(newClassItem.title, {
          courses,
          sortTitle: newClassItem.sortTitle,
          supervisions: newClassItem.supervisions
        })
      }

      newClassItem.courses.forEach((course) => courses.set(course.name, { /* teacher: course.teacher */ }))
    })
  })

  let classes: Array<{
    name: string
    courses: Array<{
      name: string
      // teacher: string
    }>
    supervisions: Array<PlanSupervision>
    sortTitle: string
  }> = []

  classesTemp.forEach(({ courses, sortTitle, supervisions }, name) => {
    const coursesNew: Array<{
      name: string
      // teacher: string
    }> = []

    courses.forEach((_, name) => coursesNew.push({
      name,
      // teacher
    }))

    classes.push({
      name,
      courses: sortBy(coursesNew, (course) => course.name),
      supervisions,
      sortTitle
    })
  })

  classes = sortBy(classes, (classItem) => classItem.sortTitle)

  const plans = files.map((file) => {
    const { date, lastModified } = file

    const classPlans = classes.map((classItem) => {
      const dayClassData = file.classes.find((item) => item.title === classItem.name)
      const plan = (dayClassData ? dayClassData.plan : []).map((item) => ({
        lesson: item.lesson,
        subject: item.subject,
        subjectChanged: item.subjectChanged,
        teacher: item.teacher,
        teacherChanged: item.teacherChanged,
        room: item.room,
        roomChanged: item.roomChanged,
        info: item.info,
        course: item.course
      }))

      return {
        title: classItem.name,
        plan,
        supervisions: classItem.supervisions
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
    classes: classes.map((item) => ({
      name: item.name,
      courses: item.courses
    })),
    plans
  }
}
