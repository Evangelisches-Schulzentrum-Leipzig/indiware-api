import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import mariadb from 'mariadb';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const inputPath = process.argv.slice(2).find(argument => !argument.startsWith('--')) ?? 'output.json';
const databaseName = process.argv.find(argument => argument.startsWith('--database='))?.split('=', 2)[1] ?? 'timetable-v2';
const databaseConfig = {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? 'notSecureChangeMe',
    database: databaseName,
    connectionLimit: 1
};

function textValue(value) {
    return value === null || value === undefined ? null : String(value);
}

function normalizedValue(value) {
    const result = textValue(value)?.trim() ?? '';
    return result === '' || result === '&nbsp;' ? null : result;
}

function integerValue(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const result = Number.parseInt(String(value), 10);
    return Number.isInteger(result) ? result : null;
}

function requiredInteger(value, fieldName) {
    const result = integerValue(value);
    if (result === null) throw new Error(`Invalid ${fieldName}: ${JSON.stringify(value)}`);
    return result;
}

function sqlDate(year, month, day) {
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function localDateParts(date) {
    return sqlDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function parseDate(value) {
    const rawValue = textValue(value)?.trim();
    if (!rawValue) return null;

    const isoMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})T/);
    if (isoMatch) {
        const date = new Date(rawValue);
        if (Number.isNaN(date.getTime())) throw new Error(`Invalid ISO date: ${rawValue}`);
        return localDateParts(date);
    }

    const germanMatch = rawValue.match(/(?:^|,\s*)(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (germanMatch) return sqlDate(Number(germanMatch[3]), Number(germanMatch[2]), Number(germanMatch[1]));

    const compactMatch = rawValue.match(/(?:^|[^\d])(\d{2})(\d{2})(\d{2})(?:[^\d]|$)/);
    if (compactMatch) return sqlDate(2000 + Number(compactMatch[1]), Number(compactMatch[2]), Number(compactMatch[3]));

    const plainMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (plainMatch) return sqlDate(Number(plainMatch[1]), Number(plainMatch[2]), Number(plainMatch[3]));

    return null;
}

function parseDateFromFileName(fileName) {
    const match = textValue(fileName)?.match(/(\d{4})(\d{2})(\d{2})/);
    return match ? sqlDate(Number(match[1]), Number(match[2]), Number(match[3])) : null;
}

function parseTimestamp(value) {
    const rawValue = textValue(value)?.trim();
    if (!rawValue) return null;
    const match = rawValue.match(/(\d{1,2})\.(\d{1,2})\.(\d{4}),\s*(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return `${sqlDate(Number(match[3]), Number(match[2]), Number(match[1]))} ${String(match[4]).padStart(2, '0')}:${match[5]}:00`;
}

function parseTime(value) {
    const rawValue = normalizedValue(value);
    if (!rawValue) return null;
    const match = rawValue.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) throw new Error(`Invalid time: ${rawValue}`);
    return `${String(Number(match[1])).padStart(2, '0')}:${match[2]}:${match[3] ?? '00'}`;
}

function parsePeriodRange(value) {
    const rawValue = normalizedValue(value);
    if (!rawValue) return { start: null, end: null };
    const range = rawValue.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) return { start: Number(range[1]), end: Number(range[2]) };
    const period = integerValue(rawValue);
    return { start: period, end: period };
}

function inferPlanType(fileName) {
    const name = normalizedValue(fileName) ?? '';
    if (/^PlanKl/i.test(name)) return 'VpMobil_Class';
    if (/^PlanLe/i.test(name)) return 'VpMobil_Teacher';
    if (/^VplanKl/i.test(name)) return 'Change_Class';
    if (/^VplanLe/i.test(name)) return 'Change_Teacher';
    if (/^SPlanKl_Basis/i.test(name)) return 'WeeklyBase_Class';
    if (/^SPlanLe_Basis/i.test(name)) return 'WeeklyBase_Teacher';
    if (/^SPlanRa_Basis/i.test(name)) return 'WeeklyBase_Room';
    if (/^SPlanKl_Sw/i.test(name)) return 'WeeklySW_Class';
    if (/^SPlanLe_Sw/i.test(name)) return 'WeeklySW_Teacher';
    if (/^SPlanRa_Sw/i.test(name)) return 'WeeklySW_Room';
    if (/^WPlanKl/i.test(name)) return 'WeeklyChange_Class';
    if (/^WPlanLe/i.test(name)) return 'WeeklyChange_Teacher';
    if (/^WPlanRa/i.test(name)) return 'WeeklyChange_Room';
    return null;
}

function inferEntityType(entity) {
    if (entity.entityType === 'CLASS' || entity.entityType === 'TEACHER' || entity.entityType === 'ROOM') {
        return entity.entityType;
    }
    const entityName = normalizedValue(entity.name);
    const plans = Array.isArray(entity.plan) ? entity.plan : [];
    if ((entity.kurse?.length ?? 0) > 0 || (entity.unterricht?.length ?? 0) > 0) return 'CLASS';
    if ((entity.aufsichten?.length ?? 0) > 0 || (entity.planinfo?.length ?? 0) > 0) return 'TEACHER';

    const classMatches = plans.filter(plan => normalizedValue(plan.klasse) === entityName).length;
    const teacherMatches = plans.filter(plan => normalizedValue(plan.lehrer) === entityName).length;
    const roomMatches = plans.filter(plan => normalizedValue(plan.raum) === entityName).length;
    const highestMatch = Math.max(classMatches, teacherMatches, roomMatches);
    if (highestMatch === teacherMatches && teacherMatches > 0) return 'TEACHER';
    if (highestMatch === roomMatches && roomMatches > 0) return 'ROOM';
    return 'CLASS';
}

function rawPlanDate(sourcesMetadata, fallback) {
    for (const source of sourcesMetadata) {
        const fileDate = parseDateFromFileName(source.datei);
        if (fileDate) return fileDate;
    }
    return parseDate(fallback) ?? null;
}

async function getOrCreateSimple(connection, cache, tableName, columnName, value) {
    const canonicalValue = normalizedValue(value);
    if (!canonicalValue) return null;
    const cacheKey = `${tableName}:${canonicalValue}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const existingRows = await connection.query(`SELECT id FROM \`${tableName}\` WHERE \`${columnName}\` = ? LIMIT 1`, [canonicalValue]);
    if (existingRows.length > 0) {
        const id = Number(existingRows[0].id);
        cache.set(cacheKey, id);
        return id;
    }

    await connection.query(`INSERT INTO \`${tableName}\` (\`${columnName}\`) VALUES (?)`, [canonicalValue]);
    const insertedRows = await connection.query(`SELECT id FROM \`${tableName}\` WHERE \`${columnName}\` = ? ORDER BY id DESC LIMIT 1`, [canonicalValue]);
    if (insertedRows.length === 0) throw new Error(`Could not create ${tableName}.${columnName}=${canonicalValue}`);
    const id = Number(insertedRows[0].id);
    cache.set(cacheKey, id);
    return id;
}

