// @ts-check

import dotenv from "dotenv";
dotenv.config({quiet: true});
import jsdom from "jsdom";
const { JSDOM } = jsdom;
const { window } = new JSDOM();
const { DOMParser } = window;

var types = [
    "VpMobil_Class",
    "VpMobil_Teacher",
    // "BasePlan_Class", // Not used in this school
    // "BasePlan_Teacher", // Not used in this school
    // "BasePlan_Room", // Not used in this school
    "Change_Class",
    "Change_Teacher",
    "WeeklyBase_Class",
    "WeeklyBase_Teacher",
    "WeeklyBase_Room",
    "WeeklySW_Class",
    "WeeklySW_Teacher",
    "WeeklySW_Room",
    "WeeklyChange_Class",
    "WeeklyChange_Teacher",
    "WeeklyChange_Room"
];

var date = "20260901";
var week = "35";
/**
 * @typedef {Object} OutputData
 * @property {Object<string, string|null>} header
 * @property {OtherData} otherdata
 * @property {Array<changeData>} changes
 * @property {Array<KlausurData>} klausuren
 * @property {Array<MainData>} mainData
 */
/** @type {Object<string, OutputData>} */
var outputData = {};
for (const planType of types) {
    const baseUrl = "https://stundenplan24.de/" + process.env['INDIWARE_SCHOOL_ID'] + "/";
    let headers;
    if (
        planType == "VpMobil_Class" ||
        planType == "BasePlan_Class" ||
        planType == "Change_Class" ||
        planType == "WeeklyBase_Class" ||
        planType == "WeeklySW_Class" ||
        planType == "WeeklyChange_Class"
    ) {
        headers = {
            'Authorization': 'Basic ' + Buffer.from('schueler' + ':' + process.env['EVS_STUD_PASSWORD'], 'utf8').toString('base64')
        } 
    } else {
        headers = {
            'Authorization': 'Basic ' + Buffer.from('lehrer' + ':' + process.env['EVS_TEACH_PASSWORD'], 'utf8').toString('base64')
        }
    }
    const query = async (/** @type {string} */ path) => await fetch(baseUrl + path, { headers: headers });
    let content;
    switch (planType) {
        case "VpMobil_Class":
            content = await query("mobil/mobdaten/PlanKl" + date + ".xml");
            break;
        case "VpMobil_Teacher":
            content = await query("moble/mobdaten/PlanLe" + date + ".xml");
            break;
        case "BasePlan_Class":
            content = await query("splan/sdaten/splank.xml");
            break;
        case "BasePlan_Teacher":
            content = await query("splan/sdaten/splanl.xml");
            break;
        case "BasePlan_Room":
            content = await query("splan/sdaten/splanr.xml");
            break;
        case "Change_Class":
            content = await query("vplan/vdaten/VplanKl" + date + ".xml");
            break;
        case "Change_Teacher":
            content = await query("vplanle/vdaten/VplanLe" + date + ".xml");
            break;
        case "WeeklyBase_Class":
            content = await query("wplan/wdatenk/SPlanKl_Basis.xml");
            break;
        case "WeeklyBase_Teacher":
            content = await query("wplan/wdatenl/SPlanLe_Basis.xml");
            break;
        case "WeeklyBase_Room":
            content = await query("wplan/wdatenr/SPlanRa_Basis.xml");
            break;
        case "WeeklySW_Class":
            content = await query("wplan/wdatenk/SPlanKl_Sw" + week + ".xml");
            break;
        case "WeeklySW_Teacher":
            content = await query("wplan/wdatenl/SPlanLe_Sw" + week + ".xml");
            break;
        case "WeeklySW_Room":
            content = await query("wplan/wdatenr/SPlanRa_Sw" + week + ".xml");
            break;
        case "WeeklyChange_Class":
            content = await query("wplan/wdatenk/WPlanKl_" + date + ".xml");
            break;
        case "WeeklyChange_Teacher":
            content = await query("wplan/wdatenl/WPlanLe_" + date + ".xml");
            break;
        case "WeeklyChange_Room":
            content = await query("wplan/wdatenr/WPlanRa_" + date + ".xml");
            break;
    }
    if (!content || !content.ok) {
        console.error(`Failed to fetch ${planType} plan: ${content ? content.status + " " + content.statusText : "No content"}`);
        continue;
    }
    const parser = new DOMParser();
    let data = parser.parseFromString(await content.text(), "application/xml");
    var header = parseHeader(data.querySelector("Kopf") || data.querySelector("kopf"));
    var dataObj = parseOtherdata(data, planType);
    var changes = parseChanges(data, planType);
    var klausuren = parseKlausuren(data, planType);
    var mainData = parseMainData(data, planType);
    
    outputData[planType] = {
        header: header,
        otherdata: dataObj,
        changes: changes,
        klausuren: klausuren,
        mainData: mainData
    };
}
console.log(JSON.stringify(combineData(outputData), null, 2));

