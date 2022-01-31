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

import { xml2js } from 'xml-js'
import { matchesXmlFileSchema, XmlFileSchema } from './xmlschema.js'

export const readAndPrevalidateXml = (sourceData: string): XmlFileSchema => {
  const parsed: unknown = xml2js(sourceData, {
    compact: true,
    alwaysArray: true
  })

  if (!matchesXmlFileSchema(parsed)) {
    throw new Error('source data does not match to the expected schema: ' + JSON.stringify(matchesXmlFileSchema.errors))
  }

  return parsed
}
