interface XmlTextElement {
    _text: [string]
}

type Empty = Record<string, never>

// shared interfaces
interface XmlElementWithAttribute<T> {
    _attributes: T
    _text: [string]
}

interface XmlDeclaration {
    _attributes: {
        version: string
        encoding: 'utf-8' | 'UTF-8'
    }
}

interface FreieTage {
    ft: Array<{
        _attributes?: {
            feier: string // reason for holiday
        }
        _text: [string]
    }>
}

interface TimeSlotAttribute {
    StZeit: string // HH:MM
    StZeitBis: string // HH:MM
}

interface TimeRangeAttribute {
    ZeitVon: string
    ZeitBis: string
}

interface CoordinateAttribute {
    // Attributes vary based on context; typically include fa/le/ra identifiers
    [key: string]: string
}

interface InfoCoordinateAttribute extends CoordinateAttribute {
    // Extension for info-specific coordinates
}

interface CoordinateElement {
    _attributes: CoordinateAttribute
}

interface InfoCoordinateElement {
    _attributes: InfoCoordinateAttribute
    _text: [string]
}

// Common header interfaces for daily plan types
interface PlanKopf {
    PlanArt: [XmlTextElement]
    zeitstempel: [XmlTextElement] // dd.mm.YYYY, hh:mm
    datei: [XmlTextElement]
    schulname?: [XmlTextElement]      // BasePlan only
    schulort?: [XmlTextElement]       // BasePlan + WeekBase
    gueltigab?: [XmlTextElement]      // BasePlan only: dd.mm.YYYY
    upname: [XmlTextElement]
    upmodul: [XmlTextElement]
    upversion: [XmlTextElement]
}

interface ChangePlanKopf {
    datei: [XmlTextElement]
    titel: [XmlTextElement]
    schulname: [XmlTextElement]
    datum: [XmlTextElement] // dd.mm.YYYY, hh:mm
    kopfinfo: [{
        abwesendl: [XmlTextElement]
        aenderungl: [XmlTextElement]
        aenderungk: [XmlTextElement]
    }]
}

interface VpMobilKopf {
    planart: [XmlTextElement]
    zeitstempel: [XmlTextElement] // 04.09.2019, 09:40
    DatumPlan: [XmlTextElement]   // Donnerstag, 05. September 2019
    datei: [XmlTextElement]
    nativ: [XmlTextElement]
    woche?: [XmlTextElement]
    tageprowoche?: [XmlTextElement]
    schulnummer?: [Empty]
}

interface BasePlanKalenderwochen {
    KwNr: string
    KwDatumVon: string // YYMMDD
    KwDatumBis: string // YYMMDD
    KwWoche: string // "A-Woche" or "B-Woche"
}

interface BasePlanSchulwochen {
    SwKw: string  // calendar week number
    SwDatum: string // "A-Woche" or "B-Woche"
}

interface BasePlanLessonEntry {
    PlSw: [XmlTextElement]  // school week number -> Reference to Schulwochen
    PlTg: [XmlTextElement]  // day of the week
    PlSt: [XmlTextElement]  // lesson number
    PlFa: [XmlTextElement]  // subject
    PlKl: [XmlTextElement]  // class name
    PlLe: [XmlTextElement]  // teacher
    PlRa: [XmlTextElement]  // room
    PlWo: [XmlTextElement]  // week type ("A", "B" or &nbsp;)
}

interface BasePlanEntityBase {
    Kurz: [XmlTextElement]
    Stunden: [{
        St: Array<XmlElementWithAttribute<TimeSlotAttribute> & { _text: [string] }>
    }]
    Sperrungen: [{
        Sp: Array<CoordinateElement>
    }]
    Planinfo?: [{
        Pi: Array<InfoCoordinateElement>
    }]
    Pl: [{
        Std: Array<BasePlanLessonEntry>
    }]
}