async function getOrCreateTeacher(connection, cache, value) {
    return getOrCreateSimple(connection, cache, 'teachers', 'short_name', value);
}

async function getOrCreateClass(connection, cache, value) {
    const canonicalValue = normalizedValue(value);
    if (!canonicalValue) return null;
    const isGroup = canonicalValue.includes(',') || canonicalValue.includes('-');
    const cacheKey = `classes:${canonicalValue}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const existingRows = await connection.query('SELECT id FROM classes WHERE name = ? LIMIT 1', [canonicalValue]);
    if (existingRows.length > 0) {
        const id = Number(existingRows[0].id);
        cache.set(cacheKey, id);
        return id;
    }
    await connection.query('INSERT INTO classes (name, is_group) VALUES (?, ?)', [canonicalValue, isGroup ? 1 : 0]);
    const insertedRows = await connection.query('SELECT id FROM classes WHERE name = ? LIMIT 1', [canonicalValue]);
    if (insertedRows.length === 0) throw new Error(`Could not create class ${canonicalValue}`);
    const id = Number(insertedRows[0].id);
    cache.set(cacheKey, id);
    return id;
}

async function getOrCreateSubject(connection, cache, value) {
    return getOrCreateSimple(connection, cache, 'subjects', 'short_name', value);
}

async function getOrCreateRoom(connection, cache, value) {
    return getOrCreateSimple(connection, cache, 'rooms', 'name', value);
}

async function getOrCreateWeekType(connection, cache, value) {
    const displayValue = normalizedValue(value);
    if (!displayValue) return null;
    const canonicalValue = displayValue.replace(/[- ]?Woche$/i, '').trim() || displayValue;
    const cacheKey = `week_types:${canonicalValue}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const existingRows = await connection.query('SELECT id FROM week_types WHERE code = ? LIMIT 1', [canonicalValue]);
    if (existingRows.length > 0) {
        const id = Number(existingRows[0].id);
        cache.set(cacheKey, id);
        return id;
    }
    await connection.query('INSERT INTO week_types (code, name) VALUES (?, ?)', [canonicalValue, displayValue]);
    const insertedRows = await connection.query('SELECT id FROM week_types WHERE code = ? LIMIT 1', [canonicalValue]);
    if (insertedRows.length === 0) throw new Error(`Could not create week type ${canonicalValue}`);
    const id = Number(insertedRows[0].id);
    cache.set(cacheKey, id);
    return id;
}

