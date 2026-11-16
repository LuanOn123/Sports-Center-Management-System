// Regenerate the existing logical PostgreSQL ERD from the checked-in Prisma schema.
// Does not connect to a database or modify application files.
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { directive } from './style.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const schema = await fs.readFile(path.join(root, 'BE/prisma/schema.prisma'), 'utf8');
const models = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].map(m => ({
  name: m[1], body: m[2], line: schema.slice(0, m.index).split('\n').length,
  fields: m[2].split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('//') && !s.startsWith('@@')),
}));
const names = new Set(models.map(m => m.name));
const enums = [...schema.matchAll(/^enum (\w+) \{/gm)].map(m => m[1]);
const out = [directive, '%% PostgreSQL logical schema, not MongoDB identity storage.',
  `%% SOURCE: BE/prisma/schema.prisma; ${models.length} models, ${enums.length} enums.`,
  '%% All scalar fields retained. Nullable columns are labelled nullable.',
  '%% PK/FK/UK mark actual single-column constraints, not components of composite unique keys.',
  '%% Composite constraints and scalar identifiers without declared FKs are documented in DATABASE_ERD.md.',
  'erDiagram'];
const relations = [];
for (const model of models) {
  const fks = new Set();
  for (const line of model.fields) {
    const m = line.match(/^(\w+)\s+(\w+)(\?|\[\])?\s+.*?@relation\([^\n]*fields:\s*\[([^\]]+)\]/);
    if (!m || !names.has(m[2])) continue;
    const keys = m[4].split(',').map(s => s.trim());
    keys.forEach(k => fks.add(k));
    const unique = keys.length === 1 && model.fields.some(f => new RegExp(`^${keys[0]}\\s`).test(f) && /@unique\b/.test(f));
    relations.push(`    ${m[2]} ${m[3] === '?' ? '|o' : '||'}..${unique ? 'o|' : 'o{'} ${model.name} : "${m[1]}"`);
  }
  out.push(`    ${model.name} {`);
  for (const line of model.fields) {
    const m = line.match(/^(\w+)\s+(\w+)(\?|\[\])?(.*)$/);
    if (!m || names.has(m[2])) continue;
    const keys = [/\B@id\b/.test(m[4]) ? 'PK' : '', fks.has(m[1]) ? 'FK' : '', /@unique\b/.test(m[4]) ? 'UK' : ''].filter(Boolean);
    out.push(`        ${m[2]}${m[3] === '[]' ? '_array' : ''} ${m[1]}${keys.length ? ' ' + keys.join(',') : ''}${m[3] === '?' ? ' "nullable"' : ''}`);
  }
  out.push('    }');
}
// The schema's only implicit many-to-many relation is Class.sports <-> Sport.classes.
if (models.find(m => m.name === 'Class')?.fields.some(f => /^sports\s+Sport\[\]/.test(f))) {
  out.push('    _ClassToSport {', '        String A FK "composite unique A+B"', '        String B FK "composite unique A+B"', '    }');
  relations.push('    Class ||--o{ _ClassToSport : A', '    Sport ||--o{ _ClassToSport : B');
}
out.push(...relations);
// Mermaid 12 treats Class as a style keyword; quote the real model name.
const diagram = out.join('\n').replace(/\bClass\b(?= \{| [|]| :|$)/gm, '"Class"');
await fs.writeFile(path.join(root, 'docs/architecture/database-erd.mmd'), diagram + '\n');
console.log(JSON.stringify({ models: models.length, enums: enums.length, relationships: relations.length }));