interface BasePlanSchemaBase {
    _declaration: XmlDeclaration
    splan: [{
        Kopf: [PlanKopf]
        FreieTage: [FreieTage]
        Kalenderwochen: [{
            Kw: Array<XmlElementWithAttribute<BasePlanKalenderwochen> & { _text: [string] }>
        }]
        Schulwochen: [{
            Sw: Array<XmlElementWithAttribute<BasePlanSchulwochen> & { _text: [string] }>
        }]
    }]
}

interface ChangePlanKlausur {
    jahrgang: [XmlTextElement]
    kurs: [XmlTextElement]
    kursleiter: [XmlTextElement | Record<string, never>]
    stunde: [XmlTextElement]
    beginn: [XmlTextElement]
    dauer: [XmlTextElement]
    kinfo: [Empty | XmlTextElement]
}

interface ChangedField {
    _attributes: {
        [key in 'fageaendert' | 'leaeaendert' | 'raeaendert']?: string
    }
    _text: [string]
}

interface VpMobilChangedField {
    _text?: [string | '---' | '&nbsp;']
    _attributes: {
        FaAe?: 'FaGeaendert'
        LeAe?: 'LeGeaendert'
        RaAe?: 'RaGeaendert'
    }
}

interface ChangePlanClassAktion {
    klasse: [XmlTextElement]
    stunde: [XmlTextElement]
    fach: [ChangedField]
    lehrer: [ChangedField]
    raum: [ChangedField]
    info: [XmlTextElement]
}

interface ChangePlanTeacherAktion {
    stunde: [XmlTextElement]
    fach: [XmlTextElement]
    lehrer: [XmlTextElement]
    klasse: [XmlTextElement]
    vfach: [ChangedField]
    vlehrer: [ChangedField]
    vraum: [ChangedField]
    info: [XmlTextElement]
}

interface VpMobilKurs {
    KKz: [{
        _attributes: {
            KLe: string         // teacher name
        },
        _text: [string]       // actual course name
    }]
}

interface VpMobilUnterricht {
    UeNr: [{
        _attributes: {
            UeLe: string
            UeFa: string
            UeGr?: string         // related to the course
        }
        _text: [string]         // unknown what this is for
    }]
}

interface VpMobilLessonSlot {
    St: [XmlTextElement]  // lesson number or period
    Fa: [XmlTextElement | VpMobilChangedField | Empty]  // subject
    Le: [XmlTextElement | VpMobilChangedField | Empty]  // teacher
    Ra: [XmlTextElement | VpMobilChangedField | Empty]  // room
    Nr: [XmlTextElement]  // lesson ID (not optional)
    If: [Empty | XmlTextElement] // additional info about changes
    Beginn: [XmlTextElement | Empty]  // start time HH:mm
    Ende: [XmlTextElement | Empty]    // end time HH:mm
    Ku2?: [XmlTextElement]  // course
}

interface VpMobilAufsicht {
    _attributes?: {
        AuAe: 'AuVertretung' | 'AuAusfall' | 'AuGeaendert'
    }
    AuTag: [XmlTextElement]
    AuVorStunde: [XmlTextElement]
    AuUhrzeit: [XmlTextElement]
    AuZeit: [XmlTextElement]
    AuOrt: [XmlTextElement]
    AuInfo?: [XmlTextElement]
    AuFuer?: [XmlTextElement]
}

interface WeekBaseSchulwochen {
    SwKw: string  // calendar week number
    SwDatumVon: string  // start date dd.mm.YYYY
    SwDatumBis: string  // end date dd.mm.YYYY
    SwWo: string  // week type ("A" or "B")
}

interface WeekBaseEntity {
    Kurz: [XmlTextElement]
    Hash?: [{/* note: there was no case yet where this was set */ }]
}

