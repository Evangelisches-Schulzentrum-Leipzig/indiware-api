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
import { PlanData } from '../../data/index.js'
import {
  ServableContent, PlanContent, PlanItem, ConfigResponse,
  ContentResponse, ContentResponseMessage
} from './types.js'
import { buildConditionSets } from './conditionsets.js'
import { buildConfigItems } from './config.js'
import { buildContentSetNames, buildContentSetConfigSection } from './content-sets.js'
import { mergeContents, renameDefaultConfigScreen } from './merge.js'
import { buildParameterNames } from './param-names.js'

const { flatten } = lodash

export function buildServableContent ({ legacy, student, teacher }: {
  legacy: boolean
  student: {
    data: PlanData
    password: string | null
  },
  teacher: {
    data: PlanData
    password: string | null
  } | null
}): ServableContent {
  const studentResult = buildServableContentForSingleUserCategory({
    prefix: legacy ? '' : 'student-',
    data: student.data,
    password: student.password
  })

  if (teacher === null) {
    return renameDefaultConfigScreen(studentResult)
  }

  if (legacy) throw new Error('legacy does not support teachers')

  const teacherResult = buildServableContentForSingleUserCategory({
    prefix: 'teacher-',
    data: teacher.data,
    password: teacher.password
  })

  const result = mergeContents(studentResult, teacherResult)
  const userTypeField = 'userType'
  const userTypeStudent = 'student'
  const userTypeTeacher = 'teacher'
  const conditionSetStudent = 'isStudent'
  const conditionSetTeacher = 'isTeacher'
  const conditionSetAnyUserType = 'isValidUserType'

  result.startConfigScreenName = 'user-type-selection'
  result.configs.set('user-type-selection', {
    content: {
      config: [
        {
          type: 'radio',
          param: userTypeField,
          label: 'Schüler',
          value: userTypeStudent,
          visibilityConditionId: '_true'
        },
        {
          type: 'radio',
          param: userTypeField,
          label: 'Lehrer',
          value: userTypeTeacher,
          visibilityConditionId: '_true'
        },
        {
          type: 'divider',
          param: '',
          label: '',
          value: '',
          visibilityConditionId: conditionSetAnyUserType
        },
        {
          type: 'otherConfigBucket',
          param: '',
          label: '',
          value: studentResult.startConfigScreenName,
          visibilityConditionId: conditionSetStudent
        },
        {
          type: 'otherConfigBucket',
          param: '',
          label: '',
          value: teacherResult.startConfigScreenName,
          visibilityConditionId: conditionSetTeacher
        },
      ],
      contentBucketSets: [],
      conditionSets: [
        {
          id: conditionSetStudent,
          type: 'paramIs',
          left: userTypeField,
          right: userTypeStudent
        },
        {
          id: conditionSetTeacher,
          type: 'paramIs',
          left: userTypeField,
          right: userTypeTeacher
        },
        {
          id: conditionSetAnyUserType,
          type: 'or',
          left: conditionSetStudent,
          right: conditionSetTeacher
        }
      ],
      configValidationConditionId: conditionSetAnyUserType
    },
    password: null
  })

  return renameDefaultConfigScreen(result)
}

