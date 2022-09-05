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
import { addMapItem, hex } from './util.js'
import { ContentBucketSetItem } from './types.js'
import { ContentSetNames, Conditions } from './inttypes.js'

const { flatten } = lodash

export function buildContentSetNames ({ data, prefix }: {
  data: PlanData
  prefix: string
}): ContentSetNames {
  const defaultName = prefix + 'default'

  const contentSetsNameTemp = new Map<string, null>()

  const content = data.classes.map((classItem) => addMapItem(
    contentSetsNameTemp, prefix + 'content-' + hex(classItem.name), null
  ))

  const full = data.classes.map((classItem) => addMapItem(
    contentSetsNameTemp, prefix + 'full-' + hex(classItem.name), null
  ))

  const base = data.classes.map((classItem) => addMapItem(
    contentSetsNameTemp, prefix + 'base-' + hex(classItem.name), null
  ))

  const course = data.classes.map((classItem) => (
    classItem.courses.map((courseItem) => (
      addMapItem(
        contentSetsNameTemp, prefix + 'single-course-' + hex(classItem.name) + '-' + hex(courseItem.name), null
      ))
    ))
  )

  return { default: defaultName, content, full, base, course }
}

export function buildContentSetConfigSection ({ passwordField, conditions, data, contentSets }: {
  passwordField: string | null
  conditions: Conditions
  data: PlanData
  contentSets: ContentSetNames
}): Array<ContentBucketSetItem> {
  const passwordParamContentBucketBase = passwordField === null ? {} : {
    passwordParam: passwordField
  }

  const baseContentSet: ContentBucketSetItem = {
    ...passwordParamContentBucketBase,
    id: contentSets.default,
    usageConditionId: '_true',
    type: 'content'
  }

  const contentContentSets: Array<ContentBucketSetItem> = data.classes.map((_, index) => ({
    ...passwordParamContentBucketBase,
    id: contentSets.content[index],
    type: 'content',
    usageConditionId: conditions.isSpecificClassSelected[index]
  }))

  const fullContentSets: Array<ContentBucketSetItem> = data.classes.map((classItem, index) => ({
    ...passwordParamContentBucketBase,
    id: contentSets.full[index],
    type: 'plan',
    usageConditionId: classItem.courses.length === 0 ?
      conditions.isSpecificClassSelected[index] :
      conditions.classAndAllForceAllCoursesEnabled[index]
  }))

  const baseContentSets: Array<ContentBucketSetItem> = data.classes.map((_, index) => ({
    ...passwordParamContentBucketBase,
    id: contentSets.base[index],
    type: 'plan',
    usageConditionId: conditions.classAndManualCourseSelectionEnabled[index]
  }))

  const courseContentSets: Array<ContentBucketSetItem> = flatten(data.classes.map((classItem, classIndex) => (
    classItem.courses.map((_, courseIndex) => ({
      ...passwordParamContentBucketBase,
      id: contentSets.course[classIndex][courseIndex],
      type: 'plan',
      usageConditionId: conditions.classAndSpecificCourseEnabled[classIndex][courseIndex]
    }))
  )))

  return [
    baseContentSet,
    ...contentContentSets,
    ...fullContentSets,
    ...baseContentSets,
    ...courseContentSets
  ]
}