interface VpMobilKlasse {
    Kurz: [XmlTextElement]
    Kurse?: [{
        Ku?: Array<VpMobilKurs>
    }]
    Hash?: [{/* note: there was no case yet where this was set */ }]
    Unterricht?: [{
        Ue?: Array<VpMobilUnterricht>
    }]
    Pl: [{
        Std?: Array<VpMobilLessonSlot>
    }]
    Klausuren?: [{
        Klausur: Array<ChangePlanKlausur>
    }]
    Aufsichten?: [
        Empty | {
            Aufsicht: Array<VpMobilAufsicht>
        }
    ]
    KlStunden?: [{
        KlSt: Array<XmlElementWithAttribute<TimeRangeAttribute> & { _text: [string] }>
    }]
}

interface WeekBaseBasisdaten {
    BaDatumVon: [XmlTextElement] // dd.mm.YYYY
    BaDatumBis: [XmlTextElement] // dd.mm.YYYY
    BaSwVon: [XmlTextElement]   // school week number
    BaSwBis: [XmlTextElement]   // school week number
    BaTageProWoche: [XmlTextElement]
}

interface WeekBaseSchemaBase {
    _declaration: XmlDeclaration
    splan: [{
        Kopf: [PlanKopf]
        Basisdaten: [WeekBaseBasisdaten]
        FreieTage: [FreieTage]
        Schulwochen: [{
            Sw: Array<XmlElementWithAttribute<WeekBaseSchulwochen> & { _text: [string] }>
        }]
    }]
}

// Weekly schedule with changes (Sw variant)
interface WeekSwLessonEntry {
    PlTg: [XmlTextElement]  // day of the week
    PlSt: [XmlTextElement]  // lesson number
    PlFa: [XmlTextElement]  // subject
    PlKl: [XmlTextElement]  // class name
    PlKu?: [XmlTextElement] // course/group (optional)
    PlLe: [XmlTextElement]  // teacher
    PlRa: [XmlTextElement]  // room
    PlWo?: [XmlTextElement] // week type (optional)
}

interface WeekSwEntity {
    Kurz: [XmlTextElement]
    Stunden: [{
        St: Array<XmlElementWithAttribute<TimeSlotAttribute> & { _text: [string] }>
    }]
    Pl: [{
        Std: Array<WeekSwLessonEntry>
    }]
    Aufsichten?: [{
        Aufsicht: Array<{
            AuTg: [XmlTextElement]  // day of week
            AuVorStunde: [XmlTextElement]  // period before
            AuZeit: [XmlTextElement]  // duty name/time
            AuOrt: [XmlTextElement]  // location
            AuUhrzeit: [XmlTextElement]  // time HH:mm
        }>
    }]
}

interface WeekSwSchemaBase {
    _declaration: XmlDeclaration
    splan: [{
        Kopf: [PlanKopf]
        Basisdaten: [WeekBaseBasisdaten]
        FreieTage: [FreieTage]
        Schulwochen: [{
            Sw: Array<XmlElementWithAttribute<WeekBaseSchulwochen> & { _text: [string] }>
        }]
    }]
}

// Weekly change plan (WPlan_date variant)
interface WeekChangeLessonSlot {
    St: [XmlTextElement]  // lesson number or period
    Fa: [XmlTextElement | Empty]  // subject
    Le: [XmlTextElement | Empty]  // teacher
    Ra: [XmlTextElement | Empty]  // room
    Nr: [XmlTextElement]  // lesson ID
    If: [Empty | XmlTextElement] // additional info about changes
}

interface WeekChangeEntity {
    Kurz: [XmlTextElement]
    Kurse?: [{
        Ku?: Array<VpMobilKurs>
    }]
    Unterricht?: [{
        Ue?: Array<VpMobilUnterricht>
    }]
    Pl: [{
        Std?: Array<WeekChangeLessonSlot>
    }]
    Aufsichten?: [{
        Aufsicht: Array<{
            AuTg: [XmlTextElement]  // day of week
            AuVorStunde: [XmlTextElement]  // period before
            AuZeit: [XmlTextElement]  // duty name
            AuOrt: [XmlTextElement]  // location
            AuUhrzeit: [XmlTextElement]  // time HH:mm
        }>
    }]
}