/**
 * 
 * @param {Element|Document|null} data 
 * @returns {Object<string, string|null>}
 */
function parseHeader(data) {
    if (!data) return {};
    return {
        abwesendlehrer: data.querySelector("abwesendl")?.textContent || null,
        aenderungklassen: data.querySelector("aenderungk")?.textContent || null,
        aenderunglehrer: data.querySelector("aenderungl")?.textContent || null,
        datei: data.querySelector("datei")?.textContent || null,
        datum: data.querySelector("datum")?.textContent || data.querySelector("DatumPlan")?.textContent || null,
        gueltigab: data.querySelector("gueltigab")?.textContent || null,
        nativ: data.querySelector("nativ")?.textContent || null,
        planart: data.querySelector("planart")?.textContent || data.querySelector("PlanArt")?.textContent || null,
        schulname: data.querySelector("schulname")?.textContent || null,
        schulort: data.querySelector("schulort")?.textContent || null,
        schulnummer: data.querySelector("schulnummer")?.textContent || null,
        tageprowoche: data.querySelector("tageprowoche")?.textContent || null,
        titel: data.querySelector("titel")?.textContent || null,
        woche: data.querySelector("woche")?.textContent || null,
        upname: data.querySelector("upname")?.textContent || null,
        upmodul: data.querySelector("upmodul")?.textContent || null,
        upversion: data.querySelector("upversion")?.textContent || null,
        zeitstempel: data.querySelector("zeitstempel")?.textContent || null
    }
}

/**
 * @typedef {Object} OtherData
 * @property {Array<{value: string, date: Date|null, feiertag: boolean}>} freietage
 * @property {Array<{number: string, kw: string|null, weektype: string|null, datumvon: Date|null, datumbis: Date|null}>} schulwochen
 * @property {Array<{number: string, kw: string|null, weektype: string|null, datumvon: Date|null, datumbis: Date|null}>} kalenderwochen
 * @property {Array<{sourcePlanType: string|null, rawText: string}>} aufsichten
 * @property {{datumvon: Date|null, datumbis: Date|null, swvon: string|null, swbis: string|null, tageprowoche: string|null}} basisdaten
 */
/**
 * 
 * @param {Element|Document|null} data
 * @param {string|null} sourcePlanType
 * @returns {OtherData}
 */
