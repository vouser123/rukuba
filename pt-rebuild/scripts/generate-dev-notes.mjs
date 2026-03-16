import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = path.resolve(process.cwd());
const jsonPath = path.join(rootDir, 'docs', 'dev_notes.json');
const schemaPath = path.join(rootDir, 'docs', 'dev_notes.schema.json');
const markdownPath = path.join(rootDir, 'docs', 'DEV_NOTES.md');
const checkMode = process.argv.includes('--check');

const REQUIRED_ENUM_KEYS = ['priority_levels', 'risk_levels', 'status_values', 'tag_vocabulary'];
const UX_APPROVAL_STATUSES = ['not_needed', 'required_pending', 'approved', 'revoked'];
const REQUIRED_CLOSED_NARRATIVE_FIELDS = [
  'problem',
  'root_cause',
  'change_made',
  'files_touched',
  'validation',
  'follow_ups'
];

function fail(message) {
  console.error(`[dev-notes] ${message}`);
  process.exit(1);
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    fail(`Missing ${label} file at ${filePath}`);
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`Invalid ${label} JSON: ${error.message}`);
  }
}

function getEnumValues(enumEntries, key) {
  if (!Array.isArray(enumEntries) || enumEntries.length === 0) {
    fail(`enums.${key} must be a non-empty array.`);
  }

  const values = [];

  for (const entry of enumEntries) {
    if (!entry || typeof entry !== 'object' || !entry.value || !entry.definition) {
      fail(`enums.${key} entries must include { value, definition }.`);
    }
    values.push(entry.value);
  }

  return values;
}

function validateAgainstSchema(data, schema) {
  if (!schema || typeof schema !== 'object') {
    fail('Schema file must contain a JSON object.');
  }

  const requiredRoot = schema.required ?? [];
  for (const key of requiredRoot) {
    if (!(key in data)) {
      fail(`Schema validation failed: missing root key '${key}'.`);
    }
  }

  if (schema.properties?.metadata?.required) {
    for (const key of schema.properties.metadata.required) {
      if (!(key in (data.metadata ?? {}))) {
        fail(`Schema validation failed: missing metadata.${key}.`);
      }
    }
  }

  if (schema.properties?.enums?.required) {
    for (const key of schema.properties.enums.required) {
      if (!(key in (data.enums ?? {}))) {
        fail(`Schema validation failed: missing enums.${key}.`);
      }
    }
  }

  const schemaTagCatalog = schema?.x_enum_catalog?.tag_vocabulary;
  if (Array.isArray(schemaTagCatalog) && schemaTagCatalog.length > 0) {
    const dataTagValues = (data?.enums?.tag_vocabulary ?? []).map((entry) => entry?.value);
    if (schemaTagCatalog.length !== dataTagValues.length) {
      fail('Schema drift: tag_vocabulary length differs between docs/dev_notes.schema.json and docs/dev_notes.json.');
    }
    for (let i = 0; i < schemaTagCatalog.length; i += 1) {
      if (schemaTagCatalog[i] !== dataTagValues[i]) {
        fail(`Schema drift: tag_vocabulary mismatch at index ${i} ('${schemaTagCatalog[i]}' !== '${dataTagValues[i]}').`);
      }
    }
  }
}