// Exported XML schema interfaces
export interface VpMobilXmlFileSchema {
    _declaration: XmlDeclaration
    VpMobil: [{
        Kopf: [VpMobilKopf]
        FreieTage: [FreieTage]
        Klassen: [{
            Kl: Array<VpMobilKlasse>
        }]
        ZusatzInfo?: [{
            ZiZeile: Array<XmlTextElement | Empty>
        }]
    }]
}

export interface BasePlanXmlFileSchemaClass extends BasePlanSchemaBase {
    splan: [{
        Kopf: [PlanKopf]
        FreieTage: [FreieTage]
        Kalenderwochen: [{
            Kw: Array<XmlElementWithAttribute<BasePlanKalenderwochen> & { _text: [string] }>
        }]
        Schulwochen: [{
            Sw: Array<XmlElementWithAttribute<BasePlanSchulwochen> & { _text: [string] }>
        }]
        Klassen: [{
            Kl: Array<BasePlanEntityBase>
        }]
    }]
}

export interface BasePlanXmlFileSchemaTeacher extends BasePlanSchemaBase {
    splan: [{
        Kopf: [PlanKopf]
        FreieTage: [FreieTage]
        Kalenderwochen: [{
            Kw: Array<XmlElementWithAttribute<BasePlanKalenderwochen> & { _text: [string] }>
        }]
        Schulwochen: [{
            Sw: Array<XmlElementWithAttribute<BasePlanSchulwochen> & { _text: [string] }>
        }]
        Lehrer: [{
            Le: Array<BasePlanEntityBase>
        }]
    }]
}

export interface BasePlanXmlFileSchemaRoom extends BasePlanSchemaBase {
    splan: [{
        Kopf: [PlanKopf]
        FreieTage: [FreieTage]
        Kalenderwochen: [{
            Kw: Array<XmlElementWithAttribute<BasePlanKalenderwochen> & { _text: [string] }>
        }]
        Schulwochen: [{
            Sw: Array<XmlElementWithAttribute<BasePlanSchulwochen> & { _text: [string] }>
        }]
        Raeume: [{
            Ra: Array<BasePlanEntityBase>
        }]
    }]
}

export interface ChangePlanXmlFileSchemaClass {
    _declaration: XmlDeclaration
    vp: [{
        kopf: [ChangePlanKopf]
        freietage: [{
            ft: Array<XmlTextElement>     // YYMMDD
        }]
        haupt: [{
            aktion: Array<ChangePlanClassAktion>
        }]
        klausuren?: [{
            klausur: Array<ChangePlanKlausur>
        }]
    }]
}

export interface ChangePlanXmlFileSchemaTeacher {
    _declaration: XmlDeclaration
    vp: [{
        kopf: [ChangePlanKopf]
        freietage: [{
            ft: Array<XmlTextElement>     // YYMMDD
        }]
        aufsichten?: [
            Empty | {
                aufsichtzeile: Array<{
                    aufsichtinfo: [XmlTextElement] // Format: "HH:mm: DutyName - Location --> NewTeacher (für OldTeacher)" Or: "HH:mm: DutyName - Location --> entfällt (für OldTeacher)" for cancelled
                }>
            }
        ]
        haupt: [{
            aktion: Array<ChangePlanTeacherAktion>
        }]
        klausuren?: [{
            klausur: Array<ChangePlanKlausur>
        }]
    }]
}

export interface WeekBaseXmlFileSchemaClass extends WeekBaseSchemaBase {
    splan: [{
        Kopf: [PlanKopf]
        Basisdaten: [WeekBaseBasisdaten]
        FreieTage: [FreieTage]
        Schulwochen: [{
            Sw: Array<XmlElementWithAttribute<WeekBaseSchulwochen> & { _text: [string] }>
        }]
        Klassen: [{
            Kl: Array<WeekBaseEntity>
        }]
    }]
}

