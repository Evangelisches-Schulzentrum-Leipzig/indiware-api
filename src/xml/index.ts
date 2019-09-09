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

export { ParsedPlanFile } from './parsed-plan-file'
import { ParsedPlanFile } from './parsed-plan-file'
import { postprocessPlanFile } from './postprocess-plan-file'
import { readAndPrevalidateXml } from './read-plan-file'

export function parsePlanFile ({ input, locale, timezone }: {
  input: string
  locale: string
  timezone: string
}): ParsedPlanFile {
  return postprocessPlanFile({
    input: readAndPrevalidateXml(input),
    locale,
    timezone
  })
}