function validate(data, schema) {
  if (!data || typeof data !== 'object') {
    fail('Root JSON object is required.');
  }

  validateAgainstSchema(data, schema);

  if (!Array.isArray(data.open_items)) {
    fail('open_items array is required.');
  }

  if (!Array.isArray(data.closed_items)) {
    fail('closed_items array is required.');
  }

  const priorities = getEnumValues(data.enums.priority_levels, 'priority_levels');
  const risks = getEnumValues(data.enums.risk_levels, 'risk_levels');
  const tags = getEnumValues(data.enums.tag_vocabulary, 'tag_vocabulary');

  for (const key of REQUIRED_ENUM_KEYS) {
    if (!Array.isArray(data.enums[key]) || data.enums[key].length === 0) {
      fail(`enums.${key} must be a non-empty array.`);
    }
  }

  const activeStatuses = ['open', 'in_progress', 'blocked'];
  for (const item of data.open_items) {
    if (!item.id || !item.status || !item.priority || !item.risk || !Array.isArray(item.tags) || !item.file || !item.issue) {
      fail(`Invalid open item: ${JSON.stringify(item)}`);
    }
    if (!activeStatuses.includes(item.status)) {
      fail(`open_items item ${item.id} has status '${item.status}' — done items must be in closed_items.`);
    }
    if (!priorities.includes(item.priority)) {
      fail(`Open item ${item.id} has invalid priority '${item.priority}'.`);
    }
    if (!risks.includes(item.risk)) {
      fail(`Open item ${item.id} has invalid risk '${item.risk}'.`);
    }
    for (const tag of item.tags) {
      if (!tags.includes(tag)) {
        fail(`Open item ${item.id} has invalid tag '${tag}'.`);
      }
    }

    const ux = item.ux_approval;
    if (!ux || typeof ux !== 'object') {
      fail(`Open item ${item.id} missing required ux_approval object.`);
    }
    if (!UX_APPROVAL_STATUSES.includes(ux.status)) {
      fail(`Open item ${item.id} has invalid ux_approval.status '${ux.status}'.`);
    }
    if (ux.status === 'not_needed') {
      if (typeof ux.reason_not_needed !== 'string' || ux.reason_not_needed.trim() === '') {
        fail(`Open item ${item.id} ux_approval.status='not_needed' requires non-empty reason_not_needed.`);
      }
    }
    if (ux.status === 'approved') {
      const requiredApprovalFields = ['approved_by', 'approved_on', 'surface', 'delta', 'scope', 'validation_target'];
      for (const field of requiredApprovalFields) {
        if (typeof ux[field] !== 'string' || ux[field].trim() === '') {
          fail(`Open item ${item.id} ux_approval.status='approved' missing '${field}'.`);
        }
      }
    }
  }

  for (const item of data.closed_items) {
    if (!item.id || !item.status || !item.priority || !item.risk || !Array.isArray(item.tags) || !item.file || !item.issue) {
      fail(`Invalid closed item: ${JSON.stringify(item)}`);
    }
    if (item.status !== 'done') {
      fail(`closed_items item ${item.id} has status '${item.status}' — only done items belong in closed_items.`);
    }
    for (const tag of item.tags) {
      if (!tags.includes(tag)) {
        fail(`Closed item ${item.id} has invalid tag '${tag}'.`);
      }
    }

    for (const field of REQUIRED_CLOSED_NARRATIVE_FIELDS) {
      if (!(field in item) || typeof item[field] !== 'string' || item[field].trim() === '') {
        fail(`closed_items item ${item.id} missing required narrative field '${field}'.`);
      }
    }
  }

  const openDnIds = new Set(
    data.open_items
      .map(item => item.id)
      .filter(id => /^DN-\d{3}$/.test(id))
  );
  const closedDnIds = new Set(
    data.closed_items
      .map(item => item.id)
      .filter(id => /^DN-\d{3}$/.test(id))
  );

  for (const id of openDnIds) {
    if (closedDnIds.has(id)) {
      fail(`DN overlap violation: ${id} appears in both open_items and closed_items.`);
    }
  }
}

function renderEnumSection(entries) {
  return entries.map((entry) => `- \`${entry.value}\`: ${entry.definition}`).join('\n');
}

function renderOpenItem(item) {
  const checked = item.status === 'done' || Boolean(item.resolved) ? 'x' : ' ';
  const base = `- [${checked}] ${item.id} | status:${item.status} | priority:${item.priority} | risk:${item.risk} | tags:[${item.tags.join(',')}] | file:${item.file} | issue:${item.issue}${item.resolved ? ` | resolved:${item.resolved}` : ''}`;
  const details = [];
  if (item.context) details.push(`  - Context: ${item.context}`);
  if (item.options) details.push(`  - Options: ${item.options}`);
  if (item.constraints_caveats) details.push(`  - Constraints/Caveats: ${item.constraints_caveats}`);
  return [base, ...details].join('\n');
}

