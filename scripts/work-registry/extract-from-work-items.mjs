#!/usr/bin/env node
/**
 * Scan .work-items/ and merge trackable units into scripts/work-registry/manifest.json.
 * Preserves seeded issue numbers and hand-edited fields on existing items.
 *
 * Usage:
 *   node scripts/work-registry/extract-from-work-items.mjs [--merge] [--write]
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const MANIFEST_PATH = join(__dirname, 'manifest.json');
const WORK_ITEMS = join(REPO_ROOT, '.work-items');

const args = new Set(process.argv.slice(2));
const merge = args.has('--merge') || args.size === 0;
const write = args.has('--write') || args.size === 0;

function readText(path) {
  return readFileSync(path, 'utf8');
}

function loadManifest() {
  return JSON.parse(readText(MANIFEST_PATH));
}

function firstHeading(md) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].replace(/^[^:]+:\s*/, '').trim() : basename(md, '.md');
}

function titleFromStoryFile(md, fallback) {
  const m = md.match(/^#\s+([^\n]+)/m);
  if (!m) return fallback;
  const raw = m[1].trim();
  const dash = raw.indexOf('—');
  if (dash >= 0) return raw.slice(dash + 1).trim();
  return raw;
}

function inferStatusFromMarkdown(md, defaultStatus = 'todo') {
  if (/\*\*Done \(slice|\*\*Done \(|\*\*Done:|✅|\bComplete\b|\[x\]/i.test(md)) {
    const openBoxes = (md.match(/- \[ \]/g) || []).length;
    const closedBoxes = (md.match(/- \[x\]/gi) || []).length;
    if (closedBoxes > 0 && openBoxes === 0) return 'done';
  }
  if (/deferred|not default surface/i.test(md)) return 'deferred';
  if (/Phase 0.*✅|\[x\].*foundation/i.test(md)) return 'done';
  return defaultStatus;
}

function extractSection(md, heading) {
  const re = new RegExp(`## ${heading}[\\s\\S]*?(?=\\n## |$)`, 'i');
  const m = md.match(re);
  return m ? m[0].trim() : '';
}

function itemKey(programId, workKey) {
  return `${programId}::${workKey}`;
}

function mergeItem(existing, incoming) {
  if (!existing) return incoming;
  const preserved = {};
  for (const k of ['issue', 'projectItemId', 'labels']) {
    if (existing[k] !== undefined && existing[k] !== null) preserved[k] = existing[k];
  }
  const preservedStatus =
    existing.status === 'done' || existing.status === 'deferred' ? existing.status : incoming.status;
  if (
    write &&
    existing.status &&
    incoming.status &&
    existing.status !== incoming.status &&
    (existing.status === 'deferred' || existing.status === 'done')
  ) {
    console.warn(
      `manifest-first: preserving status "${existing.status}" for ${existing.workKey ?? incoming.workKey} (extract had "${incoming.status}")`,
    );
  }
  return { ...incoming, ...preserved, status: preservedStatus };
}

function listMdFiles(dir, pattern) {
  const out = [];
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return out;
  if (dir.includes(`${WORK_ITEMS}${join('', '_archive')}`) || dir.includes('/_archive/')) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === '_archive') continue;
    if (statSync(full).isDirectory()) {
      out.push(...listMdFiles(full, pattern));
      continue;
    }
    if (name.endsWith('.md') && name !== 'index.md' && name !== 'README.md' && pattern.test(name)) {
      out.push(full);
    }
  }
  return out.sort();
}

function baseItem({ workKey, type, title, source, status, phase, projectStatus, parentWorkKey, dependsOn, children }) {
  return {
    workKey,
    type,
    title,
    source: relative(REPO_ROOT, source),
    status,
    phase: phase ?? 'Implementation',
    projectStatus: projectStatus ?? (status === 'done' ? 'Done' : 'Todo'),
    parentWorkKey: parentWorkKey ?? null,
    ...(dependsOn?.length ? { dependsOn } : {}),
    ...(children?.length ? { children } : {}),
  };
}

function extractAdventureV3() {
  const items = [];
  const epicDir = join(WORK_ITEMS, 'adventure-langgraph/epics');
  const storyDir = join(WORK_ITEMS, 'adventure-langgraph/stories');

  const epicChildren = {
    E1: ['US-1-1', 'US-1-2'],
    E2: ['US-2-1'],
    E3: ['US-3-1'],
    E4: ['US-4-1', 'US-4-2', 'US-4-3'],
    E5: ['US-5-1'],
  };

  for (const file of listMdFiles(epicDir, /^E\d+-/)) {
    const md = readText(file);
    const workKey = basename(file).match(/^(E\d+)/)[1];
    const status = workKey === 'E4' ? 'deferred' : inferStatusFromMarkdown(md, 'todo');
    items.push(
      baseItem({
        workKey,
        type: 'epic',
        title: firstHeading(md),
        source: file,
        status,
        phase: status === 'done' ? 'Done' : 'Foundation',
        parentWorkKey: 'V3-EPIC',
        children: epicChildren[workKey] ?? [],
      }),
    );
  }

  const storyOrder = ['US-1-1', 'US-1-2', 'US-2-1', 'US-3-1', 'US-5-1', 'US-4-1', 'US-4-2', 'US-4-3'];
  const storyEpic = {
    'US-1-1': 'E1',
    'US-1-2': 'E1',
    'US-2-1': 'E2',
    'US-3-1': 'E3',
    'US-4-1': 'E4',
    'US-4-2': 'E4',
    'US-4-3': 'E4',
    'US-5-1': 'E5',
  };
  const storyDepends = {
    'US-1-2': ['US-1-1'],
    'US-5-1': ['US-3-1'],
  };

  for (const sk of storyOrder) {
    const file = join(storyDir, `${sk}-*.md`);
    const matches = listMdFiles(storyDir, new RegExp(`^${sk}-`));
    if (!matches.length) continue;
    const path = matches[0];
    const md = readText(path);
    const epic = storyEpic[sk];
    const status = epic === 'E4' ? 'deferred' : inferStatusFromMarkdown(md, sk === 'US-5-1' ? 'todo' : 'done');
    items.push(
      baseItem({
        workKey: sk,
        type: 'story',
        title: titleFromStoryFile(md, sk),
        source: path,
        status,
        phase: status === 'done' ? 'Done' : 'Implementation',
        parentWorkKey: epic,
        dependsOn: storyDepends[sk],
      }),
    );
  }

  return items;
}

function extractWebclient() {
  const taskFile = join(WORK_ITEMS, 'adventure-webclient/task.md');
  const md = readText(taskFile);
  const items = [];
  const phaseRe = /^## Phase (\d+)(?:\s*[—-]\s*([^\n✅]+))?/gim;
  let m;
  while ((m = phaseRe.exec(md)) !== null) {
    const num = Number(m[1]);
    const sectionStart = m.index;
    const next = md.slice(sectionStart + 1).search(/^## Phase /m);
    const section = next >= 0 ? md.slice(sectionStart, sectionStart + 1 + next) : md.slice(sectionStart);
    const done = /✅|\[x\]/i.test(m[0]) || (section.match(/- \[x\]/gi)?.length ?? 0) > 0 && !(section.match(/- \[ \]/g)?.length);
    const status = num === 0 || done ? 'done' : 'todo';
    const subtitle = (m[2] ?? '').trim();
    items.push(
      baseItem({
        workKey: `Phase-${num}`,
        type: 'phase',
        title: `adventure-webclient Phase ${num}${subtitle ? `: ${subtitle}` : ''}`,
        source: taskFile,
        status,
        phase: status === 'done' ? 'Done' : 'Implementation',
        parentWorkKey: 'WEB-EPIC',
        dependsOn: num > 0 ? [`Phase-${num - 1}`] : undefined,
      }),
    );
  }
  return items;
}

function extractNlDeprecation() {
  const taskFile = join(WORK_ITEMS, 'nl-backend-nl-deprecation/task.md');
  const md = readText(taskFile);
  const items = [];
  const phaseRe = /^## Phase ([A-E])\s*[—-]\s*([^\n(]+)/gim;
  let m;
  while ((m = phaseRe.exec(md)) !== null) {
    const letter = m[1];
    const sectionStart = m.index;
    const next = md.slice(sectionStart + 1).search(/^## Phase /m);
    const section = next >= 0 ? md.slice(sectionStart, sectionStart + 1 + next) : md.slice(sectionStart);
    const open = (section.match(/- \[ \]/g) || []).length;
    const closed = (section.match(/- \[x\]/gi) || []).length;
    const status = letter === 'A' || (closed > 0 && open === 0) ? 'done' : 'todo';
    items.push(
      baseItem({
        workKey: `Phase-${letter}`,
        type: 'phase',
        title: `NL deprecation Phase ${letter}: ${m[2].trim()}`,
        source: taskFile,
        status,
        phase: status === 'done' ? 'Done' : 'Implementation',
        parentWorkKey: 'NL-DEP-EPIC',
      }),
    );
  }
  return items;
}

function extractAgentAuthoring() {
  const items = [];
  const epicDir = join(WORK_ITEMS, 'agent-project-authoring/epics');
  const storyDir = join(WORK_ITEMS, 'agent-project-authoring/stories');

  const epicChildren = {
    AP1: ['AP-1-1'],
    AP2: ['AP-2-1'],
    AP3: ['AP-3-1', 'AP-3-2'],
  };

  for (const file of listMdFiles(epicDir, /^AP\d+-/)) {
    const md = readText(file);
    const workKey = basename(file).match(/^(AP\d+)/)[1];
    items.push(
      baseItem({
        workKey,
        type: 'epic',
        title: firstHeading(md),
        source: file,
        status: 'todo',
        phase: 'Foundation',
        parentWorkKey: 'AP-EPIC',
        children: epicChildren[workKey] ?? [],
      }),
    );
  }

  for (const file of listMdFiles(storyDir, /^AP-\d+-\d+-/)) {
    const md = readText(file);
    const workKey = basename(file).match(/^(AP-\d+-\d+)/)[1];
    const parent = workKey.replace(/^AP-(\d+)-.*/, 'AP$1');
    items.push(
      baseItem({
        workKey,
        type: 'story',
        title: titleFromStoryFile(md, workKey),
        source: file,
        status: 'todo',
        phase: 'Implementation',
        parentWorkKey: parent,
      }),
    );
  }

  return items;
}

function extractV2Maintenance() {
  const prep = join(WORK_ITEMS, 'adventure-v2/ux-multidisciplinary-review-prep.md');
  const md = readText(prep);
  const items = [];
  const rowRe = /^\|\s\*\*(U\d+)\*\*\s\|\s([^|]+)\|/gm;
  let m;
  while ((m = rowRe.exec(md)) !== null) {
    const workKey = m[1];
    const name = m[2].trim();
    const rowLine = m[0];
    const status = /Done \(slice|\*\*Done/i.test(rowLine) ? 'done' : workKey === 'U6' || workKey === 'U7' ? 'todo' : 'done';
    items.push(
      baseItem({
        workKey,
        type: 'task',
        title: `adventure-v2 ${workKey}: ${name}`,
        source: prep,
        status,
        phase: status === 'done' ? 'Archive' : 'Implementation',
        projectStatus: status === 'done' ? 'Done' : 'Todo',
        parentWorkKey: 'V2-EPIC',
      }),
    );
  }
  return items;
}

function extractAdventureNlArchive() {
  const dir = join(WORK_ITEMS, 'adventure-nl');
  const items = [];
  for (const file of listMdFiles(dir, /^0\d_/)) {
    const md = readText(file);
    const num = basename(file).match(/^(\d+)/)[1];
    items.push(
      baseItem({
        workKey: `Step-${num}`,
        type: 'task',
        title: firstHeading(md),
        source: file,
        status: 'done',
        phase: 'Archive',
        projectStatus: 'Done',
        parentWorkKey: 'NL-ARCH-EPIC',
      }),
    );
  }
  return items;
}

const EXTRACTORS = {
  'adventure-v3': extractAdventureV3,
  'adventure-webclient': extractWebclient,
  'nl-backend-nl-deprecation': extractNlDeprecation,
  'agent-project-authoring': extractAgentAuthoring,
  'adventure-v2': extractV2Maintenance,
  'adventure-nl': extractAdventureNlArchive,
};

function mergeProgramItems(manifest, programId, extracted) {
  const prog = manifest.programs.find((p) => p.id === programId);
  if (!prog) throw new Error(`Unknown program: ${programId}`);

  const byKey = new Map((prog.items ?? []).map((i) => [i.workKey, i]));
  for (const item of extracted) {
    byKey.set(item.workKey, mergeItem(byKey.get(item.workKey), item));
  }
  prog.items = [...byKey.values()];
}

function seedLedgerFromManifest(manifest) {
  const ledgerPath = join(REPO_ROOT, '.caches/work-registry-ledger.json');
  let ledger = {};
  try {
    ledger = JSON.parse(readText(ledgerPath));
  } catch {
    ledger = {};
  }
  for (const prog of manifest.programs) {
    for (const item of prog.items ?? []) {
      const key = itemKey(prog.id, item.workKey);
      if (item.issue && !ledger[key]?.issue) {
        ledger[key] = { ...(ledger[key] ?? {}), issue: item.issue, programId: prog.id, workKey: item.workKey };
      }
    }
  }
  mkdirSync(join(REPO_ROOT, '.caches'), { recursive: true });
  writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
}

function main() {
  const manifest = loadManifest();

  for (const [programId, fn] of Object.entries(EXTRACTORS)) {
    const extracted = fn();
    if (merge) {
      mergeProgramItems(manifest, programId, extracted);
    }
  }

  if (write) {
    writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
    seedLedgerFromManifest(manifest);
    console.log(`Updated ${relative(REPO_ROOT, MANIFEST_PATH)}`);
  }

  let total = 0;
  for (const prog of manifest.programs) {
    const n = prog.items?.length ?? 0;
    total += n;
    console.log(`  ${prog.id}: ${n} items`);
  }
  console.log(`Total trackable items: ${total}`);
}

main();