async function getOrCreateCourse(connection, cache, code, classId, teacherId) {
    const canonicalCode = normalizedValue(code);
    if (!canonicalCode) return null;
    const cacheKey = `courses:${canonicalCode}:${classId ?? '<null>'}:${teacherId ?? '<null>'}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const existingRows = await connection.query(
        'SELECT id FROM courses WHERE code = ? AND class_id <=> ? AND teacher_id <=> ? LIMIT 1',
        [canonicalCode, classId, teacherId]
    );
    if (existingRows.length > 0) {
        const id = Number(existingRows[0].id);
        cache.set(cacheKey, id);
        return id;
    }
    await connection.query('INSERT INTO courses (code, class_id, teacher_id) VALUES (?, ?, ?)', [canonicalCode, classId, teacherId]);
    const insertedRows = await connection.query(
        'SELECT id FROM courses WHERE code = ? AND class_id <=> ? AND teacher_id <=> ? ORDER BY id DESC LIMIT 1',
        [canonicalCode, classId, teacherId]
    );
    if (insertedRows.length === 0) throw new Error(`Could not create course ${canonicalCode}`);
    const id = Number(insertedRows[0].id);
    cache.set(cacheKey, id);
    return id;
}

async function getOrCreateTeachingUnit(connection, cache, lessonNumber, subjectId, teacherId, classId, groupName) {
    const normalizedLessonNumber = normalizedValue(lessonNumber);
    if (!normalizedLessonNumber || subjectId === null) return null;
    const cacheKey = [normalizedLessonNumber, subjectId, teacherId, classId, groupName ?? '<null>'].join('|');
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const existingRows = await connection.query(
        'SELECT id FROM teaching_units WHERE lesson_number = ? AND subject_id = ? AND teacher_id <=> ? AND class_id <=> ? AND group_name <=> ? LIMIT 1',
        [normalizedLessonNumber, subjectId, teacherId, classId, groupName]
    );
    if (existingRows.length > 0) {
        const id = Number(existingRows[0].id);
        cache.set(cacheKey, id);
        return id;
    }
    await connection.query(
        'INSERT INTO teaching_units (lesson_number, subject_id, teacher_id, class_id, group_name) VALUES (?, ?, ?, ?, ?)',
        [normalizedLessonNumber, subjectId, teacherId, classId, groupName]
    );
    const insertedRows = await connection.query(
        'SELECT id FROM teaching_units WHERE lesson_number = ? AND subject_id = ? AND teacher_id <=> ? AND class_id <=> ? AND group_name <=> ? ORDER BY id DESC LIMIT 1',
        [normalizedLessonNumber, subjectId, teacherId, classId, groupName]
    );
    if (insertedRows.length === 0) throw new Error(`Could not create teaching unit ${normalizedLessonNumber}`);
    const id = Number(insertedRows[0].id);
    cache.set(cacheKey, id);
    return id;
}

async function ensurePeriod(connection, cache, periodNumber, startTime, endTime) {
    const cacheKey = `${periodNumber}:${startTime ?? '<null>'}:${endTime ?? '<null>'}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const existingRows = await connection.query(
        'SELECT id FROM periods WHERE period_number = ? AND start_time <=> ? AND end_time <=> ? LIMIT 1',
        [periodNumber, startTime, endTime]
    );
    if (existingRows.length > 0) {
        const id = Number(existingRows[0].id);
        cache.set(cacheKey, id);
        return id;
    }
    await connection.query('INSERT INTO periods (period_number, start_time, end_time) VALUES (?, ?, ?)', [periodNumber, startTime, endTime]);
    const insertedRows = await connection.query(
        'SELECT id FROM periods WHERE period_number = ? AND start_time <=> ? AND end_time <=> ? ORDER BY id DESC LIMIT 1',
        [periodNumber, startTime, endTime]
    );
    if (insertedRows.length === 0) throw new Error(`Could not create period ${periodNumber}`);
    const id = Number(insertedRows[0].id);
    cache.set(cacheKey, id);
    return id;
}

