import Ajv from 'ajv/dist/2020.js'
import standaloneCode from 'ajv/dist/standalone/index.js'
import { readFileSync, writeFileSync } from 'node:fs'
for (const version of [1,2]) {
 const schema = JSON.parse(readFileSync(`schemas/event-package.v${version}.schema.json`, 'utf8'))
 const ajv = new Ajv({ code: { source: true, esm: true }, allErrors: true, validateFormats: false })
 const validate = ajv.compile(schema)
 const source = standaloneCode(ajv, validate).replaceAll('require("ajv/dist/runtime/ucs2length").default', '((value) => Array.from(value).length)')
 const filename=version===1?'generated-event-validator':'generated-event-v2-validator'
 writeFileSync(`shared/${filename}.js`, source)
 if(version===2)writeFileSync(`shared/${filename}.d.ts`,readFileSync('shared/generated-event-validator.d.ts','utf8'))
}
