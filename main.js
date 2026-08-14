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
    const query = async (path) => await fetch(baseUrl + path, { headers: headers });
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
    if (!content.ok) {
        console.error(`Failed to fetch ${planType} plan: ${content.status} ${content.statusText}`);
        continue;
    }
    const parser = new DOMParser();
    let data = parser.parseFromString(await content.text(), "application/xml");
    // console.log(`Fetched ${planType} plan: ${data}`);
    var header = parseHeader(data.querySelector("Kopf") || data.querySelector("kopf"));
    var dataObj = parseOtherdata(data);
    var changes = parseChanges(data);
    var klausuren = parseKlausuren(data);
    var mainData = parseMainData(data);
    console.log(`Parsed ${planType} plan: ${JSON.stringify(mainData)}`);
    console.log(`Parsed ${planType} plan header: ${JSON.stringify(header)}`);
    console.log(`Parsed ${planType} plan other data: ${JSON.stringify(dataObj)}`);
    console.log(`Parsed ${planType} plan changes: ${JSON.stringify(changes)}`);
    console.log(`Parsed ${planType} plan klausuren: ${JSON.stringify(klausuren)}`);
}

function parseHeader(data) {
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


function parseOtherdata(data) {
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

function parseYYMMDD(dateString) {
    if (!dateString || dateString.length !== 6) return null;
    const year = parseInt(dateString.substring(0, 2), 10);
    const month = parseInt(dateString.substring(2, 4), 10);
    const day = parseInt(dateString.substring(4, 6), 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    return new Date(2000 + year, month - 1, day);
}

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

function parseKlausuren(data) {
    var klausuren = [];
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

function parseMainData(data) {
    var mainData = [];
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
                lehrer: kurs.querySelector("KKz").getAttribute("KLe") || null
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
        

function parseChanges(data) {
    var changes = [];
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