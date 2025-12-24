import { config } from 'dotenv';
import express from 'express';
import cors from 'cors';
import { queryClasses, updateQueryResults } from './db.js';
import { query } from './query/query.js';

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

app.get("/query", async (req, res) => {
    try {
        const data = await query();
        await updateQueryResults(data);
        res.json(data);
    } catch (error) {
        console.error((error as Error).message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(port, () => {
    console.log(`App listening on port ${port}`)
})
