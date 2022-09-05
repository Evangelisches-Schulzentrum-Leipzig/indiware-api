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

export interface PlanItem {
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

export interface PlanContent {
  items: Array<PlanItem>
}

export interface ServableContent {
  configs: Map<string, { content: ConfigResponse, password: string | null }>
  startConfigScreenName: string
  plans: Map<string, { content: PlanContent, password: string | null }>
  contents: Map<string, { content: ContentResponse, password: string | null }>
}

export interface ConfigResponse {
  config: Array<ConfigScreenItem>
  contentBucketSets: Array<ContentBucketSetItem>
  conditionSets: Array<ConditionSetItem>
  configValidationConditionId: string
}

export interface ConfigScreenItem {
  type: 'radio' | 'password' | 'otherConfigBucket' | 'text' | 'divider'
  param: string
  label: string
  value: string
  visibilityConditionId: string
}

export interface ContentBucketSetItem {
  id: string
  passwordField?: string
  usageConditionId: string
  type: 'content' | 'plan'
}

export interface ConditionSetItem {
  id: string
  type: ConditionSetItemType
  left: string
  right: string
}

export type ConditionSetItemType = 'and' | 'or' | 'paramIs' | 'paramNotEmpty' | 'not'

export interface ContentResponse {
  file: Array<ContentResponseFile>
  message: Array<ContentResponseMessage>
}

export interface ContentResponseFile {
  type: 'download' | 'plan'
  mimeType: string
  title: string
  id: string
  notify: boolean
  file: Array<{
    url: string
    sha512: string
    size: number
  }>
}

export interface ContentResponseMessage {
  id: string
  title: string
  content: string
  notify: boolean
}
