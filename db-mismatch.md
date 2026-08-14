# Database mismatch

This document compares the combined output in `output.json` with the schema in
`database/schema.sql`. It describes what can be persisted after normalization
and what would be lost or rejected by the current database.

The counts below describe the current generated file and will change when the
source plans are regenerated.

## Result

`output.json` cannot be saved losslessly in the current database. The main
problems are:

- Several populated output sections have no corresponding table.
- Timetable and change rows do not contain all required foreign-key identity.
- `combineData()` removes source type and source-file provenance.
- Some raw identifiers exceed the target column sizes because the XML contains
  comma-separated groups.

## Current output inventory

| Output section | Current count | Database status |
| --- | ---: | --- |
| `sourcesMetadata` | 13 | Partial: `query_metadata` stores only a small subset and requires fields not present in the combined records |
| `changes` | 97 | Partial: no source date, action/state, or stable lesson reference |
| `klausuren` | 0 | No table; currently empty |
| `dayData` entities | 150 | Partial: entity type is not retained |
| `weeklyData` entities | 242 | Partial: weekly source type is not retained |
| nested `plan` rows | 8,104 | Partial: some required lesson keys are missing and several fields have no destination |
| nested `stunden` rows | 6,651 | Mappable to `periods` after converting strings to numbers/times |
| nested `kurse` rows | 810 | No course table or course relation |
| nested `unterricht` rows | 1,828 | No table for source lesson number/group metadata |
| nested `aufsichten` rows | 231 | No supervision table |
| nested `sperrungen` rows | 0 | No table; currently empty |
| nested `planinfo` rows | 30 | No plan-note table |
| `freietage` | 142 | Mappable to `holidays` after parsing the date |
| `schulwochen` | 81 | Partial: `weeks` lacks the source school-week number |
| `kalenderwochen` | 0 | Currently empty |
| `basisdaten` | 1 object | No table for the complete range/configuration object |

## Detailed mismatches

### 1. Source metadata and provenance

The combined `sourcesMetadata` records contain these header fields:

`abwesendlehrer`, `aenderungklassen`, `aenderunglehrer`, `datei`, `datum`,
`gueltigab`, `nativ`, `planart`, `schulname`, `schulnummer`, `schulort`,
`tageprowoche`, `titel`, `upname`, `upmodul`, `upversion`, `woche`, and
`zeitstempel`.

`query_metadata` has only `file_name`, `plan_type`,
`generation_timestamp`, `last_query_timestamp`, and `file_hash`.

The following information therefore has no destination column:

- school and publisher metadata (`schulname`, `schulort`, `schulnummer`,
  `upname`, `upmodul`, `upversion`);
- plan header values (`datum`, `gueltigab`, `nativ`, `titel`, `woche`,
  `tageprowoche`); and
- the absent-teacher/class lists (`abwesendlehrer`, `aenderungklassen`,
  `aenderunglehrer`).

There is also no source key in each combined record. The original `planType`
(`VpMobil_Class`, `WeeklyBase_Teacher`, and so on) is discarded before the
metadata is emitted. The `changes`, `dayData`, and `weeklyData` arrays are not
linked back to their source metadata either.

`query_metadata.file_hash` is `NOT NULL`, but the combined output contains no
source-file hash. Some source headers also have no timestamp suitable for
`generation_timestamp`.

### 2. Timetable rows

The schema can model the core relationship through `lessons` and
`lesson_class_period`, but a combined `plan` row cannot always be inserted:

- `lessons.day_of_week` is required, but 2,368 plan rows have no `tag`.
- `lesson_class_period.class_id` is required, but 2,368 plan rows have no
  `klasse`. These are teacher/room views whose class context was not retained
  in the same row.
- `lessons.teacher_subject_room_id` is required, but 482 rows have no teacher
  and no room.
- 6,814 rows have no `nummer`; the source lesson number has no column when it
  is present.
