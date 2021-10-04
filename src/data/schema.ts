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

export interface PlanData {
  freeDays: Array<string> // YYYY-MM-DD
  classes: Array<{
    name: string
    courses: Array<{
      teacher: string
      name: string
    }>
  }>
  plans: Array<{
    date: string
    lastModified: number
    classes: Array<{
      title: string
      plan: Array<{
        lesson: number
        subject: string | null
        subjectChanged: boolean
        teacher: string | null
        teacherChanged: boolean
        room: string | null
        roomChanged: boolean
        info: string | null
        course: string | null
      }>
    }>
    messages: Array<string>
  }>
}
