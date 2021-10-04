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

import { flatten } from 'lodash'
import { PlanData } from '../data'

interface PlanItem {
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
}

interface PlanContent {
  items: Array<PlanItem>
}

export interface ServableContent {
  configs: Map<string, object>
  plans: Map<string, PlanContent>
  contents: Map<string, object>
}

interface ParameterNames {
  enableCourseSelection: Array<string>
  enableSpecificCourse: Array<Array<string>>
}

export interface Conditions {
  items: Array<object>
  finalValidation: string
  isSpecificClassSelected: Array<string>
  classAndManualCourseSelectionEnabled: Array<string>
  classAndAllForceAllCoursesEnabled: Array<string>
  classAndSpecificCourseEnabled: Array<Array<string>>
}

interface ContentSetNames {
  full: Array<string>
  base: Array<string>
  course: Array<Array<string>>
}

export function buildServableContent ({ data, requestedPassword, classNameField }: {
  data: PlanData
  requestedPassword: string | null
  classNameField: string
}): ServableContent {
  const configs = new Map<string, object>()
  const plans = new Map<string, PlanContent>()
  const contents = new Map<string, object>()

  const parameters = buildParameterNames(data)
  const contentSets = buildContentSetNames(data)
  const conditions = buildConditionSets({ data, classNameField, parameters })
  const config = buildConfigItems({ data, classNameField, conditions, parameters })
  const contentBucketSets = buildContentSets({ data, requestedPassword, conditions, contentSets })

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
          info: item.info
        }

        itemsFull.push(preparedItem)

        if (item.course === null) {
          itemsBase.push(preparedItem)
        } else {
          itemsPerCourse.get(item.course)!.push(preparedItem)
        }
      })
    })

    plans.set(contentSets.full[classIndex], { items: itemsFull })
    plans.set(contentSets.base[classIndex], { items: itemsBase })

    classItem.courses.forEach((courseItem, courseIndex) => plans.set(
      contentSets.course[classIndex][courseIndex],
      { items: itemsPerCourse.get(courseItem.name)! }
    ))
  })

  contents.set('default', {
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
  })

  const mainConfigScreen = {
    config,
    configValidationConditionId: conditions.finalValidation,
    contentBucketSets,
    conditionSets: conditions.items
  }

  if (requestedPassword === null) {
    configs.set('default', mainConfigScreen)
  } else {
    configs.set('default', {
      config: [
        {
          param: 'password',
          type: 'password',
          visibilityConditionId: '_true',
          value: '',
          label: 'Passwort'
        },
        {
          param: 'password',
          type: 'otherConfigBucket',
          visibilityConditionId: 'has-password',
          value: 'main',
          label: ''
        }
      ],
      configValidationConditionId: 'has-password',
      contentBucketSets: [],
      conditionSets: [
        {
          id: 'has-password',
          type: 'paramNotEmpty',
          left: 'password',
          right: ''
        }
      ]
    })

    configs.set('main', mainConfigScreen)
  }

  return { configs, plans, contents }
}

function addMapItem<V> (map: Map<string, V>, wishName: string, item: V): string {
  wishName = wishName.toLowerCase()
  wishName = wishName.replace(/[^a-z0-9_-]/g, '')

  if (map.has(wishName)) {
    let i = 2

    while (map.has(wishName + '-' + i)) { i++ }

    wishName = wishName + '-' + i

    map.set(wishName, item)

    return wishName
  } else {
    map.set(wishName, item)

    return wishName
  }
}

function associateMultipleConditionSetItems (
  output: Map<string, {type: string, left: string, right: string}>,
  itemIds: Array<string>,
  operator: 'or' | 'and',
  wishName: string
): string {
  if (itemIds.length === 0) {
    if (operator === 'or') {
      return '_false'
    } else if (operator === 'and') {
      return '_true'
    } else {
      throw new Error()
    }
  } else {
    let previousName = itemIds[itemIds.length - 1]

    for (let i = itemIds.length - 2; i >= 0; i--) {
      previousName = addMapItem(output, i === 0 ? wishName : wishName + '-' + i.toString(10), {
        type: operator,
        left: itemIds[i],
        right: previousName
      })
    }

    return previousName
  }
}

function serializeConditionSets (input: Map<string, {type: string, left: string, right: string}>) {
  const result: Array<{id: string, type: string, left: string, right: string}> = []

  input.forEach((item, id) => result.push({ ...item, id }))

  return result
}

function buildParameterNames (data: PlanData): ParameterNames {
  const paramNamesTemp = new Map<string, null>()

  const enableCourseSelection = data.classes
    .map((item) => item.name)
    .map((name) => addMapItem(paramNamesTemp, 'enable-course-selection-' + name, null))

  const enableSpecificCourse = data.classes.map((classItem) => (
    classItem.courses.map((courseItem) => (
      addMapItem(paramNamesTemp, 'enable-specific-course-' + classItem.name + '-' + courseItem.name, null))
    ))
  )

  return { enableCourseSelection, enableSpecificCourse }
}

