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

import { ServableContent } from './types.js'

export function mergeContents(a: ServableContent, b: ServableContent): ServableContent {
  return {
    configs: mergeMapsThrowOnConflicts(a.configs, b.configs),
    startConfigScreenName: a.startConfigScreenName,
    plans: mergeMapsThrowOnConflicts(a.plans, b.plans),
    contents: mergeMapsThrowOnConflicts(a.contents, b.contents)
  }
}

export function renameDefaultConfigScreen(input: ServableContent): ServableContent {
  const targetName = 'default'
  const currentName = input.startConfigScreenName
  const item = input.configs.get(currentName)

  if (item === undefined) throw new Error('invalid startConfigScreenName')

  if (targetName === currentName) return input

  if (input.configs.has(targetName)) throw new Error('renameDefaultConfigScreen conflict')

  const newConfigs = new Map(input.configs)

  newConfigs.set(targetName, item)
  newConfigs.delete(currentName)

  return { ...input, configs: newConfigs }
}

function mergeMapsThrowOnConflicts<T1, T2>(a: Map<T1, T2>, b: Map<T1, T2>): Map<T1, T2> {
  const result = new Map<T1, T2>(a)

  b.forEach((value, key) => {
    if (result.has(key)) {
      throw new Error('duplicate key')
    }

    result.set(key, value)
  })

  return result
}
