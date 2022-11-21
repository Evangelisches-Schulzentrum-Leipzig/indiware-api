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

export interface ParsedPlanFile {
  date: string  // YYYY-MM-DD
  lastModified: number  // unix timestamp in milliseconds
  freeDays: Array<string> // YYYY-MM-DD
  classes: Array<ParsedPlanFileClass>
  messages: Array<string>
}

export interface ParsedPlanFileClass {
  title: string
  sortTitle: string
  subjects: Array<ParsedPlanFileSubject>
  courses: Array<ParsedPlanFileCourse>
  plan: Array<ParsedPlanFilePlan>
  supervisions: Array<ParsedPlanFileSupervision>
}

export interface ParsedPlanFileSubject {
  id: number
  subject: string
  teacher: string
}

export interface ParsedPlanFileCourse {
  name: string
  teacher: string
}

export interface ParsedPlanFilePlan {
  lesson: number
  subject: string | null
  subjectChanged: boolean
  teacher: string | null
  teacherChanged: boolean
  room: string | null
  roomChanged: boolean
  info: string | null
  course: string | null
}

export interface ParsedPlanFileSupervision {
  type: ParsedPlanFileSupervisionType
  prevLessonIndex: number
  time1: string
  time2: string
  location: string
  replacementFor: string | null
  info: string | null
}

export type ParsedPlanFileSupervisionType = 'regular' | 'cancel' | 'substitute'
