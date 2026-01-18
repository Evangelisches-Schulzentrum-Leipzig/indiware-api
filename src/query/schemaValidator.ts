import Ajv from "ajv"
import {
    VpMobilXmlFileSchema
} from './xmlschema.js'

const ajv = new Ajv.default()

export interface ValidationResult {
    valid: boolean
    errors: ValidationError[]
}

export interface ValidationError {
    path: string
    message: string
    dataPath: string
}

export function matchesVpMobilXmlFileSchema(input: unknown): input is VpMobilXmlFileSchema {
    const validate = ajv.compile<VpMobilXmlFileSchema>(VpMobilXmlFileSchema)
    return validate(input)
}