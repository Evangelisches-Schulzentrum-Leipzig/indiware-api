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

import * as Ajv from 'ajv'
const ajv = new Ajv()

export interface XmlTextElement {
  _text: [string]
}

export interface XmlFileSchema {
  _declaration: {
    _attributes: {
      version: string
      encoding: 'utf-8' | 'UTF-8'
    }
  }
  VpMobil: [{
    Kopf: [{
      planart: [XmlTextElement]
      zeitstempel: [XmlTextElement] // 04.09.2019, 09:40
      DatumPlan: [XmlTextElement]   // Donnerstag, 05. September 2019
      datei: [XmlTextElement]
      nativ: [XmlTextElement]
      woche?: [XmlTextElement]
      tageprowoche?: [XmlTextElement]
      schulnummer?: [{}]
    }]
    FreieTage: [{
      ft: Array<XmlTextElement>     // 190801 - YYMMDD
    }]
    Klassen: [{
      Kl: Array<{
        Kurz: [XmlTextElement]        // class name
        Kurse: [{/* note: there was no case yet where this was set */}]
        Hash?: [{/* note: there was no case yet where this was set */}]
        Unterricht: [{
          Ue?: Array<{
            UeNr: [{
              _attributes: {
                UeLe: string
                UeFa: string
                UeGr?: string         // related to the course
              }
              _text: [string]         // unknown what this is for
            }]
          }>                          // looks like this shows the teachers for the subjects
        }]
        Pl: [{
          Std?: Array<{
            St: [XmlTextElement]  // lesson number
            Fa: [XmlTextElement | {
              // the '---' says that something was removed
              _text?: [string | '---']
              _attributes: {
                FaAe: 'FaGeaendert'
              }
            } | {}]  // subject
            Le: [XmlTextElement | {
              // the '&nbsp;' says that something was removed
              _text?: ['&nbsp;' | string]
              _attributes: {
                LeAe: 'LeGeaendert'
              }
            } | {}]  // teacher
            Ra: [XmlTextElement | {
              // the '&nbsp;' says that something was removed
              _text?: ['&nbsp;' | string]
              _attributes: {
                RaAe: 'RaGeaendert'
              }
            } | {}]  // room
            Nr?: [XmlTextElement]  // refers to the UE items
            If: [{} | XmlTextElement] // if it is a text, then the text describes a change
            // unused, refers to the time of day as string
            Beginn?: [XmlTextElement]
            Ende?: [XmlTextElement]
            // course, seems to be equal to Fa, unused
            Ku2?: [XmlTextElement]
          }>
        }]
        Klausuren?: [{
          Klausur: Array<{
            KlJahrgang: [XmlTextElement]
            KlKurs: [XmlTextElement]
            KlKursleiter: [XmlTextElement]
            KlStunde: [XmlTextElement]
            KlBeginn: [XmlTextElement]
            KlDauer: [XmlTextElement]
            KlKinfo: [{} | XmlTextElement]
          }>
        }]
        // this is unused
        KlStunden?: [{
          KlSt: Array<{
            _attributes: {
              ZeitVon: string
              ZeitBis: string
            },
            _text: [string]
          }>
        }]
      }>
    }]
    ZusatzInfo?: [{
      ZiZeile: Array<[XmlTextElement] | {}>
    }]
  }]
}

export const matchesXmlFileSchema = ajv.compile(require('./xmljsonschema.json')) as any
