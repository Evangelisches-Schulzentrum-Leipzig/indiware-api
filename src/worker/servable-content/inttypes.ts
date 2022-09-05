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

import { ConditionSetItem } from './types.js'

export interface ParameterNames {
  enableCourseSelection: Array<string>
  enableSpecificCourse: Array<Array<string>>
}

export interface ContentSetNames {
  default: string
  content: Array<string>
  full: Array<string>
  base: Array<string>
  course: Array<Array<string>>
}

export interface Conditions {
  items: Array<ConditionSetItem>
  finalValidation: string
  isSpecificClassSelected: Array<string>
  classAndManualCourseSelectionEnabled: Array<string>
  classAndAllForceAllCoursesEnabled: Array<string>
  classAndSpecificCourseEnabled: Array<Array<string>>
}
