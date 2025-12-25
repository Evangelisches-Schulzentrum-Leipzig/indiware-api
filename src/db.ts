import mariadb from 'mariadb';
import { config } from 'dotenv';

interface parsedData {
    planDate: string,
    timeStamp: string,
    classes: string[],
    subjects: string[],
    rooms: string[],
    teachers: string[],
    periods: {start: string, end: string}[],
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
    database: process.env.DB_NAME ?? 'timetable',
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

export async function queryRooms(): Promise<{id: BigInt, name: string, description: string, building: string, level: string, address: string, capacity: number, features: string}[]> {
    const conn = await pool.getConnection();
    try {
        const rows = await conn.query("SELECT id, name, description, building, level, address, capacity, features FROM rooms;");
        return Array.isArray(rows) ? (rows as {id: BigInt, name: string, description: string, building: string, level: string, address: string, capacity: number, features: string}[]) : [];
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
        const rows = await conn.query("SELECT DISTINCT day FROM timetable_entries ORDER BY day;");
        return Array.isArray(rows) ? (rows as {day: string}[]).map(r => r.day) : [];
    } finally {
        conn.release();
    }
}

export async function queryLatestDate(): Promise<string | null> {
    const conn = await pool.getConnection();
    try {
        const rows = await conn.query("SELECT day FROM timetable_entries ORDER BY day DESC LIMIT 1;");
        if (Array.isArray(rows) && rows.length > 0) {
            return (rows[0] as {day: string}).day;
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
        }

        // Batch insert periods
        if (data.periods.length > 0) {
            const periodValues = data.periods.map((period, index) => [index, period.start, period.end]).filter(([_, start, end]) => start && end);
            await conn.batch("INSERT INTO periods (number, start_time, end_time) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), end_time = VALUES(end_time);", periodValues);
        }

        // Batch insert holidays
        if (data.holidayRanges.length > 0) {
            const holidayValues = data.holidayRanges.map((holiday, index) => [index, holiday.start, holiday.end]);
            await conn.batch("INSERT INTO holidays (name, start_date, end_date) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE start_date = VALUES(start_date), end_date = VALUES(end_date);", holidayValues);
        }

        // Batch insert plans
        if (data.plans.length > 0) {
            const planValues = data.plans.map(plan => [
                plan.day,
                plan.period,
                classesMap[plan.className] == undefined ? 1 : classesMap[plan.className],
                plan.teacherChanged ? teachersMap[plan.teacher] : null,
                subjectsMap[plan.subject],
                plan.roomChanged ? roomsMap[plan.room] : null,
                plan.teacherChanged ? null : teachersMap[plan.teacher],
                plan.roomChanged ? null : roomsMap[plan.room],
                plan.changeDetails
            ]);
            await conn.batch(`INSERT INTO timetable_entries (day, period_number, class_id, subject_id, teacher_id, room_id, original_teacher_id, original_room_id, substitution_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE substitution_notes = VALUES(substitution_notes);`, planValues);
        }

        await conn.commit();
    } catch (error) {
        await conn.rollback();
        throw error;
    }

    conn.release();
}

export async function close(): Promise<void> {
    await pool.end();
}