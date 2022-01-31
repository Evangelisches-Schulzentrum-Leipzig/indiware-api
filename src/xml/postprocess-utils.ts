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

export function parseNumberField (input: string, type: string) {
  const result = parseInt(input, 10)

  if ((!Number.isSafeInteger(result)) || (result.toString(10) !== input)) {
    throw new Error('unexpected ' + type + ': ' + input)
  }

  return result
}

const emptyValues = ['---', '&nbsp;']

export function sanitizeEmptyValues (input: string | null | undefined): string | null {
  if (typeof input !== 'string' || emptyValues.indexOf(input) !== -1) {
    return null
  } else {
    return input
  }
}

export function hasAttributes (input: {
  _text: [string]
} | {
  _text: [string]
  _attributes: object
} | {
  _attributes: object
} | {
  // empty object
}) {
  return '_attributes' in input && typeof input._attributes !== 'undefined'
}

export function readOptionalTextElement (input: {_text?: [string]}): string | null {
  if (typeof input._text === 'object' && typeof input._text[0] === 'string') {
    return input._text[0]
  } else {
    return null
  }
}
