/*
 * vertretungsplan.io indiware crawler
 * Copyright (C) 2019 Jonas Lochmann
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

import { uniq, uniqBy } from 'lodash'
import * as moment from 'moment-timezone'
import { ParsedPlanFile } from './parsed-plan-file'
import {
  hasAttributes, parseNumberField,
  readOptionalTextElement, sanitizeEmptyValues
} from './postprocess-utils'
import { XmlFileSchema } from './xmlschema'

const classNameRegex = /^[0-9/]*$/

export function postprocessPlanFile ({ input, locale, timezone }: {
  input: XmlFileSchema
  locale: string
  timezone: string
}): ParsedPlanFile {
  const dateString = input.VpMobil[0].Kopf[0].DatumPlan[0]._text[0]
  const dateMoment = moment.tz(dateString, 'dddd, DD. MMMM YYYY', locale, true, timezone)

  if (!dateMoment.isValid()) {
    throw new Error('invalid date: ' + dateString)
  }

  const lastModifiedString = input.VpMobil[0].Kopf[0].zeitstempel[0]._text[0]
  const lastModifiedMoment = moment.tz(lastModifiedString, 'DD.MM.YYYY, HH:mm', locale, true, timezone)

  if (!lastModifiedMoment.isValid()) {
    throw new Error('invalid last modified time: ' + lastModifiedString)
  }

  const freeDays = input.VpMobil[0].FreieTage[0].ft
    .map((item) => item._text[0])
    .map((item) => {
      const itemMoment = moment(item, 'YYMMDD', 'de', true)

      if (!itemMoment.isValid()) {
        throw new Error('invalid free day: ' + item)
      }

      return itemMoment.format('YYYY-MM-DD')
    })

  if (freeDays.length !== uniq(freeDays).length) {
    throw new Error('duplicate free days')
  }

  const classes = input.VpMobil[0].Klassen[0].Kl.map((classInput) => {
    const title = classInput.Kurz[0]._text[0]

    if (!classNameRegex.test(title)) {
      throw new Error('unexpected class name: ' + title)
    }

    const subjects = (classInput.Unterricht[0].Ue || []).map((subjectInput) => {
      const id = parseNumberField(subjectInput.UeNr[0]._text[0], 'subject id')
      const subject = subjectInput.UeNr[0]._attributes.UeFa
      const teacher = subjectInput.UeNr[0]._attributes.UeLe

      return {
        id,
        subject,
        teacher
      }
    })

    if (subjects.length !== uniqBy(subjects, (item) => item.id).length) {
      throw new Error('duplicate subject ids')
    }

    const subjectIds = subjects.map((item) => item.id)

    const plan = (classInput.Pl[0].Std || []).map((lessonInput) => {
      const lesson = parseNumberField(lessonInput.St[0]._text[0], 'lesson')
      const subject = sanitizeEmptyValues(lessonInput.Fa[0]._text[0])
      const subjectChanged = hasAttributes(lessonInput.Fa[0])
      const teacher = sanitizeEmptyValues(lessonInput.Le[0]._text[0])
      const teacherChanged = hasAttributes(lessonInput.Le[0])
      const room = sanitizeEmptyValues(readOptionalTextElement(lessonInput.Ra[0]))
      const roomChanged = hasAttributes(lessonInput.Ra[0])
      const subjectId = lessonInput.Nr ? parseNumberField(lessonInput.Nr[0]._text[0], 'subject id') : null
      const info = readOptionalTextElement(lessonInput.If[0])

      if (subjectId !== null && subjectIds.indexOf(subjectId) === -1) {
        throw new Error('invalid subject id: ' + subjectId)
      }

      return {
        lesson,
        subject,
        subjectChanged,
        teacher,
        teacherChanged,
        room,
        roomChanged,
        subjectId,
        info
      }
    })

    return {
      title,
      subjects,
      plan
    }
  })

  if (classes.length !== uniqBy(classes, (item) => item.title).length) {
    throw new Error('duplicate classes')
  }

  return {
    date: dateMoment.format('YYYY-MM-DD'),
    lastModified: lastModifiedMoment.valueOf(),
    freeDays,
    classes
  }
}
