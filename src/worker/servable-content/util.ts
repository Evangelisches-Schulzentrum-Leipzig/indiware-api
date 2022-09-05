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

export function addMapItem<V> (map: Map<string, V>, wishName: string, item: V): string {
  wishName = wishName.toLowerCase()
  wishName = wishName.replace(/[^a-z0-9_-]/g, '')

  if (map.has(wishName)) {
    let i = 2

    while (map.has(wishName + '-' + i)) { i++ }

    wishName = wishName + '-' + i

    map.set(wishName, item)

    return wishName
  } else {
    map.set(wishName, item)

    return wishName
  }
}

export function hex(input: string): string {
  return Buffer.from(input, 'utf8').toString('hex')
}
