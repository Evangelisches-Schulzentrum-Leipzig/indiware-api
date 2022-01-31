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

import Ajv from 'ajv'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { XmlFileSchema } from './xmlschema'

const ajv = new Ajv()

const schema = JSON.parse(readFileSync(resolve(fileURLToPath(import.meta.url), '../xmljsonschema.json')).toString('utf8'))

// eslint-disable-next-line @typescript-eslint/no-var-requires
export const matchesXmlFileSchema = ajv.compile(schema) as ((input: unknown) => input is XmlFileSchema) & {
  errors: unknown
}