async function ensureEntityPeriod(connection, entityType, entityId, periodNumber, startTime, endTime) {
    const idColumns = {
        CLASS: ['class_id', entityId, null, null],
        TEACHER: ['teacher_id', null, entityId, null],
        ROOM: ['room_id', null, null, entityId]
    };
    const [entityColumn, classId, teacherId, roomId] = idColumns[entityType];
    const existingRows = await connection.query(
        `SELECT id FROM entity_periods WHERE entity_type = ? AND class_id <=> ? AND teacher_id <=> ? AND room_id <=> ? AND period_number = ? AND start_time <=> ? AND end_time <=> ? LIMIT 1`,
        [entityType, classId, teacherId, roomId, periodNumber, startTime, endTime]
    );
    if (existingRows.length > 0) return Number(existingRows[0].id);
    await connection.query(
        'INSERT INTO entity_periods (entity_type, class_id, teacher_id, room_id, period_number, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [entityType, classId, teacherId, roomId, periodNumber, startTime, endTime]
    );
    return null;
}

async function insertSource(connection, source, importBatchId) {
    const sourceDate = parseDateFromFileName(source.datei) ?? parseDate(source.datum);
    const validFrom = parseDate(source.gueltigab);
    const result = await connection.query(
        `INSERT INTO sources_metadata
            (import_batch_id, file_name, plan_type, plan_date_text, plan_date, generation_timestamp,
             school_name, school_city, school_number, title, days_per_week,
             school_week_number, is_native, valid_from, up_name, up_module, up_version,
             absent_teachers_raw, changed_classes_raw, changed_teachers_raw)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            importBatchId,
            textValue(source.datei) ?? 'unknown',
            textValue(source.planType) ?? inferPlanType(source.datei),
            textValue(source.datum),
            sourceDate,
            parseTimestamp(source.zeitstempel),
            textValue(source.schulname),
            textValue(source.schulort),
            textValue(source.schulnummer),
            textValue(source.titel),
            integerValue(source.tageprowoche),
            integerValue(source.woche),
            source.nativ === '1' ? 1 : 0,
            validFrom,
            textValue(source.upname),
            textValue(source.upmodul),
            textValue(source.upversion),
            textValue(source.abwesendlehrer),
            textValue(source.aenderungklassen),
            textValue(source.aenderunglehrer)
        ]
    );
    return Number(result.insertId);
}

async function insertImportBatch(connection, inputFileName, outputHash, payload) {
    const result = await connection.query(
        `INSERT INTO import_batches (source_path, sha256, payload)
         VALUES (?, ?, ?)`,
        [inputFileName, outputHash, payload]
    );
    return Number(result.insertId);
}

async function removePreviousImport(connection, outputHash) {
    const batchRows = await connection.query('SELECT id FROM import_batches WHERE sha256 = ?', [outputHash]);
    const batchIds = batchRows.map(row => Number(row.id));
    if (batchIds.length === 0) return;

    for (const tableName of [
        'academic_base_data',
        'break_supervisions',
        'exams',
        'plan_notes',
        'changes',
        'daily_timetable_entries',
        'weekly_timetable_plans'
    ]) {
        for (const batchId of batchIds) {
            await connection.query(`DELETE FROM \`${tableName}\` WHERE import_batch_id = ?`, [batchId]);
        }
    }
    for (const batchId of batchIds) {
        await connection.query('DELETE FROM sources_metadata WHERE import_batch_id = ?', [batchId]);
    }
    await connection.query('DELETE FROM import_batches WHERE sha256 = ?', [outputHash]);
}