function renderClosedItem(item) {
  const base = `- [x] ${item.id} | status:${item.status} | priority:${item.priority} | risk:${item.risk} | tags:[${item.tags.join(',')}] | file:${item.file} | issue:${item.issue}${item.resolved ? ` | resolved:${item.resolved}` : ''}`;
  return [
    base,
    `  - Problem: ${item.problem}`,
    `  - Root cause: ${item.root_cause}`,
    `  - Change made: ${item.change_made}`,
    `  - Files touched: ${item.files_touched}`,
    `  - Validation: ${item.validation}`,
    `  - Follow-ups: ${item.follow_ups}`
  ].join('\n');
}

function sortClosedItemsByResolvedDesc(items) {
  return [...items].sort((a, b) => {
    const aResolved = a.resolved || '';
    const bResolved = b.resolved || '';
    if (aResolved !== bResolved) return bResolved.localeCompare(aResolved);
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

function buildMarkdown(data) {
  return `# PT Tracker Rebuild - Public Dev Notes

This file is generated from \`docs/dev_notes.json\`. Do not hand-edit this Markdown.

> Legacy archive: Beads is the active tracker for current work. Use this file for historical reference only.

## Table of Contents
- [How to Use This File](#how-to-use-this-file)
- [Priority Levels](#priority-levels)
- [Risk Levels](#risk-levels)
- [Status Values](#status-values)
- [Tag Vocabulary](#tag-vocabulary)
- [Entry Schema](#entry-schema)
- [Migration Approach](#migration-approach)
- [Open Items](#open-items)
- [Closed Items](#closed-items)

## How to Use This File
- Canonical source of truth for the legacy archive: \`docs/dev_notes.json\`.
- Active work now lives in Beads, not in \`open_items\`.
- Run \`npm run dev-notes:build\` after legacy archive updates.
- \`open_items\`: legacy active queue from before the Beads migration; should normally be empty.
- \`closed_items\`: completed or retired legacy items — status \`done\` only.

## Priority Levels
${renderEnumSection(data.enums.priority_levels)}

## Risk Levels
${renderEnumSection(data.enums.risk_levels)}

## Status Values
${renderEnumSection(data.enums.status_values)}

## Tag Vocabulary
${renderEnumSection(data.enums.tag_vocabulary)}

## Entry Schema
Closed items must include all six narrative fields:
- \`problem\`
- \`root_cause\`
- \`change_made\`
- \`files_touched\`
- \`validation\`
- \`follow_ups\`

## Migration Approach
- Active TODOs are tracked in \`open_items\`. Completed items live in \`closed_items\`.
- Legacy pre-structured notes are archived in \`docs/HISTORY.md\` and are not machine-processed.

## Open Items
${data.open_items.map(renderOpenItem).join('\n')}

## Closed Items
${sortClosedItemsByResolvedDesc(data.closed_items).map(renderClosedItem).join('\n')}
`.trimEnd() + '\n';
}

const schema = readJson(schemaPath, 'schema');
const data = readJson(jsonPath, 'canonical');
validate(data, schema);
const markdown = buildMarkdown(data);

if (checkMode) {
  const existing = fs.existsSync(markdownPath) ? fs.readFileSync(markdownPath, 'utf8') : '';
  if (existing !== markdown) {
    fail('docs/DEV_NOTES.md is out of sync with docs/dev_notes.json. Run npm run dev-notes:build.');
  }
  console.log('[dev-notes] OK: docs/DEV_NOTES.md is in sync.');
  process.exit(0);
}

fs.writeFileSync(markdownPath, markdown);
console.log(`[dev-notes] Generated ${path.relative(rootDir, markdownPath)} from docs/dev_notes.json`);