- 2,330 rows have a `kurs`, but there is no course table or course column.
- 1,868 rows have `info`, but there is no timetable-info column.
- The current output has no populated `woche` values. `wochentyp` contains
  `A`/`B`, which can map to `week_types`, but the actual source/plan context is
  not retained.

The entity `name` is also insufficient on its own. `dayData` and `weeklyData`
contain classes, teachers, and rooms, but do not retain whether a name came
from `Klassen`, `Lehrer`, or `Raeume`. A database insert cannot safely decide
whether the value belongs in `classes`, `teachers`, or `rooms`.

Room records are especially incomplete: `rooms` requires a building level,
while the combined output contains only the room name. No building, address,
or level relationship is emitted for those rooms.

### 3. Raw identifier size violations

The database limits `classes.name` to 20 characters and `teachers.short_name`
to 10 characters. The current output contains raw grouped values longer than
those limits:

- class: `1a,1b,2a,2b,3a,3b,4a,4b` (23 characters);
- teacher: `U_Ma,U_Rie,U_Dö` (15 characters).

These values can be normalized by splitting them before insertion, but the raw
combined value cannot be stored in the target columns without truncation or
loss.

### 4. Changes and substitutions

The `changes` table requires `date`, `lesson_class_period_id`, and `state`.
The output changes contain none of these as a stable, direct value:

- no change date is present on a change record;
- there is no source identifier or lesson-class-period identifier;
- `change_states` expects one action/state, but the output only has the three
  field flags `fachChanged`, `lehrerChanged`, and `raumChanged`; and
- the original and replacement values (`fach`/`vfach`, `lehrer`/`vlehrer`,
  `vraum`) are text, while the child tables require resolved foreign-key IDs.

Some substitutions could be reconstructed by matching class, period, and
original values against the base timetable. That is a lookup-based import,
not a lossless insert from the combined JSON, and it fails when a value is
missing or is a grouped value such as `Sz u.a.`.

`changes.info` can fit in `changes.info_text` (`VARCHAR(255)`); the problem is
the missing identity and state, not the observed text length.

### 5. Sections with no destination table

The following current or supported output data cannot be persisted in the
current schema without adding tables or columns:

- `kurse`: course abbreviation and assigned teacher;
- `unterricht`: source lesson number, subject, group, and teacher;
- `aufsichten`: supervision date/period, time, location, replacement state,
  target, and note;
- `planinfo`: plan notes by day and period; and
- `klausuren`: exam details (`jahrgang`, `kurs`, `kursleiter`, `stunde`,
  `beginn`, `dauer`, and `kinfo`) when that currently empty section is
  populated.

`Sperrungen` also has no table, although no such rows are present in this
  `output.json`.

### 6. Calendar data

`freietage` can be stored in `holidays` using `date` and `feiertag`; the raw
six-digit `value` is redundant and would be lost.

`schulwochen` partially maps to `weeks`:

- `kw` can map to `weeks.calendar_week`;
- `weektype` can map to `week_types.name`; and
- `datumvon`/`datumbis` can map to `weeks.start_date`/`weeks.end_date`.

The source school-week `number` has no column. The `basisdaten` values
`swvon`, `swbis`, and `tageprowoche` also have no direct destination. The JSON
dates are timestamps produced by JavaScript and must be converted to SQL
`DATE` values before insertion.

## Minimum changes for a lossless import

At minimum, the import format or schema needs to preserve:

1. source plan type and source file/date for every metadata, timetable, and
   change record;
2. entity type (`class`, `teacher`, or `room`) for every `dayData` and
   `weeklyData` entity;
3. source lesson identity, course, plan info, and source lesson/group details;
4. change date, action/state, and a stable link to the affected lesson;
5. building and level information for rooms; and
6. tables for courses, supervision, plan notes, exams, and blocked periods.

The alternative is a deliberately lossy import that stores only normalized
classes, teachers, subjects, periods, holidays, partial weeks, and timetable
relationships that can be resolved against a separately retained source file.