async function insertCalendarData(connection, outputData, importBatchId) {
    for (const holiday of outputData.freietage ?? []) {
        const holidayDate = parseDate(holiday.date) ?? parseDate(holiday.value);
        if (!holidayDate) throw new Error(`Holiday has no valid date: ${JSON.stringify(holiday)}`);
        await connection.query(
            `INSERT INTO holidays (date, raw_code, is_festivity)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE raw_code = VALUES(raw_code), is_festivity = VALUES(is_festivity)`,
            [holidayDate, textValue(holiday.value), holiday.feiertag ? 1 : 0]
        );
    }

    const weekTypeCache = new Map();
    for (const schoolWeek of outputData.schulwochen ?? []) {
        const startDate = parseDate(schoolWeek.datumvon);
        const endDate = parseDate(schoolWeek.datumbis);
        const schoolWeekNumber = requiredInteger(schoolWeek.number, 'school week number');
        const calendarWeek = requiredInteger(schoolWeek.kw, 'calendar week');
        if (!startDate || !endDate) throw new Error(`School week has no valid date range: ${JSON.stringify(schoolWeek)}`);
        const weekTypeId = await getOrCreateWeekType(connection, weekTypeCache, schoolWeek.weektype);
        await connection.query(
            `INSERT INTO school_weeks (school_week, calendar_week, week_type_id, start_date, end_date)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE calendar_week = VALUES(calendar_week), week_type_id = VALUES(week_type_id), end_date = VALUES(end_date)`,
            [schoolWeekNumber, calendarWeek, weekTypeId, startDate, endDate]
        );
    }

    for (const calendarWeek of outputData.kalenderwochen ?? []) {
        const calendarWeekNumber = requiredInteger(calendarWeek.kw ?? calendarWeek.number, 'calendar week');
        await connection.query(
            'INSERT INTO calendar_weeks (calendar_week, week_type_id, start_date, end_date) VALUES (?, ?, ?, ?)',
            [
                calendarWeekNumber,
                await getOrCreateWeekType(connection, weekTypeCache, calendarWeek.weektype),
                parseDate(calendarWeek.datumvon),
                parseDate(calendarWeek.datumbis)
            ]
        );
    }

    const baseData = outputData.basisdaten;
    if (baseData) {
        await connection.query(
            `INSERT INTO academic_base_data
                (import_batch_id, valid_from, valid_to, school_week_from, school_week_to, days_per_week)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                importBatchId,
                parseDate(baseData.datumvon),
                parseDate(baseData.datumbis),
                integerValue(baseData.swvon),
                integerValue(baseData.swbis),
                integerValue(baseData.tageprowoche) ?? 5
            ]
        );
    }
}

async function seedEntityMetadata(connection, outputData, references) {
    const entities = [...(outputData.dayData ?? []), ...(outputData.weeklyData ?? [])];
    for (const entity of entities) {
        const entityType = inferEntityType(entity);
        const entityName = normalizedValue(entity.name);
        const entityId = entityType === 'CLASS'
            ? await getOrCreateClass(connection, references.cache, entityName)
            : entityType === 'TEACHER'
                ? await getOrCreateTeacher(connection, references.cache, entityName)
                : await getOrCreateRoom(connection, references.cache, entityName);

        for (const period of entity.stunden ?? []) {
            const periodNumber = requiredInteger(period.stunde, 'period number');
            const startTime = parseTime(period.beginn);
            const endTime = parseTime(period.ende);
            await ensurePeriod(connection, references.periodCache, periodNumber, startTime, endTime);
            await ensureEntityPeriod(connection, entityType, entityId, periodNumber, startTime, endTime);
        }

        for (const course of entity.kurse ?? []) {
            const classId = entityType === 'CLASS' ? entityId : null;
            const teacherId = await getOrCreateTeacher(connection, references.cache, course.lehrer);
            await getOrCreateCourse(connection, references.courseCache, course.kuerzel, classId, teacherId);
        }

        for (const unit of entity.unterricht ?? []) {
            const classId = entityType === 'CLASS' ? entityId : null;
            const subjectId = await getOrCreateSubject(connection, references.cache, unit.fach);
            if (subjectId === null) throw new Error(`Teaching unit has no subject: ${JSON.stringify(unit)}`);
            const teacherId = await getOrCreateTeacher(connection, references.cache, unit.lehrer);
            await getOrCreateTeachingUnit(connection, references.teachingUnitCache, unit.nummer, subjectId, teacherId, classId, normalizedValue(unit.gruppe));
        }
    }
}

async function insertPlanRows(connection, outputData, references, sourceId, planDate) {
    for (const entity of outputData.dayData ?? []) {
        const entityType = inferEntityType(entity);
        for (const plan of entity.plan ?? []) {
            const periodNumber = requiredInteger(plan.stunde, 'daily period number');
            const classValue = normalizedValue(plan.klasse) ?? (entityType === 'CLASS' ? entity.name : null);
            const teacherValue = normalizedValue(plan.lehrer) ?? (entityType === 'TEACHER' ? entity.name : null);
            const roomValue = normalizedValue(plan.raum) ?? (entityType === 'ROOM' ? entity.name : null);
            const classId = await getOrCreateClass(connection, references.cache, classValue);
            const teacherId = await getOrCreateTeacher(connection, references.cache, teacherValue);
            const subjectId = await getOrCreateSubject(connection, references.cache, plan.fach);
            const roomId = await getOrCreateRoom(connection, references.cache, roomValue);
            const courseId = await getOrCreateCourse(connection, references.courseCache, plan.kurs, classId, teacherId);
            await connection.query(
                `INSERT INTO daily_timetable_entries
                    (plan_date, entity_type, entity_name, period_number, start_time, end_time,
                     class_id, teacher_id, subject_id, room_id, course_id, lesson_number,
                     raw_class, raw_teacher, raw_subject, raw_room, info, is_cancelled, import_batch_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    planDate,
                    entityType,
                    textValue(entity.name) ?? '',
                    periodNumber,
                    parseTime(plan.beginn),
                    parseTime(plan.ende),
                    classId,
                    teacherId,
                    subjectId,
                    roomId,
                    courseId,
                    textValue(plan.nummer),
                    textValue(plan.klasse),
                    textValue(plan.lehrer),
                    textValue(plan.fach),
                    textValue(plan.raum),
                    textValue(plan.info),
                    plan.fach === '---' ? 1 : 0,
                    sourceId
                ]
            );
        }
    }

    for (const entity of outputData.weeklyData ?? []) {
        const entityType = inferEntityType(entity);
        for (const plan of entity.plan ?? []) {
            const periodNumber = requiredInteger(plan.stunde, 'weekly period number');
            const classValue = normalizedValue(plan.klasse) ?? (entityType === 'CLASS' ? entity.name : null);
            const teacherValue = normalizedValue(plan.lehrer) ?? (entityType === 'TEACHER' ? entity.name : null);
            const roomValue = normalizedValue(plan.raum) ?? (entityType === 'ROOM' ? entity.name : null);
            const classId = await getOrCreateClass(connection, references.cache, classValue);
            const teacherId = await getOrCreateTeacher(connection, references.cache, teacherValue);
            const subjectId = await getOrCreateSubject(connection, references.cache, plan.fach);
            const roomId = await getOrCreateRoom(connection, references.cache, roomValue);
            const courseId = await getOrCreateCourse(connection, references.courseCache, plan.kurs, classId, teacherId);
            await connection.query(
                `INSERT INTO weekly_timetable_plans
                    (entity_type, entity_name, school_week, week_type_id, day_of_week, period_number,
                     class_id, teacher_id, subject_id, room_id, course_id, lesson_number,
                     raw_class, raw_teacher, raw_subject, raw_room, info, import_batch_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    entityType,
                    textValue(entity.name) ?? '',
                    integerValue(plan.woche),
                    await getOrCreateWeekType(connection, references.weekTypeCache, plan.wochentyp),
                    integerValue(plan.tag),
                    periodNumber,
                    classId,
                    teacherId,
                    subjectId,
                    roomId,
                    courseId,
                    textValue(plan.nummer),
                    textValue(plan.klasse),
                    textValue(plan.lehrer),
                    textValue(plan.fach),
                    textValue(plan.raum),
                    textValue(plan.info),
                    sourceId
                ]
            );
        }
    }
}

async function insertChanges(connection, outputData, references, sourceId, changeDate) {
    for (const change of outputData.changes ?? []) {
        const periodRange = parsePeriodRange(change.stunde);
        const currentSubjectId = await getOrCreateSubject(connection, references.cache, change.fach);
        const originalSubjectId = await getOrCreateSubject(connection, references.cache, change.vfach);
        const currentTeacherId = await getOrCreateTeacher(connection, references.cache, change.lehrer);
        const originalTeacherId = await getOrCreateTeacher(connection, references.cache, change.vlehrer);
        const classId = await getOrCreateClass(connection, references.cache, change.klasse);
        const roomId = await getOrCreateRoom(connection, references.cache, change.vraum);
        const stateName = change.fach === '---' ? 'CANCELLED' : (change.fachChanged || change.lehrerChanged || change.raumChanged ? 'CHANGED' : 'UNCHANGED');
        const stateRows = await connection.query('SELECT id FROM change_states WHERE name = ? LIMIT 1', [stateName]);
        let stateId;
        if (stateRows.length > 0) {
            stateId = Number(stateRows[0].id);
        } else {
            const stateResult = await connection.query('INSERT INTO change_states (name) VALUES (?)', [stateName]);
            stateId = Number(stateResult.insertId);
        }
        await connection.query(
            `INSERT INTO changes
                (change_date, import_batch_id, raw_period, period_start, period_end, class_id, raw_class,
                 current_subject_id, raw_current_subject, original_subject_id, raw_original_subject,
                 is_subject_changed, current_teacher_id, raw_current_teacher, original_teacher_id,
                 raw_original_teacher, is_teacher_changed, room_id, raw_room, is_room_changed,
                 state_id, info)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                changeDate,
                sourceId,
                textValue(change.stunde) ?? '',
                periodRange.start,
                periodRange.end,
                classId,
                textValue(change.klasse) ?? '',
                currentSubjectId,
                textValue(change.fach),
                originalSubjectId,
                textValue(change.vfach),
                change.fachChanged ? 1 : 0,
                currentTeacherId,
                textValue(change.lehrer),
                originalTeacherId,
                textValue(change.vlehrer),
                change.lehrerChanged ? 1 : 0,
                roomId,
                textValue(change.vraum),
                change.raumChanged ? 1 : 0,
                stateId,
                textValue(change.info)
            ]
        );
    }
}

