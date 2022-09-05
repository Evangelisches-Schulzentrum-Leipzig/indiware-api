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
import { ConfigScreenItem } from './types.js'
import { ParameterNames, Conditions } from './inttypes.js'

const { flatten } = lodash

export function buildConfigItems ({ data, classNameField, conditions, parameters }: {
  data: PlanData
  classNameField: string
  conditions: Conditions
  parameters: ParameterNames
}): Array<ConfigScreenItem> {
  const configClassListItems = flatten(data.classes.map((classItem, classIndex) => {
    const mainItem: ConfigScreenItem = {
      param: classNameField,
      type: 'radio',
      value: classItem.name,
      label: classItem.name,
      visibilityConditionId: '_true'
    }

    if (classItem.courses.length > 0) {
      const hintLabel: ConfigScreenItem = {
        param: '',
        type: 'text',
        value: '',
        label: 'Bitte die weiteren Optionen am Ende der Liste beachten',
        visibilityConditionId: conditions.isSpecificClassSelected[classIndex]
      }

      return [
        mainItem,
        hintLabel
      ]
    } else {
      return [mainItem]
    }
  }))

  const configEnableCourseSelectionItems = flatten(data.classes.map((item, classIndex) => {
    if (item.courses.length > 0) {
      const param = parameters.enableCourseSelection[classIndex]
      const visibilityConditionId = conditions.isSpecificClassSelected[classIndex]

      const result: Array<ConfigScreenItem> = [
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