function parseOtherdata(data, sourcePlanType = null) {
    /**
     * @type {OtherData}
     */
    var dataObj = {
        freietage: [],
        schulwochen: [],
        kalenderwochen: [],
        aufsichten: [],
        basisdaten: {
            datumvon: null,
            datumbis: null,
            swvon: null,
            swbis: null,
            tageprowoche: null
        },
    };
    if (!data) return dataObj;
    for (const line of data.querySelectorAll("aufsichten > aufsichtzeile, Aufsichten > Aufsichtzeile")) {
        const rawText = line.querySelector("aufsichtinfo")?.textContent?.trim() || line.textContent?.trim() || "";
        if (rawText) dataObj.aufsichten.push({sourcePlanType: sourcePlanType, rawText: rawText});
    }
    if (data.querySelector("FreieTage") || data.querySelector("freietage")) {
        var freietage = data.querySelectorAll("FreieTage > ft, freietage > ft");
        freietage.forEach(tag => {
            if (!tag.textContent) return;
            dataObj.freietage.push({value: tag.textContent, date: parseYYMMDD(tag.textContent), feiertag: tag.getAttribute("feier") == "1" || false});
        });
    }
    if (data.querySelector("Schulwochen") || data.querySelector("schulwochen")) {
        var schulwochen = data.querySelectorAll("Schulwochen > Sw, schulwochen > Sw");
        schulwochen.forEach(sw => {
            if (!sw.textContent) return;
            dataObj.schulwochen.push({
                number: sw.textContent,
                kw: sw.getAttribute("SwKw") || null,
                weektype: sw.getAttribute("SwWo") || sw.getAttribute("SwDatum") || null,
                datumvon: parseddDmmDyyyy(sw.getAttribute("SwDatumVon") || null),
                datumbis: parseddDmmDyyyy(sw.getAttribute("SwDatumBis") || null)
            });
        });
    }
    if (data.querySelector("Kalenderwochen") || data.querySelector("kalenderwochen")) {
        var kalenderwochen = data.querySelectorAll("Kalenderwochen > Kw, kalenderwochen > Kw");
        kalenderwochen.forEach(kw => {
            if (!kw.textContent) return;
            dataObj.kalenderwochen.push({
                number: kw.textContent,
                kw: kw.getAttribute("KwNr") || null,
                weektype: kw.getAttribute("KwWoche") || null,
                datumvon: parseddDmmDyyyy(kw.getAttribute("KwDatumVon") || null),
                datumbis: parseddDmmDyyyy(kw.getAttribute("KwDatumBis") || null)
            });
        });
    }
    if (data.querySelector("Basisdaten") || data.querySelector("basisdaten")) {
        var basisdaten = data.querySelector("Basisdaten, basisdaten");
        if (basisdaten) {
            dataObj.basisdaten = {
                datumvon: parseddDmmDyyyy(basisdaten.querySelector("BaDatumVon")?.textContent || null),
                datumbis: parseddDmmDyyyy(basisdaten.querySelector("BaDatumBis")?.textContent || null),
                swvon: basisdaten.querySelector("BaSwVon")?.textContent || null,
                swbis: basisdaten.querySelector("BaSwBis")?.textContent || null,
                tageprowoche: basisdaten.querySelector("BaTageProWoche")?.textContent || null
            };
        }
    }
    return dataObj;
}

/**
 * @param {string|null} dateString 
 * @returns {Date|null}
 */
