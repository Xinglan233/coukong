import Ajv from 'ajv/dist/2020.js'
import standaloneCode from 'ajv/dist/standalone/index.js'
import { readFileSync, writeFileSync } from 'node:fs'
const schema = JSON.parse(readFileSync('schemas/event-package.v1.schema.json', 'utf8'))
const ajv = new Ajv({ code: { source: true, esm: true }, allErrors: true, validateFormats: false })
const validate = ajv.compile(schema)
const source = standaloneCode(ajv, validate).replace('require("ajv/dist/runtime/ucs2length").default', '((value) => Array.from(value).length)')
writeFileSync('shared/generated-event-validator.js', source)