function entityForeignKeys(entityType, entityId) {
    return {
        teacherId: entityType === 'TEACHER' ? entityId : null,
        classId: entityType === 'CLASS' ? entityId : null,
        roomId: entityType === 'ROOM' ? entityId : null
    };
}

async function insertAdditionalData(connection, outputData, references, sourceId, planDate) {
    for (const collectionName of ['dayData', 'weeklyData']) {
        const isDaily = collectionName === 'dayData';
        for (const entity of outputData[collectionName] ?? []) {
            const entityType = inferEntityType(entity);
            const entityName = textValue(entity.name) ?? '';
            const entityId = entityType === 'CLASS'
                ? await getOrCreateClass(connection, references.cache, entity.name)
                : entityType === 'TEACHER'
                    ? await getOrCreateTeacher(connection, references.cache, entity.name)
                    : await getOrCreateRoom(connection, references.cache, entity.name);
            const foreignKeys = entityForeignKeys(entityType, entityId);

            for (const supervision of entity.aufsichten ?? []) {
                await connection.query(
                    `INSERT INTO break_supervisions
                        (duty_date, import_batch_id, teacher_id, raw_teacher, day_of_week, preceding_period,
                         duty_time, slot_name, location, change_type, substitute_for_teacher_id,
                         substitute_for_raw, info)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        isDaily ? planDate : null,
                        sourceId,
                        foreignKeys.teacherId,
                        entityName,
                        integerValue(supervision.tag),
                        integerValue(supervision.vorstunde),
                        parseTime(supervision.uhrzeit),
                        textValue(supervision.zeit) ?? '',
                        textValue(supervision.ort) ?? '',
                        textValue(supervision.aenderung),
                        await getOrCreateTeacher(connection, references.cache, supervision.fuer),
                        textValue(supervision.fuer),
                        textValue(supervision.info)
                    ]
                );
            }

            for (const note of entity.planinfo ?? []) {
                const dayOfWeek = requiredInteger(note.tag, 'plan note day');
                const periodNumber = requiredInteger(note.stunde, 'plan note period');
                await connection.query(
                    `INSERT INTO plan_notes
                        (entity_type, entity_name, teacher_id, class_id, room_id, day_of_week,
                         period_number, note_text, plan_date, import_batch_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        entityType,
                        entityName,
                        foreignKeys.teacherId,
                        foreignKeys.classId,
                        foreignKeys.roomId,
                        dayOfWeek,
                        periodNumber,
                        textValue(note.text) ?? '',
                        isDaily ? planDate : null,
                        sourceId
                    ]
                );
            }

            for (const blockedPeriod of entity.sperrungen ?? []) {
                const dayOfWeek = requiredInteger(blockedPeriod.tag, 'blocked period day');
                const periodNumber = requiredInteger(blockedPeriod.stunde, 'blocked period number');
                await connection.query(
                    `INSERT INTO blocked_periods
                        (entity_type, entity_name, teacher_id, class_id, room_id, day_of_week, period_number)
                     VALUES (?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE reason = VALUES(reason)`,
                    [
                        entityType,
                        entityName,
                        foreignKeys.teacherId,
                        foreignKeys.classId,
                        foreignKeys.roomId,
                        dayOfWeek,
                        periodNumber
                    ]
                );
            }
        }
    }

    for (const exam of outputData.klausuren ?? []) {
        const teacherId = await getOrCreateTeacher(connection, references.cache, exam.kursleiter);
        const courseId = await getOrCreateCourse(connection, references.courseCache, exam.kurs, null, teacherId);
        await connection.query(
            `INSERT INTO exams
                (exam_date, import_batch_id, grade_level, course_code, course_id, teacher_id,
                 raw_teacher, period_number, start_time, duration_minutes, info)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                planDate,
                sourceId,
                textValue(exam.jahrgang),
                textValue(exam.kurs),
                courseId,
                teacherId,
                textValue(exam.kursleiter),
                integerValue(exam.stunde),
                parseTime(exam.beginn),
                integerValue(exam.dauer),
                textValue(exam.kinfo)
            ]
        );
    }
}

async function verifyImport(connection, expected) {
    const tableNames = [
        'sources_metadata',
        'academic_base_data',
        'holidays',
        'school_weeks',
        'calendar_weeks',
        'teachers',
        'classes',
        'subjects',
        'rooms',
        'periods',
        'entity_periods',
        'courses',
        'teaching_units',
        'daily_timetable_entries',
        'weekly_timetable_plans',
        'changes',
        'break_supervisions',
        'exams',
        'blocked_periods',
        'plan_notes'
    ];
    const counts = {};
    for (const tableName of tableNames) {
        const rows = await connection.query(`SELECT COUNT(*) AS count FROM \`${tableName}\``);
        counts[tableName] = Number(rows[0].count);
    }
    const importedCounts = {
        daily_timetable_entries: expected.dailyPlans,
        weekly_timetable_plans: expected.weeklyPlans,
        changes: expected.changes,
        break_supervisions: expected.supervisions,
        plan_notes: expected.planNotes,
        exams: expected.exams
    };
    for (const [tableName, expectedCount] of Object.entries(importedCounts)) {
        const rows = await connection.query(`SELECT COUNT(*) AS count FROM \`${tableName}\` WHERE import_batch_id = ?`, [expected.importBatchId]);
        const actualCount = Number(rows[0].count);
        if (actualCount !== expectedCount) throw new Error(`${tableName}: expected ${expectedCount}, inserted ${actualCount}`);
    }
    return counts;
}