function parseYYMMDD(dateString) {
    if (!dateString || dateString.length !== 6) return null;
    const year = parseInt(dateString.substring(0, 2), 10);
    const month = parseInt(dateString.substring(2, 4), 10);
    const day = parseInt(dateString.substring(4, 6), 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    return new Date(2000 + year, month - 1, day);
}

/**
 * 
 * @param {string|null} dateString 
 * @returns {Date|null}
 */
function parseddDmmDyyyy(dateString) {
    // dd.mm.yyyy
    if (!dateString || dateString.length !== 10) return null;
    const parts = dateString.split(".");
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    return new Date(year, month - 1, day);
}

/**
 * @typedef {Object} KlausurData
 * @property {string|null} sourcePlanType
 * @property {string|null} jahrgang
 * @property {string|null} kurs
 * @property {string|null} kursleiter
 * @property {string|null} stunde
 * @property {string|null} beginn
 * @property {string|null} dauer
 * @property {string|null} kinfo
 */
/**
 * 
 * @param {Element|Document|null} data
 * @param {string|null} sourcePlanType
 * @returns {Array<KlausurData>}
 */
function parseKlausuren(data, sourcePlanType = null) {
    /** @type {Array<KlausurData>} */
    var klausuren = [];
    if (!data) return klausuren;
    for (const klausur of data.querySelectorAll("klausuren > klausur, klausuren > Klausur")) {
        klausuren.push({
            sourcePlanType: sourcePlanType,
            jahrgang: klausur.querySelector("jahrgang")?.textContent || null,
            kurs: klausur.querySelector("kurs")?.textContent || null,
            kursleiter: klausur.querySelector("kursleiter")?.textContent || null,
            stunde: klausur.querySelector("stunde")?.textContent || null,
            beginn: klausur.querySelector("beginn")?.textContent || null,
            dauer: klausur.querySelector("dauer")?.textContent || null,
            kinfo: klausur.querySelector("kinfo")?.textContent || null
        });
    }
    return klausuren;
}

/**
 * @typedef {Object} MainData
 * @property {string|null} name
 * @property {"CLASS"|"TEACHER"|"ROOM"} entityType
 * @property {string|null} sourcePlanType
 * @property {Array<{woche: string|null, wochentyp: string|null, tag: string|null, stunde: string|null, fach: string|null, kurs: string|null, klasse: string|null, lehrer: string|null, raum: string|null, beginn: string|null, ende: string|null, nummer: string|null, info: string|null}>} plan
 * @property {Array<{stunde: string|null, beginn: string|null, ende: string|null}>} stunden
 * @property {Array<{kuerzel: string|null, lehrer: string|null}>} kurse
 * @property {Array<{nummer: string|null, fach: string|null, gruppe: string|null, lehrer: string|null}>} unterricht
 * @property {Array<{aenderung: string|null, tag: string|null, vorstunde: string|null, uhrzeit: string|null, zeit: string|null, ort: string|null, fuer: string|null, info: string|null}>} aufsichten
 * @property {Array<{tag: string|null, stunde: string|null}>} sperrungen
 * @property {Array<{text: string|null, tag: string|null, stunde: string|null}>} planinfo
 */
/**
 * 
 * @param {Element|Document|null} data
 * @param {string|null} planType
 * @returns {Array<MainData>}
 */
function parseMainData(data, planType = null) {
    /** @type {Array<MainData>} */
    var mainData = [];
    if (!data) return mainData;
    for (const entity of data.querySelectorAll("Klassen > Kl, Lehrer > Le, Raeume > Ra")) {
        if (!entity) continue;
        if (!entity.querySelector("Kurz")) continue;
        var entityType = /** @type {"CLASS"|"TEACHER"|"ROOM"} */ (planType?.endsWith("_Teacher") ? "TEACHER" : planType?.endsWith("_Room") ? "ROOM" : entity.tagName == "Kl" ? "CLASS" : entity.tagName == "Le" ? "TEACHER" : "ROOM");
        var entityName = entity.querySelector("Kurz")?.textContent || null;
        var klasse = null;
        var lehrer = null;
        var raum = null;
        if (entityType == "CLASS") klasse = entityName;
        else if (entityType == "TEACHER") lehrer = entityName;
        else raum = entityName;
        if (!entityName) continue;
        var plan = [];
        for (const std of entity.querySelectorAll("Pl > Std, pl > std")) {
            var planClass = std.querySelector("PlKl")?.textContent || (planType == "VpMobil_Teacher" ? std.querySelector("Le")?.textContent : null) || (entityType == "CLASS" ? klasse : null);
            var planTeacher = planType?.endsWith("_Teacher") ? lehrer : std.querySelector("PlLe")?.textContent || std.querySelector("Le")?.textContent || (entityType == "TEACHER" ? lehrer : null);
            var planRoom = std.querySelector("PlRa")?.textContent || std.querySelector("Ra")?.textContent || (entityType == "ROOM" ? raum : null);
            plan.push({
                woche: std.querySelector("PlSw")?.textContent || null,
                wochentyp: std.querySelector("PlWo")?.textContent || null,
                tag: std.querySelector("PlTg")?.textContent || null,
                stunde: std.querySelector("PlSt")?.textContent || std.querySelector("St")?.textContent || null,
                fach: std.querySelector("PlFa")?.textContent || std.querySelector("Fa")?.textContent || null,
                kurs: std.querySelector("PlKu")?.textContent || null,
                klasse: planClass,
                lehrer: planTeacher,
                raum: planRoom,
                beginn: std.querySelector("Beginn")?.textContent || null,
                ende: std.querySelector("Ende")?.textContent || null,
                nummer: std.querySelector("Nr")?.textContent || null,
                info: std.querySelector("If")?.textContent || null
            });
        }
        var stunden = [];
        for (const std of entity.querySelectorAll("Stunden > St, KlStunden > KlSt")) {
            stunden.push({
                stunde: std.textContent || null,
                beginn: std.getAttribute("StZeit") || null,
                ende: std.getAttribute("StZeitBis") || null
            });
        }
        var kurse = [];
        for (const kurs of entity.querySelectorAll("Kurse > Ku, kurse > Ku")) {
            kurse.push({
                kuerzel: kurs.querySelector("KKz")?.textContent || null,
                lehrer: kurs.querySelector("KKz")?.getAttribute("KLe") || null
            });
        }
        var unterricht = [];
        for (const ue of entity.querySelectorAll("Unterricht > Ue > UeNr, unterricht > Ue > UeNr")) {
            unterricht.push({
                nummer: ue.textContent || null,
                fach: ue.getAttribute("UeFa") || null,
                gruppe: ue.getAttribute("UeGr") || null,
                lehrer: ue.getAttribute("UeLe") || null
            });
        }
        var aufsichten = [];
        for (const aufsicht of entity.querySelectorAll("Aufsichten > Aufsicht, aufsichten > Aufsicht")) {
            aufsichten.push({
                aenderung: aufsicht.getAttribute("AuAe") || null,
                tag: aufsicht.querySelector("AuTag")?.textContent || aufsicht.querySelector("AuTg")?.textContent || null,
                vorstunde: aufsicht.querySelector("AuVorStunde")?.textContent || null,
                uhrzeit: aufsicht.querySelector("AuUhrzeit")?.textContent || null,
                zeit: aufsicht.querySelector("AuZeit")?.textContent || null,
                ort: aufsicht.querySelector("AuOrt")?.textContent || null,
                fuer: aufsicht.querySelector("AuFuer")?.textContent || null,
                info: aufsicht.querySelector("AuInfo")?.textContent || null
            });
        }
        var sperrungen = [];
        for (const sperrung of entity.querySelectorAll("Sperrungen > Sp, sperrungen > Sp")) {
            sperrungen.push({
                tag: sperrung.getAttribute("SpTg") || null,
                stunde: sperrung.getAttribute("SpSt") || null
            });
        }
        var planinfo = [];
        for (const pi of entity.querySelectorAll("Planinfo > Pi, planinfo > Pi")) {
            planinfo.push({
                text: pi.textContent || null,
                tag: pi.getAttribute("PiTg") || null,
                stunde: pi.getAttribute("PiSt") || null
            });
        }
        mainData.push({
            name: entityName,
            entityType: entityType,
            sourcePlanType: planType,
            plan: plan,
            stunden: stunden,
            kurse: kurse,
            unterricht: unterricht,
            aufsichten: aufsichten,
            sperrungen: sperrungen,
            planinfo: planinfo
        });
    }
    return mainData;
}
       
/**
 * @typedef {Object} changeData
 * @property {string|null} sourcePlanType
 * @property {string|null} stunde
 * @property {string|null} fach
 * @property {string|null} lehrer
 * @property {string|null} klasse
 * @property {string|null} vfach
 * @property {boolean} fachChanged
 * @property {string|null} vlehrer
 * @property {boolean} lehrerChanged
 * @property {string|null} raum
 * @property {string|null} vraum
 * @property {boolean} raumChanged
 * @property {string|null} info
 */
/**
 * 
 * @param {Element|Document|null} data
 * @param {string|null} sourcePlanType
 * @returns {Array<changeData>}
 */
function parseChanges(data, sourcePlanType = null) {
    /** @type {Array<changeData>} */
    var changes = [];
    if (!data) return changes;
    for (const change of data.querySelectorAll("haupt > aktion")) {
        changes.push({
            sourcePlanType: sourcePlanType,
            stunde: change.querySelector("stunde")?.textContent || null,
            fach: change.querySelector("fach")?.textContent || null,
            lehrer: change.querySelector("lehrer")?.textContent || null,
            klasse: change.querySelector("klasse")?.textContent || null,
            vfach: change.querySelector("vfach")?.textContent || null,
            fachChanged: (change.querySelector("vfach") || change.querySelector("fach"))?.getAttribute("fageaendert") == "ae" || false,
            vlehrer: change.querySelector("vlehrer")?.textContent || null,
            lehrerChanged: (change.querySelector("vlehrer") || change.querySelector("lehrer"))?.getAttribute("legeaendert") == "ae" || false,
            raum: change.querySelector("raum")?.textContent || null,
            vraum: change.querySelector("vraum")?.textContent || null,
            raumChanged: (change.querySelector("vraum") || change.querySelector("raum"))?.getAttribute("rageaendert") == "ae" || false,
            info: change.querySelector("info")?.textContent || null
        });
    }
    return changes;
}

/**
 * @typedef {Object} CombinedData
 * @property {Array<Object<string, string|null>>} sourcesMetadata
 * @property {Array<changeData>} changes
 * @property {Array<KlausurData>} klausuren
 * @property {Array<MainData>} dayData
 * @property {Array<{sourcePlanType: string|null, rawText: string}>} aufsichten
 * @property {Array<{value: string, date: Date|null, feiertag: boolean}>} freietage
 * @property {Array<{number: string, kw: string|null, weektype: string|null, datumvon: Date|null, datumbis: Date|null}>} schulwochen
 * @property {Array<{number: string, kw: string|null, weektype: string|null, datumvon: Date|null, datumbis: Date|null}>} kalenderwochen
 * @property {Array<MainData>} weeklyData
 * @property {{datumvon: Date|null, datumbis: Date|null, swvon: string|null, swbis: string|null, tageprowoche: string|null}} basisdaten
 */
/**
 * 
 * @param {Object<string, OutputData>} data 
 * @returns {CombinedData}
 */
function combineData(data) {
    /** @type {CombinedData} */
    var combined = {
        sourcesMetadata: [],
        changes: [],
        klausuren: [],
        dayData: [],
        aufsichten: [],
        freietage: [],
        schulwochen: [],
        kalenderwochen: [],
        weeklyData: [],
        basisdaten: {
            datumvon: null,
            datumbis: null,
            swvon: null,
            swbis: null,
            tageprowoche: null
        }
    };

    for (const planType of Object.keys(data)) {
        const planData = data[planType];

        // Combine source headers, changes, exams, holidays, school weeks, and calendar weeks
        // by appending the corresponding arrays from every successfully fetched source.
        combined.sourcesMetadata.push({...planData.header, planType: planType});
        combined.changes.push(...planData.changes);
        combined.klausuren.push(...planData.klausuren);
        combined.freietage.push(...planData.otherdata.freietage);
        combined.schulwochen.push(...planData.otherdata.schulwochen);
        combined.kalenderwochen.push(...planData.otherdata.kalenderwochen);
        combined.aufsichten.push(...planData.otherdata.aufsichten);

        // Basisdaten are combined field by field. The first non-null value wins;
        // later different values are reported because sources can describe different plan ranges.
        const sourceBasisdaten = planData.otherdata.basisdaten;
        const basisFields = /** @type {Array<"datumvon"|"datumbis"|"swvon"|"swbis"|"tageprowoche">} */ (["datumvon", "datumbis", "swvon", "swbis", "tageprowoche"]);
        for (const field of basisFields) {
            const value = sourceBasisdaten[field];
            if (value === null) continue;
            if (combined.basisdaten[field] !== null && !sameValue(combined.basisdaten[field], value)) {
                console.warn(`Warning: Conflicting basisdaten.${field} values: ${combined.basisdaten[field]} and ${value}`);
            }
            if (combined.basisdaten[field] === null) {
                Object.assign(combined.basisdaten, {[field]: value});
            }
        }

        // Weekly sources populate weeklyData. Mobile and base sources populate dayData;
        // change sources are represented through combined.changes instead of mainData.
        if (planType.startsWith("Weekly")) {
            combined.weeklyData.push(...planData.mainData);
        } else if (planType.startsWith("VpMobil") || planType.startsWith("BasePlan")) {
            combined.dayData.push(...planData.mainData);
        }
    }

    // Remove duplicate holidays using value, parsed date, and holiday flag.
    combined.freietage = uniqueBy(combined.freietage, ["value", "date", "feiertag"]);

    // Remove duplicate school weeks and calendar weeks using their complete identity.
    combined.schulwochen = uniqueBy(combined.schulwochen, ["number", "kw", "weektype", "datumvon", "datumbis"]);
    combined.kalenderwochen = uniqueBy(combined.kalenderwochen, ["number", "kw", "weektype", "datumvon", "datumbis"]);

    // Merge entries with the same entity name and deduplicate each nested collection.
    combined.dayData = combineMainData(combined.dayData);
    combined.weeklyData = combineMainData(combined.weeklyData);

    // Changes are unique by their lesson and changed-field values.
    combined.changes = uniqueBy(combined.changes, ["sourcePlanType", "stunde", "fach", "lehrer", "klasse", "vfach", "vlehrer", "raum", "vraum", "fachChanged", "lehrerChanged", "raumChanged", "info"]);

    // Exams are unique by year group, course, period, start time, and duration.
    combined.klausuren = uniqueBy(combined.klausuren, ["jahrgang", "kurs", "stunde", "beginn", "dauer"]);

    return combined;
}

/**
 * @template T
 * @param {Array<T>} values
 * @param {Array<keyof T>} fields
 * @returns {Array<T>}
 */
function uniqueBy(values, fields) {
    const seen = new Set();
    return values.filter(value => {
            const key = fields.map(field => serializeKeyValue(value[field])).join("\u001f");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * @param {any} value
 * @returns {string}
 */
function serializeKeyValue(value) {
    return value instanceof Date ? String(value.getTime()) : JSON.stringify(value);
}

/**
 * @param {any} left
 * @param {any} right
 * @returns {boolean}
 */
function sameValue(left, right) {
    if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime();
    return left === right;
}

/**
 * @param {Array<MainData>} entries
 * @returns {Array<MainData>}
 */
function combineMainData(entries) {
    /** @type {Map<string, MainData>} */
    const byName = new Map();
    for (const entry of entries) {
        // Entries with the same entity name share one output object; all nested arrays
        // are appended first and deduplicated below using their domain-specific keys.
        const key = `${entry.sourcePlanType ?? ""}\u001f${entry.entityType}\u001f${entry.name === null ? "" : entry.name}`;
        let target = byName.get(key);
        if (!target) {
            target = {
                name: entry.name,
            entityType: entry.entityType,
                sourcePlanType: entry.sourcePlanType,
                plan: [],
                stunden: [],
                kurse: [],
                unterricht: [],
                aufsichten: [],
                sperrungen: [],
                planinfo: []
            };
            byName.set(key, target);
        }
        target.plan.push(...entry.plan);
        target.stunden.push(...entry.stunden);
        target.kurse.push(...entry.kurse);
        target.unterricht.push(...entry.unterricht);
        target.aufsichten.push(...entry.aufsichten);
        target.sperrungen.push(...entry.sperrungen);
        target.planinfo.push(...entry.planinfo);
    }

    return Array.from(byName.values()).map(entry => ({
        name: entry.name,
        entityType: entry.entityType,
        sourcePlanType: entry.sourcePlanType,
        // A plan row is identified by its week/day/period and lesson details.
        plan: uniqueBy(entry.plan, ["woche", "wochentyp", "tag", "stunde", "fach", "lehrer", "klasse", "kurs", "raum", "beginn", "ende", "nummer", "info"]),
        // Period definitions, courses, lessons, supervision, blocked periods, and notes
        // each use the fields that distinguish one record in the Indiware XML.
        stunden: uniqueBy(entry.stunden, ["stunde", "beginn", "ende"]),
        kurse: uniqueBy(entry.kurse, ["kuerzel", "lehrer"]),
        unterricht: uniqueBy(entry.unterricht, ["nummer", "fach", "gruppe", "lehrer"]),
        aufsichten: uniqueBy(entry.aufsichten, ["tag", "vorstunde", "uhrzeit", "zeit", "ort", "aenderung", "fuer", "info"]),
        sperrungen: uniqueBy(entry.sperrungen, ["tag", "stunde"]),
        planinfo: uniqueBy(entry.planinfo, ["tag", "stunde", "text"])
    }));
}