export interface WeekBaseXmlFileSchemaTeacher extends WeekBaseSchemaBase {
    splan: [{
        Kopf: [PlanKopf]
        Basisdaten: [WeekBaseBasisdaten]
        FreieTage: [FreieTage]
        Schulwochen: [{
            Sw: Array<XmlElementWithAttribute<WeekBaseSchulwochen> & { _text: [string] }>
        }]
        Lehrer: [{
            Le: Array<WeekBaseEntity>
        }]
    }]
}

export interface WeekBaseXmlFileSchemaRoom extends WeekBaseSchemaBase {
    splan: [{
        Kopf: [PlanKopf]
        Basisdaten: [WeekBaseBasisdaten]
        FreieTage: [FreieTage]
        Schulwochen: [{
            Sw: Array<XmlElementWithAttribute<WeekBaseSchulwochen> & { _text: [string] }>
        }]
        Raeume: [{
            Ra: Array<WeekBaseEntity>
        }]
    }]
}

export interface WeekSwXmlFileSchemaClass extends WeekSwSchemaBase {
    splan: [{
        Kopf: [PlanKopf]
        Basisdaten: [WeekBaseBasisdaten]
        FreieTage: [FreieTage]
        Schulwochen: [{
            Sw: Array<XmlElementWithAttribute<WeekBaseSchulwochen> & { _text: [string] }>
        }]
        Klassen: [{
            Kl: Array<WeekSwEntity>
        }]
    }]
}

export interface WeekSwXmlFileSchemaTeacher extends WeekSwSchemaBase {
    splan: [{
        Kopf: [PlanKopf]
        Basisdaten: [WeekBaseBasisdaten]
        FreieTage: [FreieTage]
        Schulwochen: [{
            Sw: Array<XmlElementWithAttribute<WeekBaseSchulwochen> & { _text: [string] }>
        }]
        Lehrer: [{
            Le: Array<WeekSwEntity>
        }]
    }]
}

export interface WeekSwXmlFileSchemaRoom extends WeekSwSchemaBase {
    splan: [{
        Kopf: [PlanKopf]
        Basisdaten: [WeekBaseBasisdaten]
        FreieTage: [FreieTage]
        Schulwochen: [{
            Sw: Array<XmlElementWithAttribute<WeekBaseSchulwochen> & { _text: [string] }>
        }]
        Raeume: [{
            Ra: Array<WeekSwEntity>
        }]
    }]
}

export interface WeekChangeXmlFileSchemaClass {
    _declaration: XmlDeclaration
    WplanVp: [{
        Kopf: [PlanKopf]
        FreieTage: [FreieTage]
        Schulwochen: [{
            Sw: Array<XmlElementWithAttribute<WeekBaseSchulwochen> & { _text: [string] }>
        }]
        Klassen: [{
            Kl: Array<WeekChangeEntity>
        }]
    }]
}

export interface WeekChangeXmlFileSchemaTeacher {
    _declaration: XmlDeclaration
    WplanVp: [{
        Kopf: [PlanKopf]
        FreieTage: [FreieTage]
        Schulwochen: [{
            Sw: Array<XmlElementWithAttribute<WeekBaseSchulwochen> & { _text: [string] }>
        }]
        Lehrer: [{
            Le: Array<WeekChangeEntity>
        }]
    }]
}

export interface WeekChangeXmlFileSchemaRoom {
    _declaration: XmlDeclaration
    WplanVp: [{
        Kopf: [PlanKopf]
        FreieTage: [FreieTage]
        Schulwochen: [{
            Sw: Array<XmlElementWithAttribute<WeekBaseSchulwochen> & { _text: [string] }>
        }]
        Raeume: [{
            Ra: Array<WeekChangeEntity>
        }]
    }]
}