function buildContentSetNames (data: PlanData): ContentSetNames {
  const contentSetsNameTemp = new Map<string, null>()

  const full = data.classes.map((classItem) => addMapItem(
    contentSetsNameTemp, 'full-' + classItem.name, null
  ))

  const base = data.classes.map((classItem) => addMapItem(
    contentSetsNameTemp, 'base-' + classItem.name, null
  ))

  const course = data.classes.map((classItem) => (
    classItem.courses.map((courseItem) => (
      addMapItem(
        contentSetsNameTemp, 'single-course-' + classItem.name + '-' + courseItem.name, null
      ))
    ))
  )

  return { full, base, course }
}

function buildConditionSets ({ classNameField, data, parameters }: {
  classNameField: string
  data: PlanData
  parameters: ParameterNames
}): Conditions {
  const items = new Map<string, {type: string, left: string, right: string}>()

  const isSpecificClassSelected = data.classes.map((classInfo) => (
    addMapItem(items, 'is-class-selected-' + classInfo.name, {
      type: 'paramIs',
      left: classNameField,
      right: classInfo.name
    })
  ))

  const conditionAnyClassWithoutCoursesSelected = associateMultipleConditionSetItems(
    items,
    isSpecificClassSelected.filter((_, index) => data.classes[index].courses.length === 0),
    'or',
    'is-class-without-courses-selected'
  )

  const enableSpecificCourseConditionNames = data.classes.map((classItem, classIndex) => (
    classItem.courses.map((courseItem, courseIndex) => (
      addMapItem(items, 'is-course-enabled-' + classItem.name + '-' + courseItem.name, {
        type: 'paramIs',
        left: parameters.enableSpecificCourse[classIndex][courseIndex],
        right: 'show'
      }))
    ))
  )

  const disableSpecificCourseConditionNames = data.classes.map((classItem, classIndex) => (
    classItem.courses.map((courseItem, courseIndex) => (
      addMapItem(items, 'is-course-disabled-' + classItem.name + '-' + courseItem.name, {
        type: 'paramIs',
        left: parameters.enableSpecificCourse[classIndex][courseIndex],
        right: 'hide'
      }))
    ))
  )

  const hasEnabledOrDisabledSpecificCourseConditionNames = data.classes.map((classItem, classIndex) => (
    classItem.courses.map((courseItem, courseIndex) => (
      addMapItem(items, 'is-course-enabled-or-disabled-' + classItem.name + '-' + courseItem.name, {
        type: 'or',
        left: enableSpecificCourseConditionNames[classIndex][courseIndex],
        right: disableSpecificCourseConditionNames[classIndex][courseIndex]
      }))
    ))
  )

  const hasEnabledOrDisabledAllCoursesPerClassConditionNames = data.classes.map((_, classIndex) => (
    associateMultipleConditionSetItems(
      items,
      hasEnabledOrDisabledSpecificCourseConditionNames[classIndex],
      'and',
      'are-courses-enabled-or-disabled'
    )
  ))

  const classAndManualCourseSelectionEnabled = data.classes.map((classItem, index) => {
    const manualCourseSelectionChosen = addMapItem(items, 'class-manual-course-selection-enabled-' + classItem.name, {
      type: 'paramIs',
      left: parameters.enableCourseSelection[index],
      right: 'flexible'
    })

    return addMapItem(items, 'class-selected-and-manual-courses-enabled-' + classItem.name, {
      type: 'and',
      left: manualCourseSelectionChosen,
      right: isSpecificClassSelected[index]
    })
  })

  const classAndSpecificCourseEnabled = data.classes.map((classItem, classIndex) => (
    classItem.courses.map((courseItem, courseIndex) => (
      associateMultipleConditionSetItems(
        items,
        [
          classAndManualCourseSelectionEnabled[classIndex],
          enableSpecificCourseConditionNames[classIndex][courseIndex]
        ],
        'and',
        'load-specific-course-' + classItem.name + '-' + courseItem.name
      )
    ))
  ))

  const classAndAllForceAllCoursesEnabled = data.classes.map((classItem, index) => {
    const fullCourseSelectionChosen = addMapItem(items, 'class-full-course-selection-enabled-' + classItem.name, {
      type: 'paramIs',
      left: parameters.enableCourseSelection[index],
      right: 'full'
    })

    return addMapItem(items, 'class-selected-and-manual-courses-enabled-' + classItem.name, {
      type: 'and',
      left: fullCourseSelectionChosen,
      right: isSpecificClassSelected[index]
    })
  })

  const conditonAnyClassWithCoursesSelectedAndFullCoursesChosen = associateMultipleConditionSetItems(
    items,
    classAndAllForceAllCoursesEnabled,
    'or',
    'any-class-with-courses-and-full-courses-selected'
  )

  const conditonClassWithCoursesSelectedAndManualCourseSelectionChosenAndCourseSelectionComplete = data.classes.map((classItem, classIndex) => {
    if (classItem.courses.length === 0) {
      return '_false'
    }

    return addMapItem(items, 'class-selected-and-manual-courses-enabled-and-complete-' + classItem.name, {
      type: 'and',
      left: classAndManualCourseSelectionEnabled[classIndex],
      right: hasEnabledOrDisabledAllCoursesPerClassConditionNames[classIndex]
    })
  })

  const conditonAnyClassWithCoursesSelectedAndManualCourseSelectionChosenAndCourseSelectionComplete =
    associateMultipleConditionSetItems(
      items,
      conditonClassWithCoursesSelectedAndManualCourseSelectionChosenAndCourseSelectionComplete,
      'or',
      'any-class-with-courses-selected-and-manual-course-selection-chosen-and-course-selection-complete'
    )

  const finalValidation = associateMultipleConditionSetItems(
    items,
    [
      conditonAnyClassWithCoursesSelectedAndFullCoursesChosen,
      conditonAnyClassWithCoursesSelectedAndManualCourseSelectionChosenAndCourseSelectionComplete,
      conditionAnyClassWithoutCoursesSelected
    ],
    'or',
    'final-validation'
  )

  return {
    items: serializeConditionSets(items),
    finalValidation,
    isSpecificClassSelected,
    classAndManualCourseSelectionEnabled,
    classAndAllForceAllCoursesEnabled,
    classAndSpecificCourseEnabled
  }
}

