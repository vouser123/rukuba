import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = path.resolve(process.cwd());
const jsonPath = path.join(rootDir, 'docs', 'dev_notes.json');
const markdownPath = path.join(rootDir, 'docs', 'DEV_NOTES.md');
const checkMode = process.argv.includes('--check');

const REQUIRED_ENUM_KEYS = ['priority_levels', 'risk_levels', 'status_values', 'tag_vocabulary'];
const REQUIRED_ENTRY_FIELDS = [
  'problem',
  'root_cause',
  'change_made',
  'files_touched',
  'validation',
  'follow_ups',
  'tags'
];

function fail(message) {
  console.error(`[dev-notes] ${message}`);
  process.exit(1);
}

function readJson() {
  if (!fs.existsSync(jsonPath)) {
    fail(`Missing canonical JSON file at ${jsonPath}`);
  }

  try {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (error) {
    fail(`Invalid JSON: ${error.message}`);
  }
}

function validate(data) {
  if (!data || typeof data !== 'object') {
    fail('Root JSON object is required.');
  }

  if (!data.metadata || typeof data.metadata !== 'object') {
    fail('metadata object is required.');
  }

  if (!data.metadata.schema_version || !data.metadata.last_updated) {
    fail('metadata.schema_version and metadata.last_updated are required.');
  }

  if (!data.enums || typeof data.enums !== 'object') {
    fail('enums object is required.');
  }

  for (const key of REQUIRED_ENUM_KEYS) {
    if (!Array.isArray(data.enums[key]) || data.enums[key].length === 0) {
      fail(`enums.${key} must be a non-empty array.`);
    }
  }

  if (!Array.isArray(data.open_items)) {
    fail('open_items array is required.');
  }

  if (!Array.isArray(data.dated_entries)) {
    fail('dated_entries array is required.');
  }

  const { priority_levels: priorities, risk_levels: risks, status_values: statuses, tag_vocabulary: tags } = data.enums;

  for (const item of data.open_items) {
    if (!item.id || !item.status || !item.priority || !item.risk || !Array.isArray(item.tags) || !item.file || !item.issue) {
      fail(`Invalid open item: ${JSON.stringify(item)}`);
    }
    if (!priorities.includes(item.priority)) {
      fail(`Open item ${item.id} has invalid priority '${item.priority}'.`);
    }
    if (!risks.includes(item.risk)) {
      fail(`Open item ${item.id} has invalid risk '${item.risk}'.`);
    }
    if (!statuses.includes(item.status)) {
      fail(`Open item ${item.id} has invalid status '${item.status}'.`);
    }
    for (const tag of item.tags) {
      if (!tags.includes(tag)) {
        fail(`Open item ${item.id} has invalid tag '${tag}'.`);
      }
    }
  }

  for (const entry of data.dated_entries) {
    if (!entry.date || !entry.title) {
      fail(`Dated entry missing date/title: ${JSON.stringify(entry)}`);
    }

    for (const field of REQUIRED_ENTRY_FIELDS) {
      if (!(field in entry)) {
        fail(`Dated entry '${entry.title}' missing '${field}'.`);
      }
    }

    if (!Array.isArray(entry.tags)) {
      fail(`Dated entry '${entry.title}' tags must be an array.`);
    }

    for (const tag of entry.tags) {
      if (!tags.includes(tag)) {
        fail(`Dated entry '${entry.title}' has invalid tag '${tag}'.`);
      }
    }
  }
}

function renderOpenItem(item) {
  const checked = item.status === 'done' || item.checkbox === 'done' || Boolean(item.resolved) ? 'x' : ' ';
  const base = `- [${checked}] ${item.id} | status:${item.status} | priority:${item.priority} | risk:${item.risk} | tags:[${item.tags.join(',')}] | file:${item.file} | issue:${item.issue}${item.resolved ? ` | resolved:${item.resolved}` : ''}`;
  const details = [];
  if (item.context) details.push(`  - Context: ${item.context}`);
  if (item.options) details.push(`  - Options: ${item.options}`);
  if (item.constraints_caveats) details.push(`  - Constraints/Caveats: ${item.constraints_caveats}`);
  return [base, ...details].join('\n');
}

function renderDatedEntries(datedEntries) {
  const sorted = [...datedEntries].sort((a, b) => {
    const aDate = `${a.date} ${a.title}`;
    const bDate = `${b.date} ${b.title}`;
    return bDate.localeCompare(aDate);
  });

  const blocks = [];
  let activeDate = null;

  for (const entry of sorted) {
    if (entry.date !== activeDate) {
      activeDate = entry.date;
      blocks.push(`## ${entry.date}\n`);
    }

    blocks.push(`### ${entry.title}`);
    blocks.push(`- Problem: ${entry.problem}`);
    blocks.push(`- Root cause: ${entry.root_cause}`);
    blocks.push(`- Change made: ${entry.change_made}`);
    blocks.push(`- Files touched: ${entry.files_touched}`);
    blocks.push(`- Validation: ${entry.validation}`);
    blocks.push(`- Follow-ups: ${entry.follow_ups}`);
    blocks.push(`- Tags: [${entry.tags.join(',')}]\n`);
  }

  return blocks.join('\n');
}

function buildMarkdown(data) {
  const checklist = data.activity_log_testing_checklist?.markdown?.trim() ?? '';
  const legacy = data.legacy_entries?.markdown?.trim() ?? '';

  return `# PT Tracker Rebuild - Public Dev Notes

This file is generated from \`docs/dev_notes.json\`. Do not hand-edit this Markdown.

## Table of Contents
- [How to Use This File](#how-to-use-this-file)
- [Priority Levels](#priority-levels)
- [Risk Levels](#risk-levels)
- [Status Values](#status-values)
- [Tag Vocabulary](#tag-vocabulary)
- [Entry Schema](#entry-schema)
- [Migration Approach](#migration-approach)
- [Activity Log Testing Checklist](#activity-log-testing-checklist)
- [Open Items](#open-items)
- [Dated Entries](#dated-entries)
- [Legacy Entries (Pre-Format)](#legacy-entries-pre-format)

## How to Use This File
- Canonical source of truth: \`docs/dev_notes.json\`.
- Run \`npm run dev-notes:build\` after JSON updates.
- Keep active work only in \`Open Items\`.
- Close-loop rule: when an item is resolved, remove/resolve it in \`open_items\` and add a dated entry linked to the issue ID.

## Priority Levels
${data.enums.priority_levels.map((value) => `- \`${value}\``).join('\n')}

## Risk Levels
${data.enums.risk_levels.map((value) => `- \`${value}\``).join('\n')}

## Status Values
${data.enums.status_values.map((value) => `- \`${value}\``).join('\n')}

## Tag Vocabulary
${data.enums.tag_vocabulary.map((value) => `- \`${value}\``).join('\n')}

## Entry Schema
Use this exact field order for all new dated entries:
- \`Problem:\`
- \`Root cause:\`
- \`Change made:\`
- \`Files touched:\`
- \`Validation:\`
- \`Follow-ups:\`
- \`Tags: [...]\`

## Migration Approach
- Legacy content is frozen under \`Legacy Entries (Pre-Format)\`.
- Active TODOs are tracked in \`open_items\`.
- Convert legacy entries to full schema only when touched.

${checklist}

## Open Items
${data.open_items.map(renderOpenItem).join('\n')}

## Dated Entries
Use this section for all new entries in reverse chronological order.

${renderDatedEntries(data.dated_entries)}

${legacy}
`.trimEnd() + '\n';
}

const data = readJson();
validate(data);
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
