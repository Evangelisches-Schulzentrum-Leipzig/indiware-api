import { xml2js } from 'xml-js'
import { XmlFileSchema } from './xmlschema'

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

export async function query(date: string, teacher: boolean): Promise<parsedData> {
    if (teacher) {
        const headers = {
            'Authorization': 'Basic ' + Buffer.from('lehrer' + ':' + process.env.EVS_TEACH_PASSWORD, 'utf8').toString('base64')
        }
        var content = await fetch("https://stundenplan24.de/10040832/moble/mobdaten/PlanLe" + date + ".xml", { headers: headers});
    } else {
        const headers = {
            'Authorization': 'Basic ' + Buffer.from('schueler' + ':' + process.env.EVS_STUD_PASSWORD, 'utf8').toString('base64')
        }
        var content = await fetch("https://stundenplan24.de/10040832/mobil/mobdaten/PlanKl" + date + ".xml", { headers: headers});
    }
    if (content.status !== 200) {
        throw new Error(`failed to query PlanLe${date}.xml - ` + content.status)
    }
    var xml = await content.text();
    var data = parseXmlFile(xml);
    return data;
}

function parseXmlFile(file: string): parsedData {
    var parsed = xml2js(file, {
        compact: true,
        alwaysArray: true
    }) as XmlFileSchema;

    var teacherSwitch = parsed.VpMobil[0].Kopf[0].planart[0]._text[0] == "L";

    var holidayDays = parsed.VpMobil[0].FreieTage[0].ft.map(fd => fd._text[0] || '').filter(fd => fd !== '').map(fd => '20' + fd.slice(0, 2) + '-' + fd.slice(2, 4) + '-' + fd.slice(4, 6));

    // Donnerstag, 05. September 2019
    var planDate = parsed.VpMobil[0].Kopf[0].DatumPlan[0]._text[0] || '';
    var dateParts = planDate.split(', ')[1].split(' ');
    var day = dateParts[0].slice(0, 2).padStart(2, '0');
    var monthMap: {[key: string]: string} = {
        'Januar': '01',
        'Februar': '02',
        'März': '03',
        'April': '04',
        'Mai': '05',
        'Juni': '06',
        'Juli': '07',
        'August': '08',
        'September': '09',
        'Oktober': '10',
        'November': '11',
        'Dezember': '12'
    };
    var month = monthMap[dateParts[1]];
    var year = dateParts[2];
    var isoDate = new Date(year + '-' + month + '-' + day).toISOString().slice(0, 10);

    // 18.12.2025, 09:50
    var timeStamp = parsed.VpMobil[0].Kopf[0].zeitstempel[0]._text[0] || '';
    var date = timeStamp.split(', ')[0].split('.').map((part) => part.padStart(2, '0')).reverse().join('-');
    var time = timeStamp.split(', ')[1] + ":00";
    var isoTimestamp = new Date(date + 'T' + time).toISOString();

    var classes = parsed.VpMobil[0].Klassen[0].Kl.map(cl => cl.Kurz[0]._text[0] || '').filter(cn => cn !== '');

    var subjectsSet = new Set<string>();
    parsed.VpMobil[0].Klassen[0].Kl.forEach(cl => {
        cl.Pl?.[0].Std?.forEach(st => {
            var subjectName = st.Fa?.[0]._text?.[0] || '';
            if (subjectName !== '') {
                subjectsSet.add(subjectName);
            }
        });
    });
    var subjects = Array.from(subjectsSet);
    subjects.sort();

    var roomsSet = new Set<string>();
    parsed.VpMobil[0].Klassen[0].Kl.forEach(cl => {
        cl.Pl?.[0].Std?.forEach(st => {
            var roomName = st.Ra?.[0]._text?.[0] || '';
            if (roomName !== '' && roomName !== '---') {
                roomsSet.add(roomName);
            }
        });
    });
    var rooms = Array.from(roomsSet);
    rooms.sort();

    var teachersSet = new Set<string>();
    parsed.VpMobil[0].Klassen[0].Kl.forEach(cl => {
        cl.Pl?.[0].Std?.forEach(st => {
            var teacherName = st.Le?.[0]._text?.[0] || '';
            if (teacherName !== '') {
                teachersSet.add(teacherName);
            }
        });
    });
    var teachers = Array.from(teachersSet);
    teachers.sort();

    var periods: {number: number, start: string, end: string}[] = [];
    parsed.VpMobil[0].Klassen[0].Kl.forEach(cl => {
        cl.KlStunden?.[0].KlSt?.forEach(ks => {
            var periodName = parseInt(ks._text[0]) || 0;
            if (!periods.some(p => p.number === periodName && p.start === ks._attributes.ZeitVon && p.end === ks._attributes.ZeitBis)) {
                periods.push({ number: periodName, start: ks._attributes.ZeitVon, end: ks._attributes.ZeitBis });
            }
        });
    });

    // Switch classes and teachers if data is for teachers
    if (teacherSwitch) {
        var temp = classes;
        classes = teachers;
        teachers = temp;
    }   

    // group holiday days into ranges
    var holidayRanges: {start: string, end: string}[] = [];
    holidayDays.sort();
    for (var i = 0; i < holidayDays.length; ) {
        var start = holidayDays[i];
        var end = start;
        var j = i + 1;
        while (j < holidayDays.length) {
            var startDate = new Date(end);
            do {
                startDate.setDate(startDate.getDate() + 1);
            } while (startDate.getDay() === 0 || startDate.getDay() === 6); // skip weekends
            var nextDateStr = startDate.toISOString().slice(0, 10);
            if (holidayDays[j] === nextDateStr) {
                end = holidayDays[j];
                j++;
            } else {
                break;
            }
        }
        holidayRanges.push({ start: start, end: end });
        i = j;
    }

    // split classes into single classes
    // e.g. "10a,10b,10c" -> ["10a", "10b", "10c"], 
    // "10a-10c" -> ["10a", "10b", "10c"], 
    // "10a-10e,10s" -> ["10a", "10b", "10c", "10d", "10e", "10s"]
    var expandedClasses: string[] = [];
    classes.forEach(cn => {
        if (cn.includes(',')) {
            var parts = cn.split(',');
            parts.forEach(p => {
                if (p.includes('-')) {
                    var rangeParts = p.split('-').map(rp => rp.trim());
                    var prefix = rangeParts[0].slice(0, -1);
                    var startChar = rangeParts[0].slice(-1);
                    var endChar = rangeParts[1].slice(-1);
                    for (var ch = startChar.charCodeAt(0); ch <= endChar.charCodeAt(0); ch++) {
                        expandedClasses.push(prefix + String.fromCharCode(ch));
                    }
                } else {
                    expandedClasses.push(p.trim());
                }
            });
        } else if (cn.includes('-')) {
            var rangeParts = cn.split('-').map(rp => rp.trim());
            var prefix = rangeParts[0].slice(0, -1);
            var startChar = rangeParts[0].slice(-1);
            var endChar = rangeParts[1].slice(-1);
            for (var ch = startChar.charCodeAt(0); ch <= endChar.charCodeAt(0); ch++) {
                expandedClasses.push(prefix + String.fromCharCode(ch));
            }   
        } else {
            expandedClasses.push(cn.trim());
        }
    });
    expandedClasses = Array.from(new Set(expandedClasses)).sort(); // remove duplicates

    var plans = parsePlan(parsed.VpMobil[0].Klassen[0].Kl, teacherSwitch);
    plans.forEach(p => p.day = isoDate);
    plans.sort((a, b) => a.id - b.id);

    return {
        planType: parsed.VpMobil[0].Kopf[0].planart[0]._text[0],
        planDate: isoDate,
        timeStamp: isoTimestamp,
        classes: expandedClasses,
        subjects: subjects,
        rooms: rooms,
        teachers: teachers,
        periods: periods,
        holidayRanges: holidayRanges,
        plans: plans
    };
}

