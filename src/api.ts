import { config } from 'dotenv';
import express from 'express';
import cors from 'cors';
import { queryClasses, querySubjects, queryRooms, queryTeachers, queryAvailableDates, queryLatestDate, queryHolidays, queryPeriods, updateQueryResults } from './db.js';
import { query, parsedData } from './query/query.js';

config();

const app = express()
const port = process.env.API_PORT || 80;

app.use(cors())

app.get('/', (req, res) => {
    res.redirect('/swagger')
})

app.use("/swagger", express.static("docs/api/ui"))
app.use("/openapi.yaml", express.static("docs/api/openapi.yaml"))
app.use("/openapi.json", express.static("docs/api/openapi.json"))

app.get('/metadata/classes', async (req, res) => {
    try {
        const classes = await queryClasses();
        res.json(classes.map(c => ({ id: c.id.toString(), name: c.name })));
    } catch (error) {
        console.error((error as Error).message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/metadata/subjects', async (req, res) => {
    try {
        const subjects = await querySubjects();
        res.json(subjects.map(s => ({ id: s.id.toString(), short_name: s.short_name, long_name: s.long_name })));
    } catch (error) {
        console.log((error as Error).message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/metadata/rooms', async (req, res) => {
    try {
        const rooms = await queryRooms();
        res.json(rooms.map(r => ({ id: r.id.toString(), name: r.name, building: r.building, level: r.level, address: r.address })));
    } catch (error) {
        console.log((error as Error).message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/metadata/teachers', async (req, res) => {
    try {
        const teachers = await queryTeachers();
        res.json(teachers.map(t => ({ id: t.id.toString(), short_name: t.short_name })));
    } catch (error) {
        console.log((error as Error).message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/metadata/available-dates', async (req, res) => {
    try {
        const dates = await queryAvailableDates();
        res.json(dates);
    } catch (error) {
        console.log((error as Error).message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/metadata/latest-date', async (req, res) => {
    try {
        const date = await queryLatestDate();
        res.send(date);
    }
    catch (error) {
        console.log((error as Error).message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/metadata/holidays', async (req, res) => {
    try {
        const holidays = await queryHolidays();
        res.json(holidays.map(h => ({ id: h.id.toString(), name: h.name, start_date: h.start_date, end_date: h.end_date })));
    } catch (error) {
        console.log((error as Error).message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/metadata/periods', async (req, res) => {
    try {
        const periods = await queryPeriods();
        res.json(periods);
    } catch (error) {
        console.log((error as Error).message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/metadata/current-period', async (req, res) => {
    try {
        const period = await queryPeriods();
        const currentDate = new Date();
        const currentPeriod = period.find(p => {
            const startTimeDate = new Date().setHours(parseInt(p.start_time.split(':')[0]), parseInt(p.start_time.split(':')[1]), 0, 0);
            const endTimeDate = new Date().setHours(parseInt(p.end_time.split(':')[0]), parseInt(p.end_time.split(':')[1]), 0, 0);
            return currentDate.getTime() >= startTimeDate && currentDate.getTime() <= endTimeDate;
        });
        res.json(currentPeriod);
    } catch (error) {
        console.log((error as Error).message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/metadata/current-period/:timestamp', async (req, res) => {
    try {
        // 2023-10-05T10:15:00Z iso format timestamp
        const { timestamp } = req.params;
        const period = await queryPeriods();
        const date = new Date(timestamp);
        const currentPeriod = period.find(p => {
            const startTimeDate = new Date(date).setHours(parseInt(p.start_time.split(':')[0]), parseInt(p.start_time.split(':')[1]), 0, 0);
            const endTimeDate = new Date(date).setHours(parseInt(p.end_time.split(':')[0]), parseInt(p.end_time.split(':')[1]), 0, 0);
            return date.getTime() >= startTimeDate && date.getTime() <= endTimeDate;
        });
        res.json(currentPeriod);
    } catch (error) {
        console.log((error as Error).message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get("/query", async (req, res) => {
    try {
        if (Object.keys(req.query).length === 0) {
            var response: { [key: string]: parsedData } = {};
            for (const date of ["20251215", "20251216", "20251217", "20251218", "20251219"]) {
                let data = await query(date, false);
                await updateQueryResults(data);
                response[date] = data;
                data = await query(date, true);
                await updateQueryResults(data);
                response[date + "_teacher"] = data;
            }
            res.json(response);
        } else {
            var currentDate = new Date();
            const date = (req.query.date as string | undefined) || currentDate.toISOString().split('T')[0];
            const teacher = Object.keys(req.query).includes('teacher') ? true : false;
            const data = await query(date, teacher);
            await updateQueryResults(data);
            res.json(data);
        }
    } catch (error) {
        console.error((error as Error).message);
        console.log((error as Error).stack);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(port, () => {
    console.log(`App listening on port ${port}`)
})