function buildServableContentForSingleUserCategory({ prefix, data, password }: {
  prefix: string
  data: PlanData
  password: string | null
}): ServableContent {
  const classNameField = prefix + 'class'
  const passwordField = prefix + 'password'
  const parameters = buildParameterNames({ data, prefix })
  const contentSets = buildContentSetNames({ data, prefix })
  const conditions = buildConditionSets({ data, classNameField, parameters, prefix })
  const config = buildConfigItems({ data, classNameField, conditions, parameters })
  const contentBucketSets = buildContentSetConfigSection({
    data,
    passwordField: password ? passwordField : null,
    conditions,
    contentSets
  })

  const mainConfigScreen: ConfigResponse = {
    config,
    configValidationConditionId: conditions.finalValidation,
    contentBucketSets,
    conditionSets: conditions.items
  }

  const configs = new Map<string, { content: ConfigResponse, password: string | null }>()
  const startConfigScreenName = prefix + 'start'
  const plans = new Map<string, { content: PlanContent, password: string | null }>()
  const contents = new Map<string, { content: ContentResponse, password: string | null }>()

  if (password === null) {
    configs.set(startConfigScreenName, { content: mainConfigScreen, password: null })
  } else {
    const mainConfigScreenName = prefix + 'main'

    configs.set(startConfigScreenName, {
      password: null,
      content: {
        config: [
          {
            param: passwordField,
            type: 'password',
            visibilityConditionId: '_true',
            value: '',
            label: 'Passwort'
          },
          {
            param: passwordField,
            type: 'otherConfigBucket',
            visibilityConditionId: prefix + 'has-password',
            value: mainConfigScreenName,
            label: ''
          }
        ],
        configValidationConditionId: prefix + 'has-password',
        contentBucketSets: [],
        conditionSets: [
          {
            id: prefix + 'has-password',
            type: 'paramNotEmpty',
            left: passwordField,
            right: ''
          }
        ]
      }
    })

    configs.set(mainConfigScreenName, { content: mainConfigScreen, password })
  }

  data.classes.map((classItem, classIndex) => {
    const itemsFull: Array<PlanItem> = []
    const itemsBase: Array<PlanItem> = []
    const itemsPerCourse = new Map<string, Array<PlanItem>>()

    classItem.courses.forEach((courseItem) => itemsPerCourse.set(courseItem.name, []))

    data.plans.forEach((plan) => {
      flatten(plan
        .classes
        .filter((item) => item.title === classItem.name)
        .map((item) => item.plan)
      ).forEach((item) => {
        const preparedItem = {
          date: plan.date,
          class: classItem.name,
          lesson: item.lesson,
          subject: item.subject,
          subjectChanged: item.subjectChanged,
          teacher: item.teacher,
          teacherChanged: item.teacherChanged,
          room: item.room,
          roomChanged: item.roomChanged,
          info: item.info,
          startTime: item.startTime,
          endTime: item.endTime
        }

        itemsFull.push(preparedItem)

        if (item.course === null) {
          itemsBase.push(preparedItem)
        } else {
          (itemsPerCourse.get(item.course) || itemsBase).push(preparedItem)
        }
      })
    })

    plans.set(contentSets.full[classIndex], { content: { items: itemsFull }, password })
    plans.set(contentSets.base[classIndex], { content: { items: itemsBase }, password })

    classItem.courses.forEach((courseItem, courseIndex) => plans.set(
      contentSets.course[classIndex][courseIndex],
      // it is a bug if the item is not in the map
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      { content: { items: itemsPerCourse.get(courseItem.name)! }, password }
    ))

    contents.set(contentSets.content[classIndex], {
      content: {
        file: [],
        message: flatten(flatten(
          data.plans.map((plan) => (
            plan.classes
              .filter((item) => classItem.name === item.title)
              .map((item) => (
                item.supervisions.map((supervision, index) => {
                  let typeName

                  if (supervision.type === 'regular') typeName = 'regulär'
                  else if (supervision.type === 'cancel') typeName = 'entfällt'
                  else if (supervision.type === 'substitute') typeName = 'Vertretung'
                  else throw new Error()

                  const baseTitle = plan.date + ' - Aufsicht vor Stunde ' + supervision.prevLessonIndex
                  const title = supervision.type === 'regular' ? baseTitle : `${typeName} - ${baseTitle}`

                  const content = [
                    supervision.time1,
                    supervision.time2,
                    supervision.replacementFor ? 'Ersatz für ' + supervision.replacementFor : null,
                    supervision.info
                  ].filter((item) => item !== null).join('\n')

                  const message: ContentResponseMessage = {
                    id: plan.date + '-' + index,
                    title,
                    content,
                    notify: supervision.type !== 'regular'
                  }

                  return message
                })
              ))
          )))
        )
      },
      password
    })
  })

  contents.set(contentSets.default, {
    content: {
      file: [],
      message: flatten(
        data.plans.map((plan) => (
          plan.messages.map((message, index) => ({
            id: plan.date + '-' + index,
            title: plan.date,
            content: message,
            notify: false
          }))
        ))
      )
    },
    password
  })

  return { configs, startConfigScreenName, plans, contents }
}
