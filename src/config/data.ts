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

import { SchoolConfiguration } from './item.js'

export const schools: Array<SchoolConfiguration> = []

if (process.env.CANTOR_PASSWORD) {
  schools.push({
    id: 'cantor',
    classNameField: 'class',
    title: 'Cantor-Gymnasium',
    url: 'https://stundenplan24.de/20072021/mobil/mobdaten/',
    username: 'schueler',
    password: process.env.CANTOR_PASSWORD,
    timezone: 'Europe/Berlin',
    locale: 'de',
    requestedPassword: null
  })
}

if (process.env.WGG_DESSAU_PASSWORD) {
  schools.push({
    id: 'wgg-dessau',
    classNameField: 'class',
    title: 'Walter Gropius-Gymnasium Dessau',
    url: 'https://stundenplan24.de/20053081/mobil/mobdaten/',
    username: 'schueler',
    password: process.env.WGG_DESSAU_PASSWORD,
    timezone: 'Europe/Berlin',
    locale: 'de',
    requestedPassword: process.env.WGG_DESSAU_PASSWORD
  })
}
