#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getGuideById, listGuides } from '../src/catalog.mjs';
import { searchGuides } from '../src/search-engine.mjs';
import { scanPath } from '../src/legacy-scanner.mjs';

const REPO_SOURCE = 'alexxhumilde/mbd-guidance';
const SKILL_NAME = 'mbd-guidance';

function printHelp() {
  console.log(`mbd-guidance - Modern Discord Bot Guidance & Audit CLI

Usage:
  mbd-guidance search "<query>" [--limit N] [--category <cat>] [--json]
  mbd-guidance retrieve "<id1,id2,...>" [--spill-large]
  mbd-guidance list [--category <cat>] [--json]
  mbd-guidance legacy-scan <path> [--json]
  mbd-guidance install [skills-cli-options]
  mbd-guidance update [skills-cli-options]
  mbd-guidance uninstall [skills-cli-options]
  mbd-guidance --help

Examples:
  mbd-guidance search "components v2 container"
  mbd-guidance retrieve "components-v2-layout,ephemeral-and-defer-lifecycle"
  mbd-guidance list --category security
  mbd-guidance legacy-scan ./src --json
  mbd-guidance install --global --agent claude-code`);
}

function parseFlags(args) {
  const positional = [];
  const flags = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--json' || arg === '--spill-large' || arg === '--help' || arg === '-h') {
      flags[arg.replace(/^--?/, '')] = true;
    } else if (arg === '--limit' || arg === '--category') {
      const next = args[i + 1];
      if (!next || next.startsWith('--')) {
        throw new Error(`Missing value for flag ${arg}`);
      }
      flags[arg.slice(2)] = next;
      i += 1;
    } else {
      positional.push(arg);
    }
  }

  return { positional, flags };
}

function handleSearch(positional, flags) {
  const query = positional.join(' ').trim();
  if (!query) {
    console.error('Error: search requires a non-empty query.');
    process.exit(1);
  }

  const limit = flags.limit ? Number.parseInt(flags.limit, 10) : 5;
  const results = searchGuides(query, {
    limit: Number.isFinite(limit) && limit > 0 ? limit : 5,
    category: flags.category,
  });

  if (flags.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log(JSON.stringify(results.map(({ id, category, title, description }) => ({
    id,
    category,
    title,
    description,
  })), null, 2));
}

function handleRetrieve(positional, flags) {
  const rawIds = positional.join(',').trim();
  if (!rawIds) {
    console.error('Error: retrieve requires one or more guide IDs separated by commas.');
    process.exit(1);
  }

  const ids = rawIds
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  const chunks = [];
  const missing = [];

  for (const id of ids) {
    const guide = getGuideById(id);
    if (!guide) {
      missing.push(id);
      continue;
    }
    chunks.push(
      `<!-- GUIDE: ${guide.id} | CATEGORY: ${guide.category} | API: ${guide.apiVersion} -->\n` +
        `# ${guide.title}\n\n${guide.body}`
    );
  }

  if (missing.length > 0) {
    console.error(`Error: guide(s) not found: ${missing.join(', ')}`);
    process.exit(1);
  }

  const output = chunks.join('\n\n---\n\n');
  if (flags['spill-large'] && Buffer.byteLength(output, 'utf8') > 9500) {
    const tmpFile = path.join(os.tmpdir(), `mbd-guidance-${Date.now()}.md`);
    fs.writeFileSync(tmpFile, output, 'utf8');
    console.log(`Output exceeded 9.5 KB and was written to: ${tmpFile}`);
    return;
  }

  console.log(output);
}

function handleList(flags) {
  const guides = listGuides({ category: flags.category });
  if (flags.json) {
    console.log(JSON.stringify(guides, null, 2));
    return;
  }

  if (guides.length === 0) {
    console.log('No guides matched the filter.');
    return;
  }

  let currentCategory = '';
  for (const guide of guides) {
    if (guide.category !== currentCategory) {
      currentCategory = guide.category;
      console.log(`\n[${currentCategory}]`);
    }
    console.log(`  - ${guide.id}: ${guide.description}`);
  }
}

function handleLegacyScan(positional, flags) {
  const target = positional[0] || '.';
  const result = scanPath(target);

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Scanned ${result.filesScanned} file(s) in "${result.target}". Findings: ${result.findingsCount}`);
  for (const finding of result.findings) {
    console.log(
      `\n[${finding.severity.toUpperCase()}] ${finding.ruleId} (${finding.guideId}) - ${finding.file}:${finding.line}`
    );
    console.log(`  Snippet: ${finding.snippet}`);
    console.log(`  Fix: ${finding.replacement}`);
    console.log(`  keepWhen: ${finding.keepWhen}`);
    console.log(`  dropWhen: ${finding.dropWhen}`);
  }
}

/**
 * Forward install, update, and uninstall commands to the official Vercel Skills CLI (`npx -y skills`).
 * @param {string[]} subcommandArgs
 */
function runSkillsCli(subcommandArgs) {
  const isWin = process.platform === 'win32';
  const result = spawnSync('npx', ['-y', 'skills', ...subcommandArgs], {
    stdio: 'inherit',
    shell: isWin,
  });

  if (result.error) {
    console.error(`Failed to execute npx skills: ${result.error.message}`);
    process.exit(1);
  }

  process.exit(result.status ?? 0);
}

/**
 * Entrypoint for the MBD Guidance CLI.
 * @param {string[]} [argv]
 */
export function runCli(argv = process.argv.slice(2)) {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === 'install' || command === 'update' || command === 'uninstall') {
    if (rest.includes('--help') || rest.includes('-h')) {
      printHelp();
      return;
    }

    if (command === 'install') {
      const extraArgs = rest.filter((arg) => arg !== '--choose');
      const baseArgs = rest.includes('--choose')
        ? ['add', REPO_SOURCE]
        : ['add', REPO_SOURCE, '--skill', SKILL_NAME];
      runSkillsCli([...baseArgs, ...extraArgs]);
      return;
    }

    if (command === 'update') {
      runSkillsCli(['update', SKILL_NAME, ...rest]);
      return;
    }

    runSkillsCli(['remove', SKILL_NAME, ...rest]);
    return;
  }

  try {
    const { positional, flags } = parseFlags(rest);
    if (flags.help || flags.h) {
      printHelp();
      return;
    }

    switch (command) {
      case 'search':
        handleSearch(positional, flags);
        break;
      case 'retrieve':
        handleRetrieve(positional, flags);
        break;
      case 'list':
        handleList(flags);
        break;
      case 'legacy-scan':
        handleLegacyScan(positional, flags);
        break;
      default:
        console.error(`Unknown command: ${command}\n`);
        printHelp();
        process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

const isDirectExecution =
  Boolean(process.argv[1]) &&
  pathToFileURL(fs.realpathSync(path.resolve(process.argv[1]))).href === import.meta.url;

if (isDirectExecution) {
  runCli();
}