function parsePlan(klassen: XmlFileSchema["VpMobil"][0]["Klassen"][0]["Kl"], teacherSwitch: boolean): parsedData["plans"] {
    var output: parsedData["plans"] = [];
    klassen.forEach(cl => {
        var className = cl.Kurz[0]._text[0];
        var plan = cl.Pl?.[0];
        plan.Std?.forEach(st => {
            var period = parseInt(st.St[0]._text[0]) || 0;
            var subject = st.Fa?.[0]._text?.[0] || '';
            var subjectChanged = st.Fa?.[0] && '_attributes' in st.Fa[0] && st.Fa[0]._attributes?.FaAe === 'FaGeaendert';
            var teacher = st.Le?.[0]._text?.[0] || '';
            var teacherChanged = st.Le?.[0] && '_attributes' in st.Le[0] && st.Le[0]._attributes?.LeAe === 'LeGeaendert';
            var room = st.Ra?.[0]._text?.[0] || '';
            var roomChanged = st.Ra?.[0] && '_attributes' in st.Ra[0] && st.Ra[0]._attributes?.RaAe === 'RaGeaendert';
            var stdId = st.Nr ? parseInt(st.Nr[0]._text[0]) || 0 : 0;
            var changeDetails = ((subjectChanged || teacherChanged || roomChanged) &&  st.If[0]._text !== undefined ) ? st.If[0]._text[0] || '' : '';

            output.push({
                id: stdId,
                day: '', // to be filled later
                period: period,
                className: teacherSwitch ? teacher : className,
                classChanged: teacherSwitch ? teacherChanged : false,
                teacher: teacherSwitch ? className : teacher,
                teacherChanged: teacherSwitch ? false : teacherChanged,
                subject: subject,
                subjectChanged: subjectChanged,
                room: room,
                roomChanged: roomChanged,
                changeDetails: changeDetails
            });
        });
    });
    return output;
}