function buildConfigItems ({ data, classNameField, conditions, parameters }: {
  data: PlanData
  classNameField: string
  conditions: Conditions
  parameters: ParameterNames
}) {
  const configClassListItems = flatten(data.classes.map((classItem, classIndex) => {
    const mainItem = {
      param: classNameField,
      type: 'radio',
      value: classItem.name,
      label: classItem.name,
      visibilityConditionId: '_true'
    }

    if (classItem.courses.length > 0) {
      return [
        mainItem,
        {
          param: '',
          type: 'text',
          value: '',
          label: 'Bitte die weiteren Optionen am Ende der Liste beachten',
          visibilityConditionId: conditions.isSpecificClassSelected[classIndex]
        }
      ]
    } else {
      return [mainItem]
    }
  }))

  const configEnableCourseSelectionItems = flatten(data.classes.map((item, classIndex) => {
    if (item.courses.length > 0) {
      const param = parameters.enableCourseSelection[classIndex]
      const visibilityConditionId = conditions.isSpecificClassSelected[classIndex]

      const result = [
        {
          type: 'divider',
          label: '',
          param: '',
          value: '',
          visibilityConditionId
        },
        {
          type: 'radio',
          label: 'Alle Kurse anzeigen',
          param,
          value: 'full',
          visibilityConditionId
        },
        {
          type: 'radio',
          label: 'Nur ausgewählte Kurse anzeigen',
          param,
          value: 'flexible',
          visibilityConditionId
        }
      ]

      item.courses.forEach((courseItem, courseIndex) => {
        const param = parameters.enableSpecificCourse[classIndex][courseIndex]
        const visibilityConditionId = conditions.classAndManualCourseSelectionEnabled[classIndex]

        result.push({
          type: 'divider',
          label: '',
          param: '',
          value: '',
          visibilityConditionId
        })

        result.push({
          type: 'radio',
          label: courseItem.name + ' ausblenden',
          param,
          value: 'hide',
          visibilityConditionId
        })

        result.push({
          type: 'radio',
          label: courseItem.name + ' anzeigen',
          param,
          value: 'show',
          visibilityConditionId
        })
      })

      return result
    } else {
      return []
    }
  }))

  return [
    ...configClassListItems,
    ...configEnableCourseSelectionItems
  ]
}

function buildContentSets ({ requestedPassword, conditions, data, contentSets }: {
  requestedPassword: string | null
  conditions: Conditions
  data: PlanData
  contentSets: ContentSetNames
}) {
  const passwordParamContentBucketBase = requestedPassword === null ? {} : {
    passwordParam: 'password'
  }

  const baseContentSet = {
    ...passwordParamContentBucketBase,
    id: 'default',
    usageConditionId: '_true',
    type: 'content'
  }

  const fullContentSets = data.classes.map((classItem, index) => ({
    ...passwordParamContentBucketBase,
    id: contentSets.full[index],
    type: 'plan',
    usageConditionId: classItem.courses.length === 0 ?
      conditions.isSpecificClassSelected[index] :
      conditions.classAndAllForceAllCoursesEnabled[index]
  }))

  const baseContentSets = data.classes.map((_, index) => ({
    ...passwordParamContentBucketBase,
    id: contentSets.base[index],
    type: 'plan',
    usageConditionId: conditions.classAndManualCourseSelectionEnabled[index]
  }))

  const courseContentSets = flatten(data.classes.map((classItem, classIndex) => (
    classItem.courses.map((_, courseIndex) => ({
      ...passwordParamContentBucketBase,
      id: contentSets.course[classIndex][courseIndex],
      type: 'plan',
      usageConditionId: conditions.classAndSpecificCourseEnabled[classIndex][courseIndex]
    }))
  )))

  return [
    baseContentSet,
    ...fullContentSets,
    ...baseContentSets,
    ...courseContentSets
  ]
}