async function main() {
    const inputBuffer = await fs.readFile(inputPath);
    const outputData = JSON.parse(inputBuffer.toString('utf8'));
    const outputHash = crypto.createHash('sha256').update(inputBuffer).digest('hex');
    const sourcesMetadata = Array.isArray(outputData.sourcesMetadata) ? outputData.sourcesMetadata : [];
    const planDate = rawPlanDate(sourcesMetadata, outputData.changes?.[0]?.date);
    if (!planDate && ((outputData.dayData?.length ?? 0) > 0 || (outputData.changes?.length ?? 0) > 0)) {
        throw new Error('Could not determine the plan date from sourcesMetadata or changes');
    }
    const connection = await mariadb.createConnection(databaseConfig);

    try {
        await connection.beginTransaction();
        await removePreviousImport(connection, outputHash);
        const importBatchId = await insertImportBatch(connection, path.resolve(inputPath), outputHash, inputBuffer.toString('utf8'));
        const sourceIds = [];
        for (const source of sourcesMetadata) sourceIds.push(await insertSource(connection, source, importBatchId));

        const references = {
            cache: new Map(),
            courseCache: new Map(),
            teachingUnitCache: new Map(),
            periodCache: new Map(),
            weekTypeCache: new Map()
        };

        await insertCalendarData(connection, outputData, importBatchId);
        await seedEntityMetadata(connection, outputData, references);
        await insertPlanRows(connection, outputData, references, importBatchId, planDate);
        await insertChanges(connection, outputData, references, importBatchId, planDate);
        await insertAdditionalData(connection, outputData, references, importBatchId, planDate);
        await connection.commit();

        const counts = await verifyImport(connection, {
            importBatchId,
            dailyPlans: (outputData.dayData ?? []).reduce((total, entity) => total + (entity.plan?.length ?? 0), 0),
            weeklyPlans: (outputData.weeklyData ?? []).reduce((total, entity) => total + (entity.plan?.length ?? 0), 0),
            changes: outputData.changes?.length ?? 0,
            supervisions: [...(outputData.dayData ?? []), ...(outputData.weeklyData ?? [])].reduce((total, entity) => total + (entity.aufsichten?.length ?? 0), 0),
            planNotes: [...(outputData.dayData ?? []), ...(outputData.weeklyData ?? [])].reduce((total, entity) => total + (entity.planinfo?.length ?? 0), 0),
            exams: outputData.klausuren?.length ?? 0
        });
        console.log(`Imported ${inputPath} into ${databaseName}.`);
        console.log(`Import batch id: ${importBatchId}; hash: ${outputHash}`);
        console.log(`Stored source headers: ${sourceIds.length}; daily plans: ${counts.daily_timetable_entries}; weekly plans: ${counts.weekly_timetable_plans}; changes: ${counts.changes}.`);
        console.log(`Reference totals: classes ${counts.classes}, teachers ${counts.teachers}, subjects ${counts.subjects}, rooms ${counts.rooms}, courses ${counts.courses}.`);
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        await connection.end();
    }
}

main().catch(error => {
    console.error(`Import failed: ${error.message}`);
    process.exitCode = 1;
});
