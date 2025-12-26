import mariadb from 'mariadb';
import { config } from 'dotenv';

interface parsedData {
    planType: string,
    planDate: string,
    timeStamp: string,
    classes: string[],
    subjects: string[],
    rooms: string[],
    teachers: string[],
    periods: {number: number, start: string, end: string}[],
    holidayRanges: {start: string, end: string}[],
    plans: {
        id: number,
        day: string,
        period: number,
        className: string,
        classChanged: boolean,
        teacher: string,
        teacherChanged: boolean,
        subject: string,
        subjectChanged: boolean,
        room: string,
        roomChanged: boolean,
        changeDetails: string
    }[]
}

config();

const pool = mariadb.createPool({
    host: process.env.DB_HOST ?? '',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? '',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'timetable_v2',
    compress: true
});

export async function queryClasses(): Promise<{id: BigInt, name: string}[]> {
    const conn = await pool.getConnection();
    try {
        const rows = await conn.query("SELECT id, name FROM classes;");
        return Array.isArray(rows) ? (rows as {id: BigInt, name: string}[]) : [];
    } finally {
        conn.release();
    }
}

export async function querySubjects(): Promise<{id: BigInt, short_name: string, long_name: string}[]> {
    const conn = await pool.getConnection();
    try {
        const rows = await conn.query("SELECT id, short_name, long_name FROM subjects;");
        return Array.isArray(rows) ? (rows as {id: BigInt, short_name: string, long_name: string}[]) : [];
    } finally {
        conn.release();
    }
}

export async function queryRooms(): Promise<{id: number, name: string, building: string, level: string, address: string}[]> {
    const conn = await pool.getConnection();
    try {
        const rows = await conn.query(`SELECT r.id, r.name, b.name AS building, r.level, b.address FROM rooms r INNER JOIN buildings b ON r.building_id = b.id;`);
        return Array.isArray(rows) ? (rows as {id: number, name: string, building: string, level: string, address: string}[]) : [];
    } finally {
        conn.release();
    }
}

export async function queryTeachers(): Promise<{id: BigInt, short_name: string}[]> {
    const conn = await pool.getConnection();
    try {
        const rows = await conn.query("SELECT id, short_name FROM teachers;");
        return Array.isArray(rows) ? (rows as {id: BigInt, short_name: string}[]) : [];
    } finally {
        conn.release();
    }
}

export async function queryAvailableDates(): Promise<string[]> {
    const conn = await pool.getConnection();
    try {
        const rows = await conn.query("SELECT DISTINCT date FROM timetable_instances ORDER BY date;");
        return Array.isArray(rows) ? (rows as {date: string}[]).map(r => r.date) : [];
    } finally {
        conn.release();
    }
}

export async function queryLatestDate(): Promise<string | null> {
    const conn = await pool.getConnection();
    try {
        const rows = await conn.query("SELECT date FROM timetable_instances ORDER BY date DESC LIMIT 1;");
        if (Array.isArray(rows) && rows.length > 0) {
            return (rows[0] as {date: string}).date;
        } else {
            return null;
        }
    } finally {
        conn.release();
    }
}

export async function queryHolidays(): Promise<{id: BigInt, name: string, start_date: string, end_date: string}[]> {
    const conn = await pool.getConnection();
    try {
        const rows = await conn.query("SELECT id, name, start_date, end_date FROM holidays;");
        return Array.isArray(rows) ? (rows as {id: BigInt, name: string, start_date: string, end_date: string}[]) : [];
    } finally {
        conn.release();
    }
}

export async function queryPeriods(): Promise<{number: number, start_time: string, end_time: string}[]> {
    const conn = await pool.getConnection();
    try {
        const rows = await conn.query("SELECT number, start_time, end_time FROM periods ORDER BY number;");
        return Array.isArray(rows) ? (rows as {number: number, start_time: string, end_time: string}[]) : [];
    } finally {
        conn.release();
    }
}

