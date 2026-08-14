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

var date = "20260817";
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
    var dataObj = parseOtherdata(data);
    var changes = parseChanges(data);
    var klausuren = parseKlausuren(data);
    var mainData = parseMainData(data);
    
    outputData[planType] = {
        header: header,
        otherdata: dataObj,
        changes: changes,
        klausuren: klausuren,
        mainData: mainData
    };
}
console.log(JSON.stringify(outputData, null, 2));

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
 * @property {{datumvon: Date|null, datumbis: Date|null, swvon: string|null, swbis: string|null, tageprowoche: string|null}} basisdaten
 */
/**
 * 
 * @param {Element|Document|null} data
 * @returns {OtherData}
 */
function parseOtherdata(data) {
    /**
     * @type {OtherData}
     */
    var dataObj = {
        freietage: [],
        schulwochen: [],
        kalenderwochen: [],
        basisdaten: {
            datumvon: null,
            datumbis: null,
            swvon: null,
            swbis: null,
            tageprowoche: null
        },
    };
    if (!data) return dataObj;
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
 * @returns {Array<KlausurData>}
 */
function parseKlausuren(data) {
    /** @type {Array<KlausurData>} */
    var klausuren = [];
    if (!data) return klausuren;
    for (const klausur of data.querySelectorAll("klausuren > klausur, klausuren > Klausur")) {
        klausuren.push({
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
 * @returns {Array<MainData>}
 */
function parseMainData(data) {
    /** @type {Array<MainData>} */
    var mainData = [];
    if (!data) return mainData;
    for (const entity of data.querySelectorAll("Klassen > Kl, Lehrer > Le, Raeume > Ra")) {
        var plan = [];
        for (const std of entity.querySelectorAll("Pl > Std, pl > std")) {
            plan.push({
                woche: std.querySelector("PlSw")?.textContent || null,
                wochentyp: std.querySelector("PlWo")?.textContent || null,
                tag: std.querySelector("PlTg")?.textContent || null,
                stunde: std.querySelector("PlSt")?.textContent || std.querySelector("St")?.textContent || null,
                fach: std.querySelector("PlFa")?.textContent || std.querySelector("Fa")?.textContent || null,
                kurs: std.querySelector("PlKu")?.textContent || null,
                klasse: std.querySelector("PlKl")?.textContent || null,
                lehrer: std.querySelector("PlLe")?.textContent || std.querySelector("Le")?.textContent || null,
                raum: std.querySelector("PlRa")?.textContent || std.querySelector("Ra")?.textContent || null,
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
                tag: aufsicht.querySelector("AuTag")?.textContent || null,
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
            name: entity.querySelector("Kurz")?.textContent || null,
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
 * @property {string|null} stunde
 * @property {string|null} fach
 * @property {string|null} lehrer
 * @property {string|null} klasse
 * @property {string|null} vfach
 * @property {boolean} fachChanged
 * @property {string|null} vlehrer
 * @property {boolean} lehrerChanged
 * @property {string|null} vraum
 * @property {boolean} raumChanged
 * @property {string|null} info
 */
/**
 * 
 * @param {Element|Document|null} data
 * @returns {Array<changeData>}
 */
function parseChanges(data) {
    /** @type {Array<changeData>} */
    var changes = [];
    if (!data) return changes;
    for (const change of data.querySelectorAll("haupt > aktion")) {
        changes.push({
            stunde: change.querySelector("stunde")?.textContent || null,
            fach: change.querySelector("fach")?.textContent || null,
            lehrer: change.querySelector("lehrer")?.textContent || null,
            klasse: change.querySelector("klasse")?.textContent || null,
            vfach: change.querySelector("vfach")?.textContent || null,
            fachChanged: (change.querySelector("vfach") || change.querySelector("fach"))?.getAttribute("fageaendert") == "ae" || false,
            vlehrer: change.querySelector("vlehrer")?.textContent || null,
            lehrerChanged: (change.querySelector("vlehrer") || change.querySelector("lehrer"))?.getAttribute("legeaendert") == "ae" || false,
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

    for (const planType in data) {
        const planData = data[planType];
        combined.sourcesMetadata.push(planData.header);
        combined.changes.push(...planData.changes);
        combined.klausuren.push(...planData.klausuren);
        combined.dayData.push(...planData.mainData);
        combined.freietage.push(...planData.otherdata.freietage);
        combined.schulwochen.push(...planData.otherdata.schulwochen);
        combined.kalenderwochen.push(...planData.otherdata.kalenderwochen);
        combined.weeklyData.push(...planData.mainData);
        
        if (planData.otherdata.basisdaten && planData.otherdata.basisdaten.datumvon) {
            if (combined.basisdaten.datumvon !== null && planData.otherdata.basisdaten.datumvon != combined.basisdaten.datumvon) {
                console.warn(`Warning: Conflicting basisdaten.datumvon values: ${combined.basisdaten.datumvon} and ${planData.otherdata.basisdaten.datumvon}`);
            }
            combined.basisdaten = planData.otherdata.basisdaten;
        }
        if (planData.otherdata.basisdaten && planData.otherdata.basisdaten.datumbis) {
            if (combined.basisdaten.datumbis !== null && planData.otherdata.basisdaten.datumbis != combined.basisdaten.datumbis) {
                console.warn(`Warning: Conflicting basisdaten.datumbis values: ${combined.basisdaten.datumbis} and ${planData.otherdata.basisdaten.datumbis}`);
            }
            combined.basisdaten = planData.otherdata.basisdaten;
        }
        if (planData.otherdata.basisdaten && planData.otherdata.basisdaten.swvon) {
            if (combined.basisdaten.swvon !== null && planData.otherdata.basisdaten.swvon != combined.basisdaten.swvon) {
                console.warn(`Warning: Conflicting basisdaten.swvon values: ${combined.basisdaten.swvon} and ${planData.otherdata.basisdaten.swvon}`);
            }
            combined.basisdaten = planData.otherdata.basisdaten;
        }
        if (planData.otherdata.basisdaten && planData.otherdata.basisdaten.swbis) {
            if (combined.basisdaten.swbis !== null && planData.otherdata.basisdaten.swbis != combined.basisdaten.swbis) {
                console.warn(`Warning: Conflicting basisdaten.swbis values: ${combined.basisdaten.swbis} and ${planData.otherdata.basisdaten.swbis}`);
            }
            combined.basisdaten = planData.otherdata.basisdaten;
        }
        if (planData.otherdata.basisdaten && planData.otherdata.basisdaten.tageprowoche) {
            if (combined.basisdaten.tageprowoche !== null && planData.otherdata.basisdaten.tageprowoche != combined.basisdaten.tageprowoche) {
                console.warn(`Warning: Conflicting basisdaten.tageprowoche values: ${combined.basisdaten.tageprowoche} and ${planData.otherdata.basisdaten.tageprowoche}`);
            }
            combined.basisdaten = planData.otherdata.basisdaten;
        }
    }

    // Removing duplicate entries from freietage, schulwochen, and kalenderwochen
    combined.freietage = Array.from(new Set(combined.freietage.map(ft => JSON.stringify(ft)))).map(ft => JSON.parse(ft));
    combined.schulwochen = Array.from(new Set(combined.schulwochen.map(sw => JSON.stringify(sw)))).map(sw => JSON.parse(sw));
    combined.kalenderwochen = Array.from(new Set(combined.kalenderwochen.map(kw => JSON.stringify(kw)))).map(kw => JSON.parse(kw));

    // Removing duplicate entries from dayData and weeklyData based on name
    // Combining plan, stunden, kurse, unterricht, aufsichten, sperrungen, and planinfo for entries with the same name
    // But removing duplicates inside each of those arrays based on their unique identifiers:
    // plan: tag (weekly), stunde, fach, lehrer, klasse, kurs, raum, beginn and ende
    // stunden: stunde, beginn and ende
    // kurse: kuerzel and lehrer
    // unterricht: nummer, fach, gruppe and lehrer
    // aufsichten: tag, vorstunde, uhrzeit, zeit, ort, aenderung and fuer
    // sperrungen: tag, stunde
    // planinfo: tag, stunde and text
    

    // Removing duplicate entries from changes based on stunde, fach, lehrer, klasse, fachChanged, lehrerChanged and raumChanged
    combined.changes = Array.from(new Set(combined.changes.map(change => JSON.stringify(change)))).map(change => JSON.parse(change));

    // Removing duplicate entries from klausuren based on jahrgang, kurs, stunde, beginn and dauer
    combined.klausuren = Array.from(new Set(combined.klausuren.map(klausur => JSON.stringify(klausur)))).map(klausur => JSON.parse(klausur));

    return combined;
}