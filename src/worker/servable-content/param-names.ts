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
import { ParameterNames } from './inttypes.js'
import { addMapItem } from './util.js'

export function buildParameterNames ({ data, prefix }: {
  data: PlanData
  prefix: string
}): ParameterNames {
  const paramNamesTemp = new Map<string, null>()

  const enableCourseSelection = data.classes
    .map((item) => item.name)
    .map((name) => addMapItem(paramNamesTemp, prefix + 'enable-course-selection-' + name, null))

  const enableSpecificCourse = data.classes.map((classItem) => (
    classItem.courses.map((courseItem) => (
      addMapItem(paramNamesTemp, prefix + 'enable-specific-course-' + classItem.name + '-' + courseItem.name, null))
    ))
  )

  return { enableCourseSelection, enableSpecificCourse }
}
