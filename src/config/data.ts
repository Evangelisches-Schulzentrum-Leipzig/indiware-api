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
    title: 'Cantor-Gymnasium',
    student: {
      url: 'https://stundenplan24.de/20072021/mobil/mobdaten/',
      password: process.env.CANTOR_PASSWORD
    },
    legacy: true,
    teacher: null,
    timezone: 'Europe/Berlin',
    locale: 'de',
    skipPasswordCheck: true
  })
}

if (process.env.WGG_DESSAU_PASSWORD) {
  schools.push({
    id: 'wgg-dessau',
    title: 'Walter Gropius-Gymnasium Dessau',
    student: {
      url: 'https://stundenplan24.de/20053081/mobil/mobdaten/',
      password: process.env.WGG_DESSAU_PASSWORD
    },
    legacy: true,
    teacher: null,
    timezone: 'Europe/Berlin',
    locale: 'de',
    skipPasswordCheck: false
  })
}

if (process.env.TVDS_STUD_PASSWORD) {
  schools.push({
    id: 'm-tvds',
    title: 'Verbundene Regionale Schule und Gymnasium "Tisa von der Schulenburg" Dorf Mecklenburg',
    student: {
      url: 'https://stundenplan24.de/40092657/mobil/mobdaten/',
      password: process.env.TVDS_STUD_PASSWORD
    },
    teacher: process.env.TVDS_TEACH_PASSWORD ? {
      url: 'https://www.stundenplan24.de/40092657/moble/mobdaten/',
      password: process.env.TVDS_TEACH_PASSWORD
    } : null,
    legacy: false,
    timezone: 'Europe/Berlin',
    locale: 'de',
    skipPasswordCheck: false
  })
}

const EVS_STUD_PASSWORD = ""
const EVS_TEACH_PASSWORD = ""

if (EVS_STUD_PASSWORD) {
  schools.push({
    id: 'evaschulze',
    title: 'Evangelisches Schulzentrum Leipzig',
    student: {
      url: 'https://stundenplan24.de/10040832/mobil/mobdaten/',
      password: EVS_STUD_PASSWORD
    },
    teacher: EVS_TEACH_PASSWORD ? {
      url: 'https://www.stundenplan24.de/10040832/moble/mobdaten/',
      password: EVS_TEACH_PASSWORD
    } : null,
    legacy: false,
    timezone: 'Europe/Berlin',
    locale: 'de',
    skipPasswordCheck: true
  })
}
