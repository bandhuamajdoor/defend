import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// Dependency-free documentation checker. Validates the JSON Schema subset used
// by these contracts; it is not a full OpenAPI or JSON Schema conformance suite.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const fail = message => failures.push(message);
const relative = file => path.relative(root, file).replaceAll('\\', '/');
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === '.git' || entry.name === 'node_modules') return [];
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
const files = [path.join(root, 'README.md'), ...walk(path.join(root, 'docs'))];
let links = 0;
for (const file of files.filter(file => file.endsWith('.md'))) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].replace(/^<|>$/g, '');
    if (/^(https?:|mailto:|#)/i.test(target)) continue;
    const destination = path.resolve(path.dirname(file), decodeURIComponent(target.split('#')[0]));
    links++;
    if (!fs.existsSync(destination)) fail(`${relative(file)}: missing link ${target}`);
  }
}
const documents = new Map();
for (const file of files.filter(file => file.endsWith('.json'))) {
  try { documents.set(file, JSON.parse(fs.readFileSync(file, 'utf8'))); }
  catch (error) { fail(`${relative(file)}: ${error.message}`); }
}
function resolve(reference, from) {
  const [location, fragment = ''] = reference.split('#');
  const file = location ? path.resolve(path.dirname(from), location) : from;
  let value = documents.get(file);
  if (!value) throw new Error(`Missing reference file ${relative(file)}`);
  if (fragment) {
    if (!fragment.startsWith('/')) throw new Error(`Unsupported reference fragment ${fragment}`);
    for (const part of fragment.slice(1).split('/')) {
      const key = part.replaceAll('~1', '/').replaceAll('~0', '~');
      if (!value || !Object.hasOwn(value, key)) throw new Error(`Missing reference ${reference}`);
      value = value[key];
    }
  }
  return { schema: value, file };
}
let references = 0;
function inspectReferences(value, file) {
  if (!value || typeof value !== 'object') return;
  if (value.$ref) {
    references++;
    try { resolve(value.$ref, file); }
    catch (error) { fail(`${relative(file)}: ${error.message}`); }
  }
  for (const child of Object.values(value)) inspectReferences(child, file);
}
for (const [file, value] of documents) inspectReferences(value, file);
const schemaFile = path.join(root, 'docs/contracts/domain.schema.json');
const domain = documents.get(schemaFile);
const supported = new Set(['$schema','$id','$defs','$ref','title','description','type','const','enum','anyOf','properties','required','additionalProperties','items','minItems','maxItems','minLength','maxLength','minimum','pattern','format']);
function inspectSchema(schema, where) {
  if (!schema || typeof schema !== 'object') return;
  for (const key of Object.keys(schema)) if (!supported.has(key)) fail(`Checker needs support for schema keyword ${key} at ${where}`);
  for (const [name, child] of Object.entries(schema.properties ?? {})) inspectSchema(child, `${where}.${name}`);
  for (const [name, child] of Object.entries(schema.$defs ?? {})) inspectSchema(child, `${where}.$defs.${name}`);
  for (const child of schema.anyOf ?? []) inspectSchema(child, where);
  if (schema.items) inspectSchema(schema.items, `${where}[]`);
}
function validate(schema, value, file, where) {
  const errors = [];
  if (schema.$ref) {
    const resolved = resolve(schema.$ref, file);
    return validate(resolved.schema, value, resolved.file, where);
  }
  if (schema.anyOf) return schema.anyOf.some(option => validate(option, value, file, where).length === 0) ? [] : [`${where}: no anyOf option matches`];
  const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (schema.type && !(schema.type === 'integer' ? Number.isInteger(value) : actual === schema.type)) return [`${where}: expected ${schema.type}, got ${actual}`];
  if ('const' in schema && JSON.stringify(value) !== JSON.stringify(schema.const)) errors.push(`${where}: const mismatch`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${where}: invalid enum ${value}`);
  if (typeof value === 'string') {
    const length = [...value].length;
    if (schema.minLength !== undefined && length < schema.minLength) errors.push(`${where}: string too short`);
    if (schema.maxLength !== undefined && length > schema.maxLength) errors.push(`${where}: string too long`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${where}: pattern mismatch`);
    if (schema.format === 'uuid' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) errors.push(`${where}: invalid UUID`);
    if (schema.format === 'date-time' && (!/^\d{4}-\d\d-\d\dT/.test(value) || Number.isNaN(Date.parse(value)))) errors.push(`${where}: invalid date-time`);
  }
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) errors.push(`${where}: below minimum`);
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${where}: too few items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${where}: too many items`);
    if (schema.items) value.forEach((item, i) => errors.push(...validate(schema.items, item, file, `${where}[${i}]`)));
  }
  if (actual === 'object') {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) errors.push(`${where}: missing ${key}`);
    for (const [key, child] of Object.entries(value)) {
      if (schema.properties?.[key]) errors.push(...validate(schema.properties[key], child, file, `${where}.${key}`));
      else if (schema.additionalProperties === false) errors.push(`${where}: unexpected ${key}`);
    }
  }
  return errors;
}
if (domain) inspectSchema(domain, 'domain');
const examples = documents.get(path.join(root, 'docs/fixtures/contract-examples.json')) ?? [];
for (const example of examples) {
  if (!domain?.$defs?.[example.schema]) { fail(`Unknown example schema ${example.schema}`); continue; }
  failures.push(...validate(domain.$defs[example.schema], example.value, schemaFile, example.name));
}
const api = documents.get(path.join(root, 'docs/contracts/openapi.json'));
// Cross-example checks cover semantic rules that JSON Schema cannot express.
const upload = examples.find(example => example.schema === 'ProjectUpload')?.value;
const project = examples.find(example => example.schema === 'Project')?.value;
const submitted = examples.find(example => example.schema === 'AnswerRequest')?.value;
for (const version of project?.versions ?? []) {
  for (const file of version.files) {
    const input = upload?.files.find(item => item.path === file.path);
    if (input && file.byteSize !== Buffer.byteLength(input.text, 'utf8')) fail(`Example byte size incorrect for ${file.path}`);
  }
}
for (const example of examples.filter(example => example.schema === 'Report')) {
  const report = example.value;
  const evidenceIds = new Set(report.evidence.map(item => item.id));
  if (new Set(report.content.criteria.map(item => item.criterionId)).size !== 4) fail(`${example.name}: duplicate criterion`);
  for (const evidence of report.evidence) {
    if (evidence.endLine < evidence.startLine) fail(`${example.name}: reversed evidence span`);
    const source = upload?.files.find(item => item.path === evidence.path);
    const excerpt = source?.text.split('\n').slice(evidence.startLine - 1, evidence.endLine).join('\n');
    if (excerpt !== evidence.excerpt) fail(`${example.name}: excerpt mismatch`);
    if (createHash('sha256').update(evidence.excerpt).digest('hex') !== evidence.sha256) fail(`${example.name}: excerpt hash mismatch`);
  }
  for (const finding of report.content.findings) {
    for (const sourceId of finding.evidenceIds) if (!evidenceIds.has(sourceId)) fail(`${example.name}: unresolved finding evidence`);
    for (const quote of finding.answerQuotes) if (!submitted?.text.includes(quote.quote)) fail(`${example.name}: quotation not in example answer`);
  }
}
if (domain) {
  const badAnswer = { questionId: 'invalid', turnId: 'invalid', expectedRevision: -1, text: '' };
  if (validate(domain.$defs.AnswerRequest, badAnswer, schemaFile, 'negative-example').length === 0) fail('Checker accepted intentionally invalid answer');
  if (validate(domain.$defs.ConsentRequest, { consent: false }, schemaFile, 'negative-consent').length === 0) fail('Checker accepted false consent');
}
const operationIds = new Set();
let operations = 0;
if (api) {
  if (api.openapi !== '3.1.0') fail('Expected OpenAPI 3.1.0');
  for (const [route, item] of Object.entries(api.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      operations++;
      if (operationIds.has(operation.operationId)) fail(`Duplicate operationId ${operation.operationId}`);
      operationIds.add(operation.operationId);
      for (const match of route.matchAll(/{(\w+)}/g)) {
        if (!operation.parameters?.some(parameter => parameter.in === 'path' && parameter.name === match[1] && parameter.required)) fail(`${method} ${route}: missing path parameter`);
      }
      if (['post','delete'].includes(method) && route !== '/guest' && !operation.parameters.some(parameter => parameter.name === 'Idempotency-Key')) fail(`${method} ${route}: missing idempotency key`);
      if (!Object.keys(operation.responses ?? {}).some(code => /^2\d\d$/.test(code))) fail(`${method} ${route}: missing success response`);
    }
  }
}
const cases = documents.get(path.join(root, 'docs/fixtures/evaluation-cases.json'))?.cases ?? [];
const caseIds = new Set();
for (const item of cases) {
  if (caseIds.has(item.id)) fail(`Duplicate evaluation case ${item.id}`);
  caseIds.add(item.id);
  if (!item.expected?.length || !item.forbidden?.length) fail(`${item.id}: missing evaluation criteria`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Documentation checks passed: ${links} local links, ${documents.size} JSON files, ${references} references, ${examples.length} contract examples, ${operations} API operations, ${cases.length} behavioural cases.`);
  console.log('Scope: local links, schema subset, reference integrity and API structure. Product behaviour and full OpenAPI conformance are not tested.');
}
