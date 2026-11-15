import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getGuideById, listGuides, loadCatalog } from '../src/catalog.mjs';
import { searchGuides } from '../src/search-engine.mjs';
import { LEGACY_RULES, scanPath } from '../src/legacy-scanner.mjs';
import { validateAuditReport } from '../scripts/validate-audit-report.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CLI_PATH = path.join(REPO_ROOT, 'bin', 'mbd-guidance.mjs');
const SKILL_DIR = path.join(REPO_ROOT, 'skills', 'mbd-guidance');
const SKILL_CLI_PATH = path.join(SKILL_DIR, 'scripts', 'mbd-guidance.mjs');
const SKILL_VALIDATOR_PATH = path.join(SKILL_DIR, 'scripts', 'validate-audit-report.mjs');

test('catalog loads all 13 guides with valid frontmatter', () => {
  const catalog = loadCatalog();
  assert.equal(catalog.length, 13);

  for (const guide of catalog) {
    assert.ok(guide.id.length > 0, 'guide id must be non-empty');
    assert.ok(guide.title.length > 0, 'guide title must be non-empty');
    assert.ok(guide.category.length > 0, 'guide category must be non-empty');
    assert.ok(guide.description.length > 10, `guide ${guide.id} needs description`);
    assert.ok(guide.body.length > 100, `guide ${guide.id} body is too short`);
  }
});

test('listGuides filters cleanly by category', () => {
  const securityGuides = listGuides({ category: 'security' });
  assert.equal(securityGuides.length, 2);
  assert.deepEqual(
    securityGuides.map((g) => g.id).sort(),
    ['http-interactions-ed25519', 'permissions-and-mention-safety']
  );

  const webGuides = listGuides({ category: 'web-integration' });
  assert.equal(webGuides.length, 3);
  assert.deepEqual(
    webGuides.map((g) => g.id).sort(),
    ['oauth2-dashboard-guild-auth', 'web-bot-sync-and-ipc', 'web-discord-rest-caching']
  );
});

test('searchGuides ranks expected guides in top results', () => {
  const queries = [
    ['components v2 container', 'components-v2-layout'],
    ['http interactions ed25519 signature', 'http-interactions-ed25519'],
    ['ephemeral defer 3 second timeout', 'ephemeral-and-defer-lifecycle'],
    ['sharding memory cache sweepers', 'cache-sweepers-and-sharding'],
    ['v13 MessageEmbed migration', 'v13-to-v14-modernization'],
    ['nextjs oauth2 dashboard guild permissions', 'oauth2-dashboard-guild-auth'],
    ['sync web dashboard bot redis ipc', 'web-bot-sync-and-ipc'],
    ['cache discord rest channels web', 'web-discord-rest-caching'],
    ['modal file upload label builder', 'modals-and-autocomplete'],
  ];

  for (const [query, expectedId] of queries) {
    const results = searchGuides(query, { limit: 3 });
    assert.ok(results.length > 0, `expected results for "${query}"`);
    const topIds = results.map((r) => r.id);
    assert.ok(
      topIds.includes(expectedId),
      `expected "${expectedId}" in top-3 for "${query}", got ${JSON.stringify(topIds)}`
    );
  }
});

test('getGuideById retrieves full guide by id or category/id slug', () => {
  const byId = getGuideById('components-v2-layout');
  assert.ok(byId);
  assert.match(byId.body, /MessageFlags\.IsComponentsV2/);

  const bySlug = getGuideById('security/http-interactions-ed25519');
  assert.ok(bySlug);
  assert.equal(bySlug.id, 'http-interactions-ed25519');
});

