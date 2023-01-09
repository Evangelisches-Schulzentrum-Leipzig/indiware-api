/*
 * vertretungsplan.io indiware crawler
 * Copyright (C) 2019 - 2023 Jonas Lochmann
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
import moment from 'moment-timezone'
import {
  ParsedPlanFile, ParsedPlanFileClass, ParsedPlanFileSupervision,
  ParsedPlanFileSupervisionType
} from './parsed-plan-file.js'
import {
  hasAttributes, parseNumberField,
  readOptionalTextElement, sanitizeEmptyValues
} from './postprocess-utils.js'
import { XmlFileSchema } from './xmlschema.js'

const { max, uniq, uniqBy } = lodash

const classNameRegex = /^[0-9/ a-zA-Z]*$/
const classicClassNameRegex = /^[0-9]* [a-z]*$/

export function postprocessPlanFile ({ input, locale, timezone, skipClassNameValidation }: {
  input: XmlFileSchema
  locale: string
  timezone: string
  skipClassNameValidation: boolean
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

  const messages = input.VpMobil[0].ZusatzInfo ?
    input.VpMobil[0].ZusatzInfo[0].ZiZeile.map((message) => readOptionalTextElement(message)).filter((item) => !!item) as Array<string> : []

  const classes: Array<ParsedPlanFileClass> = input.VpMobil[0].Klassen[0].Kl.map((classInput) => {
    const title = classInput.Kurz[0]._text[0]

    if (!skipClassNameValidation && !classNameRegex.test(title)) {
      throw new Error('unexpected class name: ' + title)
    }

    const subjects = (classInput?.Unterricht?.[0].Ue || []).map((subjectInput) => {
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

    const courses = uniqBy((classInput.Kurse?.[0]?.Ku || []).map((courseInput) => {
      const name = courseInput.KKz[0]._text[0]
      const teacher = courseInput.KKz[0]._attributes.KLe

      return { name, teacher }
    }), (item) => item.name)

    const plan = (classInput.Pl[0].Std || []).map((lessonInput) => {
      const lesson = parseNumberField(lessonInput.St[0]._text[0], 'lesson')
      const subject = sanitizeEmptyValues(readOptionalTextElement(lessonInput.Fa[0]))
      const subjectChanged = hasAttributes(lessonInput.Fa[0])
      const teacher = sanitizeEmptyValues(readOptionalTextElement(lessonInput.Le[0]))
      const teacherChanged = hasAttributes(lessonInput.Le[0])
      const room = sanitizeEmptyValues(readOptionalTextElement(lessonInput.Ra[0]))
      const roomChanged = hasAttributes(lessonInput.Ra[0])
      const info = readOptionalTextElement(lessonInput.If[0])
      const course = lessonInput.Ku2 ? readOptionalTextElement(lessonInput.Ku2[0]) : null

      if (courses.length > 0) {
        if (course !== null && !courses.some((item) => item.name === course)) {
          throw new Error('invalid course: ' + course)
        }
      }

      return {
        lesson,
        subject,
        subjectChanged,
        teacher,
        teacherChanged,
        room,
        roomChanged,
        info,
        course
      }
    })

    const supervisions: Array<ParsedPlanFileSupervision> = (classInput?.Aufsichten?.[0]?.Aufsicht || []).map((supervisionItem) => {
      let type: ParsedPlanFileSupervisionType

      if (supervisionItem._attributes === undefined) {
        type = 'regular'
      } else if (supervisionItem._attributes.AuAe === 'AuVertretung') {
        type = 'substitute'
      } else if (supervisionItem._attributes.AuAe === 'AuAusfall') {
        type = 'cancel'
      } else {
        throw new Error('invalid supervision AuAe value')
      }

      const prevLessonIndex = parseInt(supervisionItem.AuVorStunde[0]._text[0])
      const time1 = supervisionItem.AuUhrzeit[0]._text[0]
      const time2 = supervisionItem.AuZeit[0]._text[0]
      const location = supervisionItem.AuOrt[0]._text[0]
      const replacementFor = supervisionItem.AuFuer?.[0]?._text[0] || null
      const info = supervisionItem.AuInfo?.[0]._text[0] || null

      if (!Number.isSafeInteger(prevLessonIndex)) {
        throw new Error('invalid prevLessonIndex')
      }

      const result: ParsedPlanFileSupervision = {
        type,
        prevLessonIndex,
        time1,
        time2,
        location,
        replacementFor,
        info
      }

      return result
    })

    const result: ParsedPlanFileClass = {
      title,
      sortTitle: title,
      subjects,
      courses,
      plan,
      supervisions
    }

    return result
  })

  if (classes.length !== uniqBy(classes, (item) => item.title).length) {
    throw new Error('duplicate classes')
  }

  let classesWithSortTitle

  if (!classes.some((item) => !classicClassNameRegex.test(item.title))) {
    const longestClassNamePrefix = max(classes.map((item) => item.title.split(' ')[0].length)) || 0

    classesWithSortTitle = classes.map((item) => {
      const parts = item.title.split(' ')

      parts[0] = parts[0].padStart(longestClassNamePrefix, '0')

      return { ...item, sortTitle: parts.join(' ') }
    })
  } else {
    classesWithSortTitle = classes
  }

  const result: ParsedPlanFile = {
    date: dateMoment.format('YYYY-MM-DD'),
    lastModified: lastModifiedMoment.valueOf(),
    freeDays,
    classes: classesWithSortTitle,
    messages
  }

  return result
}