export async function updateQueryResults(data: parsedData): Promise<void> {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Insert plan metadata 
        if (data.planDate && data.timeStamp && data.planType) {
            await conn.query(
                `INSERT INTO plan_metadata (reference_date, generated_at, plan_type) 
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE generated_at = VALUES(generated_at), plan_type = VALUES(plan_type);`,
                [data.planDate, new Date(data.timeStamp).toLocaleString('lt-LT'), data.planType]
            );
        }

        // Batch insert classes
        if (data.classes.length > 0) {
            const classValues = data.classes.map(name => [name]);
            await conn.batch("INSERT INTO classes (name) VALUES (?) ON DUPLICATE KEY UPDATE name = VALUES(name);", classValues);
            var classesMap: {[key: string]: number} = {};
            const classRows = await conn.query("SELECT id, name FROM classes WHERE name IN (?);", [data.classes]);
            for (const row of classRows as {id: number, name: string}[]) {
                classesMap[row.name] = row.id;
            }
        }

        // Batch insert subjects
        if (data.subjects.length > 0) {
            const subjectValues = data.subjects.map(name => [name]);
            await conn.batch("INSERT INTO subjects (short_name) VALUES (?) ON DUPLICATE KEY UPDATE short_name = VALUES(short_name);", subjectValues);
            var subjectsMap: {[key: string]: number} = {};
            const subjectRows = await conn.query("SELECT id, short_name FROM subjects WHERE short_name IN (?);", [data.subjects]);
            for (const row of subjectRows as {id: number, short_name: string}[]) {
                subjectsMap[row.short_name] = row.id;
            }
        } else {
            var subjectsMap: {[key: string]: number} = {};
        }

        // Batch insert rooms
        if (data.rooms.length > 0) {
            const roomValues = data.rooms.map(name => [name]);
            await conn.batch("INSERT INTO rooms (name) VALUES (?) ON DUPLICATE KEY UPDATE name = VALUES(name);", roomValues);
            var roomsMap: {[key: string]: number} = {};
            const roomRows = await conn.query("SELECT id, name FROM rooms WHERE name IN (?);", [data.rooms]);
            for (const row of roomRows as {id: number, name: string}[]) {
                roomsMap[row.name] = row.id;
            }
        } else {
            var roomsMap: {[key: string]: number} = {};
        }

        // Batch insert teachers
        if (data.teachers.length > 0) {
            const teacherValues = data.teachers.map(name => [name]);
            await conn.batch("INSERT INTO teachers (short_name) VALUES (?) ON DUPLICATE KEY UPDATE short_name = VALUES(short_name);", teacherValues);
            var teachersMap: {[key: string]: number} = {};
            const teacherRows = await conn.query("SELECT id, short_name FROM teachers WHERE short_name IN (?);", [data.teachers]);
            for (const row of teacherRows as {id: number, short_name: string}[]) {
                teachersMap[row.short_name] = row.id;
            }
        } else {
            var teachersMap: {[key: string]: number} = {};
        }

        // Batch insert periods
        if (data.periods.length > 0) {
            const periodValues = data.periods.map((period) => [period.number, period.start, period.end]).filter(([_, start, end]) => start && end);
            await conn.batch("INSERT INTO periods (number, start_time, end_time) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), end_time = VALUES(end_time);", periodValues);
        }

        // Batch insert holidays
        if (data.holidayRanges.length > 0) {
            const holidayValues = data.holidayRanges.map(holiday => [holiday.start, holiday.end]);
            await conn.batch("INSERT INTO holidays (start_date, end_date) VALUES (?, ?) ON DUPLICATE KEY UPDATE start_date = VALUES(start_date), end_date = VALUES(end_date);", holidayValues);
        }

        // Batch insert lesson definitions
        const lessonDefinitionMap = new Map<string, [number | null, number | null, number | null]>();
        for (const plan of data.plans) {
            const subjectId = subjectsMap[plan.subject] ?? 1;
            const teacherId = teachersMap[plan.teacher] ?? 1;
            const roomId = roomsMap[plan.room] ?? 1;
            const key = `${subjectId}|${teacherId}|${roomId}`;
            if (!lessonDefinitionMap.has(key)) {
                lessonDefinitionMap.set(key, [subjectId, teacherId, roomId]);
            }
        }
        const lessonDefinitions = Array.from(lessonDefinitionMap.values());
        await conn.batch(
            `INSERT INTO lesson_definitions (subject_id, teacher_id, room_id) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE subject_id = VALUES(subject_id), teacher_id = VALUES(teacher_id), room_id = VALUES(room_id);`,
            lessonDefinitions
        );

        // Map lesson definitions to their IDs
        const lessonDefinitionRows = await conn.query(
            `SELECT id, subject_id, teacher_id, room_id 
             FROM lesson_definitions;`
        );
        const lessonDefinitionsMap: { [key: string]: number } = {};
        for (const row of lessonDefinitionRows as { id: number, subject_id: number, teacher_id: number, room_id: number }[]) {
            const key = `${row.subject_id}-${row.teacher_id}-${row.room_id}`;
            lessonDefinitionsMap[key] = row.id;
        }

        // Match lessons with classes
        // Batch insert lesson_classes
        const lessonClassValues = data.plans.map(plan => {
            const classId = classesMap[plan.className] ?? null;
            const subjectId = subjectsMap[plan.subject] ?? 1;
            const teacherId = teachersMap[plan.teacher] ?? 1;
            const roomId = roomsMap[plan.room] ?? 1;
            return [lessonDefinitionsMap[`${subjectId}-${teacherId}-${roomId}`] ?? null, classId];
        }).filter(([definitionId, classId]) => definitionId !== null && classId !== null);

        if (lessonClassValues.length > 0) {
            await conn.batch(
                `INSERT INTO lesson_classes (definition_id, class_id) 
                 VALUES (?, ?) 
                 ON DUPLICATE KEY UPDATE definition_id = VALUES(definition_id), class_id = VALUES(class_id);`,
                lessonClassValues
            );
        }

        // Batch insert timetable instances
        if (data.plans.length > 0) {
            const timetableValues = data.plans.map(plan => {
                const definitionKey = `${subjectsMap[plan.subject] ?? 1}-${teachersMap[plan.teacher] ?? 1}-${roomsMap[plan.room] ?? 1}`;
                return [
                    plan.day,
                    plan.period,
                    lessonDefinitionsMap[definitionKey] ?? null,
                    'scheduled'
                ];
            });
            await conn.batch(
                `INSERT INTO timetable_instances (date, period_number, definition_id, status) 
                 VALUES (?, ?, ?, ?) 
                 ON DUPLICATE KEY UPDATE status = VALUES(status);`,
                timetableValues
            );
        }

        // Map timetable instances to their IDs
        const timetableInstanceRows = await conn.query(
            `SELECT id, date, period_number, definition_id 
             FROM timetable_instances 
             WHERE date IN (?) AND period_number IN (?);`,
            [data.plans.map(plan => plan.day), data.plans.map(plan => plan.period)]
        );

        const timetableInstancesMap: { [key: string]: number } = {};
        for (const row of timetableInstanceRows as { id: number, date: Date, period_number: number, definition_id: number }[]) {
            const key = `${row.date.toLocaleDateString('en-CA')}-${row.period_number}-${row.definition_id}`;
            timetableInstancesMap[key] = row.id;
        }

        // Batch insert substitution details
        const substitutionValues = data.plans
            .filter(plan => plan.teacherChanged || plan.roomChanged)
            .map(plan => {
                const definitionKey = `${subjectsMap[plan.subject] ?? 1}-${teachersMap[plan.teacher] ?? 1}-${roomsMap[plan.room] ?? 1}`;
                const instanceKey = `${plan.day}-${plan.period}-${lessonDefinitionsMap[definitionKey] ?? null}`;
                const instanceId = timetableInstancesMap[instanceKey] ?? null;

                if (instanceId !== null) {
                    return [
                        plan.day,
                        instanceId,
                        plan.teacherChanged ? teachersMap[plan.teacher] : null,
                        plan.roomChanged ? roomsMap[plan.room] : null,
                        plan.changeDetails
                    ];
                }
                return null;
            })
            .filter(row => row !== null);

        if (substitutionValues.length > 0) {
            await conn.batch(
                `INSERT INTO substitution_details (instance_date, instance_id, original_teacher_id, original_room_id, notes) 
                 VALUES (?, ?, ?, ?, ?) 
                 ON DUPLICATE KEY UPDATE original_teacher_id = VALUES(original_teacher_id), original_room_id = VALUES(original_room_id), notes = VALUES(notes);`,
                substitutionValues
            );
        }

        await conn.commit();
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

export async function close(): Promise<void> {
    await pool.end();
}