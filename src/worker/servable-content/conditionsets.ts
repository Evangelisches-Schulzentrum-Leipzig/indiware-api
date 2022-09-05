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

import { PlanData } from '../../data/index.js'
import { ParameterNames, Conditions } from './inttypes.js'
import { addMapItem } from './util.js'
import { ConditionSetItemType } from './types.js'

export function buildConditionSets ({ classNameField, data, parameters, prefix }: {
  classNameField: string
  data: PlanData
  parameters: ParameterNames
  prefix: string
}): Conditions {
  const items = new Map<string, {type: ConditionSetItemType, left: string, right: string}>()

  const isSpecificClassSelected = data.classes.map((classInfo) => (
    addMapItem(items, prefix + 'is-class-selected-' + classInfo.name, {
      type: 'paramIs',
      left: classNameField,
      right: classInfo.name
    })
  ))

  const conditionAnyClassWithoutCoursesSelected = associateMultipleConditionSetItems(
    items,
    isSpecificClassSelected.filter((_, index) => data.classes[index].courses.length === 0),
    'or',
    prefix + 'is-class-without-courses-selected'
  )

  const enableSpecificCourseConditionNames = data.classes.map((classItem, classIndex) => (
    classItem.courses.map((courseItem, courseIndex) => (
      addMapItem(items, prefix + 'is-course-enabled-' + classItem.name + '-' + courseItem.name, {
        type: 'paramIs',
        left: parameters.enableSpecificCourse[classIndex][courseIndex],
        right: 'show'
      }))
    ))
  )

  const disableSpecificCourseConditionNames = data.classes.map((classItem, classIndex) => (
    classItem.courses.map((courseItem, courseIndex) => (
      addMapItem(items, prefix + 'is-course-disabled-' + classItem.name + '-' + courseItem.name, {
        type: 'paramIs',
        left: parameters.enableSpecificCourse[classIndex][courseIndex],
        right: 'hide'
      }))
    ))
  )

  const hasEnabledOrDisabledSpecificCourseConditionNames = data.classes.map((classItem, classIndex) => (
    classItem.courses.map((courseItem, courseIndex) => (
      addMapItem(items, prefix + 'is-course-enabled-or-disabled-' + classItem.name + '-' + courseItem.name, {
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
      prefix + 'are-courses-enabled-or-disabled'
    )
  ))

  const classAndManualCourseSelectionEnabled = data.classes.map((classItem, index) => {
    const manualCourseSelectionChosen = addMapItem(items, prefix + 'class-manual-course-selection-enabled-' + classItem.name, {
      type: 'paramIs',
      left: parameters.enableCourseSelection[index],
      right: 'flexible'
    })

    return addMapItem(items, prefix + 'class-selected-and-manual-courses-enabled-' + classItem.name, {
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
        prefix + 'load-specific-course-' + classItem.name + '-' + courseItem.name
      )
    ))
  ))

  const classAndAllForceAllCoursesEnabled = data.classes.map((classItem, index) => {
    const fullCourseSelectionChosen = addMapItem(items, prefix + 'class-full-course-selection-enabled-' + classItem.name, {
      type: 'paramIs',
      left: parameters.enableCourseSelection[index],
      right: 'full'
    })

    return addMapItem(items, prefix + 'class-selected-and-manual-courses-enabled-' + classItem.name, {
      type: 'and',
      left: fullCourseSelectionChosen,
      right: isSpecificClassSelected[index]
    })
  })

  const conditonAnyClassWithCoursesSelectedAndFullCoursesChosen = associateMultipleConditionSetItems(
    items,
    classAndAllForceAllCoursesEnabled,
    'or',
    prefix + 'any-class-with-courses-and-full-courses-selected'
  )

  const conditonClassWithCoursesSelectedAndManualCourseSelectionChosenAndCourseSelectionComplete = data.classes.map((classItem, classIndex) => {
    if (classItem.courses.length === 0) {
      return '_false'
    }

    return addMapItem(items, prefix + 'class-selected-and-manual-courses-enabled-and-complete-' + classItem.name, {
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
      prefix + 'any-class-with-courses-selected-and-manual-course-selection-chosen-and-course-selection-complete'
    )

  const finalValidation = associateMultipleConditionSetItems(
    items,
    [
      conditonAnyClassWithCoursesSelectedAndFullCoursesChosen,
      conditonAnyClassWithCoursesSelectedAndManualCourseSelectionChosenAndCourseSelectionComplete,
      conditionAnyClassWithoutCoursesSelected
    ],
    'or',
    prefix + 'final-validation'
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

function serializeConditionSets (input: Map<string, {type: ConditionSetItemType, left: string, right: string}>) {
  const result: Array<{id: string, type: ConditionSetItemType, left: string, right: string}> = []

  input.forEach((item, id) => result.push({ ...item, id }))

  return result
}

function associateMultipleConditionSetItems (
  output: Map<string, {type: ConditionSetItemType, left: string, right: string}>,
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