test('legacy-scanner detects MBD001-MBD013 and spares clean modern code', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbd-scan-test-'));

  try {
    const legacyBotFile = path.join(tmpDir, 'legacy-bot.js');
    fs.writeFileSync(
      legacyBotFile,
      `
const { Client, Intents, MessageEmbed, MessageActionRow, MessageButton, PermissionFlagsBits } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

client.on('ready', () => console.log('online'));
client.on('message', async (message) => {
  if (message.content.startsWith('!ping')) {
    const args = message.content.slice(5);
    const pins = await message.channel.messages.fetchPinned();
    const embed = new MessageEmbed().setTitle(\`Pong \${pins.size}\`);
    const row = new MessageActionRow().addComponents(new MessageButton());
    await message.reply(\`Pong \${args}\`);
  }
});

const slash = { dm_permission: false, default_member_permissions: PermissionFlagsBits.Administrator };
async function onInteraction(interaction) {
  await interaction.reply({ content: 'ok', ephemeral: true });
}
client.login('FakeTokenForUnitTest123456.AbCdEf.GhIjKlMnOpQrStUvWxYz123456');
`,
      'utf8'
    );

    const badHttpFile = path.join(tmpDir, 'http-endpoint.js');
    fs.writeFileSync(
      badHttpFile,
      `
export async function POST(request) {
  const body = await request.json();
  if (body.type === 1) {
    return Response.json({ type: 1 });
  }
  return Response.json({ type: 4, data: { content: 'hi' } });
}
`,
      'utf8'
    );

    const badDashboardFile = path.join(tmpDir, 'dashboard-auth.js');
    fs.writeFileSync(
      badDashboardFile,
      `
const leakedEnv = process.env.NEXT_PUBLIC_DISCORD_TOKEN;
export function hasManageGuild(guild) {
  return (guild.permissions & 0x20) === 0x20;
}
`,
      'utf8'
    );

    const cleanFile = path.join(tmpDir, 'clean-bot.mjs');
    fs.writeFileSync(
      cleanFile,
      `
import { Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  allowedMentions: { parse: ['users'], repliedUser: false },
});
client.once(Events.ClientReady, () => console.log('clean'));
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  await interaction.reply({ content: 'ok', flags: MessageFlags.Ephemeral });
});
client.login(process.env.DISCORD_TOKEN);
`,
      'utf8'
    );

    const result = scanPath(tmpDir);
    assert.equal(result.filesScanned, 4);

    const foundRules = new Set(result.findings.map((f) => f.ruleId));
    for (const rule of LEGACY_RULES) {
      assert.ok(foundRules.has(rule.ruleId), `expected rule ${rule.ruleId} to be triggered`);
    }

    for (const finding of result.findings) {
      assert.ok(finding.keepWhen.length > 0);
      assert.ok(finding.dropWhen.length > 0);
      assert.ok(getGuideById(finding.guideId), `invalid guideId ${finding.guideId}`);
      assert.notEqual(finding.file, 'clean-bot.mjs', `clean file should have 0 findings, got ${finding.ruleId}`);
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('validateAuditReport accepts valid report and rejects invalid reports', () => {
  const validReport = {
    schemaVersion: '1.0.0',
    botName: 'example-discord-bot',
    ecosystem: 'http-interactions',
    auditedAt: '2026-11-14T14:00:00.000Z',
    coverage: ['interactions/http-handler', 'commands/moderation'],
    findings: [
      {
        id: 'F-001',
        severity: 'critical',
        status: 'confirmed',
        category: 'security',
        title: 'Missing Ed25519 signature check on interaction webhook',
        trustBoundary: 'unauthenticated HTTP caller -> interaction dispatcher',
        evidence: {
          file: 'src/app/api/discord/route.ts',
          line: 14,
          snippet: 'if (body.type === 1) return Response.json({ type: 1 });',
        },
        remediation: 'Verify X-Signature-Ed25519 and X-Signature-Timestamp over raw body bytes.',
        guideId: 'http-interactions-ed25519',
      },
    ],
  };

  assert.deepEqual(validateAuditReport(validReport), { valid: true, errors: [] });

  const invalidReport = {
    ...validReport,
    ecosystem: 'unknown-runtime',
    findings: [
      {
        ...validReport.findings[0],
        id: 'BAD-ID',
        guideId: 'non-existent-guide',
      },
    ],
  };

  const invalidResult = validateAuditReport(invalidReport);
  assert.equal(invalidResult.valid, false);
  assert.ok(invalidResult.errors.length >= 3);
});

test('CLI commands list, search, retrieve, and legacy-scan execute cleanly', () => {
  const listOut = execFileSync(process.execPath, [CLI_PATH, 'list', '--json'], {
    encoding: 'utf8',
  });
  const listed = JSON.parse(listOut);
  assert.equal(listed.length, 13);

  const searchOut = execFileSync(process.execPath, [CLI_PATH, 'search', 'components v2 container'], {
    encoding: 'utf8',
  });
  const searched = JSON.parse(searchOut);
  assert.equal(searched[0].id, 'components-v2-layout');

  const retrieveOut = execFileSync(process.execPath, [CLI_PATH, 'retrieve', 'components-v2-layout'], {
    encoding: 'utf8',
  });
  assert.match(retrieveOut, /ContainerBuilder/);
});

test('self-contained skill scripts run cleanly from an external workspace copy (npx skills simulation)', () => {
  const tmpWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'mbd-standalone-skill-'));

  try {
    const copiedSkillDir = path.join(tmpWorkspace, '.agents', 'skills', 'mbd-guidance');
    fs.cpSync(SKILL_DIR, copiedSkillDir, { recursive: true });

    const copiedCli = path.join(copiedSkillDir, 'scripts', 'mbd-guidance.mjs');
    const copiedValidator = path.join(copiedSkillDir, 'scripts', 'validate-audit-report.mjs');

    const botSamplePath = path.join(tmpWorkspace, 'bot.js');
    fs.writeFileSync(
      botSamplePath,
      'const { MessageEmbed } = require("discord.js");\nconst e = new MessageEmbed();\n',
      'utf8'
    );

    const listOut = execFileSync(process.execPath, [copiedCli, 'list', '--json'], {
      cwd: tmpWorkspace,
      encoding: 'utf8',
    });
    assert.equal(JSON.parse(listOut).length, 13);

    const searchOut = execFileSync(process.execPath, [copiedCli, 'search', 'oauth2 dashboard'], {
      cwd: tmpWorkspace,
      encoding: 'utf8',
    });
    assert.equal(JSON.parse(searchOut)[0].id, 'oauth2-dashboard-guild-auth');

    const retrieveOut = execFileSync(process.execPath, [copiedCli, 'retrieve', 'web-bot-sync-and-ipc'], {
      cwd: tmpWorkspace,
      encoding: 'utf8',
    });
    assert.match(retrieveOut, /timingSafeEqual/);

    const scanOut = execFileSync(process.execPath, [copiedCli, 'legacy-scan', botSamplePath, '--json'], {
      cwd: tmpWorkspace,
      encoding: 'utf8',
    });
    const scanData = JSON.parse(scanOut);
    assert.equal(scanData.findings[0].ruleId, 'MBD001');

    const findingsFile = path.join(tmpWorkspace, 'findings.json');
    fs.writeFileSync(
      findingsFile,
      JSON.stringify({
        schemaVersion: '1.0.0',
        botName: 'standalone-test-bot',
        ecosystem: 'gateway',
        auditedAt: '2026-11-14T18:40:00.000Z',
        coverage: ['legacy-bot/commands'],
        findings: [
          {
            id: 'F-001',
            severity: 'low',
            status: 'confirmed',
            category: 'legacy-migration',
            title: 'Legacy MessageEmbed constructor in standalone test',
            trustBoundary: 'bot-builder -> discord-gateway',
            evidence: { file: 'bot.js', line: 2, snippet: 'const e = new MessageEmbed();' },
            remediation: 'Replace MessageEmbed with EmbedBuilder or Components V2 ContainerBuilder.',
            guideId: 'v13-to-v14-modernization',
          },
        ],
      }),
      'utf8'
    );

    const validatorOut = execFileSync(process.execPath, [copiedValidator, findingsFile], {
      cwd: tmpWorkspace,
      encoding: 'utf8',
    });
    assert.match(validatorOut, /Audit report valid/);
  } finally {
    fs.rmSync(tmpWorkspace, { recursive: true, force: true });
  }
});

test('all multi-agent plugin and marketplace manifests are valid JSON', () => {
  const manifestPaths = [
    'plugin.json',
    'gemini-extension.json',
    'kimi.plugin.json',
    '.agents/plugins/marketplace.json',
    '.claude-plugin/plugin.json',
    '.claude-plugin/marketplace.json',
    '.codex-plugin/plugin.json',
    '.cursor-plugin/plugin.json',
    '.github/plugin/plugin.json',
    '.grok-plugin/marketplace.json',
    'skills/mbd-guidance/schemas/audit-report.schema.json',
  ];

  for (const relPath of manifestPaths) {
    const absPath = path.join(REPO_ROOT, relPath);
    assert.ok(fs.existsSync(absPath), `expected manifest ${relPath} to exist`);
    const parsed = JSON.parse(fs.readFileSync(absPath, 'utf8'));
    assert.ok(parsed && typeof parsed === 'object', `expected ${relPath} to parse to an object`);
  }

  assert.ok(
    fs.existsSync(path.join(REPO_ROOT, 'policies', 'mbd-guidance.toml')),
    'expected Gemini CLI policy file to exist'
  );
  assert.ok(fs.existsSync(SKILL_CLI_PATH));
  assert.ok(fs.existsSync(SKILL_VALIDATOR_PATH));
});
