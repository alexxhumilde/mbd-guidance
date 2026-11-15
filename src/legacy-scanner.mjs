import fs from 'node:fs';
import path from 'node:path';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
]);

const SCANNABLE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx']);

/**
 * Deterministic legacy & security ruleset for Discord bots.
 */
export const LEGACY_RULES = [
  {
    ruleId: 'MBD001',
    severity: 'error',
    guideId: 'v13-to-v14-modernization',
    description: 'Legacy discord.js v13 constructors (MessageEmbed, MessageActionRow, MessageButton, MessageSelectMenu).',
    replacement: 'Migrate to v14 builders (EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder) or Components V2 (ContainerBuilder, TextDisplayBuilder).',
    keepWhen: 'The project targets discord.js v14+ or is being modernized.',
    dropWhen: 'package.json intentionally pins discord.js v13 with no migration plan, or it is a compatibility wrapper.',
    matchLine: (line) =>
      /\bnew\s+(MessageEmbed|MessageActionRow|MessageButton|MessageSelectMenu)\s*\(/.test(line),
  },
  {
    ruleId: 'MBD002',
    severity: 'warning',
    guideId: 'ephemeral-and-defer-lifecycle',
    description: 'Deprecated `ephemeral: true` option in discord.js v14.16+ and Discord API v10.',
    replacement: 'Replace `ephemeral: true` with `flags: MessageFlags.Ephemeral` (imported from `discord.js` or `discord-api-types/v10`).',
    keepWhen: 'Passed to reply(), deferReply(), followUp(), or interaction response payloads.',
    dropWhen: 'It is an internal application state key not sent to the Discord API.',
    matchLine: (line) => /\bephemeral\s*:\s*true\b/.test(line),
  },
  {
    ruleId: 'MBD003',
    severity: 'warning',
    guideId: 'v13-to-v14-modernization',
    description: 'Event listener registered with literal strings or legacy event names (`message`, `ready`).',
    replacement: 'Use the `Events` enum (`Events.MessageCreate`, `Events.ClientReady`, `Events.InteractionCreate`).',
    keepWhen: 'The listener is attached to a discord.js `Client` instance.',
    dropWhen: 'The receiver is a Node.js EventEmitter, custom WebSocket, or logger.',
    matchLine: (line) =>
      /\.\s*(?:on|once)\s*\(\s*['"](?:message|ready|messageCreate|interactionCreate)['"]\s*,/.test(line),
  },
  {
    ruleId: 'MBD004',
    severity: 'error',
    guideId: 'v13-to-v14-modernization',
    description: 'Legacy `Intents.FLAGS.*`, `Permissions.FLAGS.*`, or magic numeric bitfields in intents.',
    replacement: 'Replace with `GatewayIntentBits.*` and `PermissionFlagsBits.*`.',
    keepWhen: 'Configures Discord gateway intents or permissions.',
    dropWhen: 'Appears in migration docs or non-Discord bitmask logic.',
    matchLine: (line) =>
      /\b(?:Intents|Permissions)\.FLAGS\.\w+|\bintents\s*:\s*\[\s*\d{3,}/.test(line),
  },
  {
    ruleId: 'MBD005',
    severity: 'warning',
    guideId: 'slash-commands-and-options',
    description: 'Deprecated `setDMPermission()` or `dm_permission` in Slash Commands (replaced by Interaction Contexts in API v10).',
    replacement: 'Use `.setContexts(InteractionContextType.Guild)` and `.setIntegrationTypes(...)` on SlashCommandBuilder.',
    keepWhen: 'Defines command availability across guilds vs DMs.',
    dropWhen: 'The project is pinned to discord.js < 14.15 without `InteractionContextType`.',
    matchLine: (line) => /\.setDMPermission\s*\(|\bdm_permission\s*:/.test(line),
  },
  {
    ruleId: 'MBD006',
    severity: 'warning',
    guideId: 'prefix-to-interactions',
    description: 'Prefix text command parsing on `message.content` (requires the privileged MessageContent intent).',
    replacement: 'Migrate to Slash Commands (`SlashCommandBuilder` / `ChatInputCommandInteraction`) or Context Menus.',
    keepWhen: 'Implements user-invoked commands triggered by a text prefix (e.g., `!help`, `?ban`).',
    dropWhen: 'It is a legitimate automod content filter or an explicit conversational chat bot.',
    matchLine: (line) =>
      /\bmessage\.content\s*\.\s*(?:startsWith|slice|trim)\s*\(/.test(line) ||
      /\bconst\s+args\s*=\s*message\.content\b/.test(line),
  },
  {
    ruleId: 'MBD007',
    severity: 'warning',
    guideId: 'permissions-and-mention-safety',
    description: 'Requiring `Administrator` in command default permissions or authorization checks.',
    replacement: 'Apply least privilege with granular permissions (`PermissionFlagsBits.ModerateMembers`, `ManageMessages`, etc.).',
    keepWhen: 'Guards moderation or configuration commands that do not need full server administration.',
    dropWhen: 'The command strictly handles high-risk server-owner security settings.',
    matchLine: (line) =>
      /\bPermissionFlagsBits\.Administrator\b|\bPermissions\.FLAGS\.ADMINISTRATOR\b/.test(line),
  },
  {
    ruleId: 'MBD008',
    severity: 'warning',
    guideId: 'permissions-and-mention-safety',
    description: 'Potentially dynamic message/reply or `new Client()` instantiation without `allowedMentions` configured.',
    replacement: 'Set `allowedMentions: { parse: [\'users\'], repliedUser: false }` or `{ parse: [] }` on `Client` or per message.',
    keepWhen: 'The response interpolates untrusted user input (`args`, display names, modal fields).',
    dropWhen: '`allowedMentions` is already configured globally on the `Client` instance at startup.',
    matchFile: (content, lines) => {
      if (/\ballowedMentions\b/.test(content)) {
        return [];
      }
      const hits = [];
      const dynamicSendRegex = /\.(?:reply|send|followUp|editReply)\s*\(\s*(?:`[^`]*\$\{|\{[^}]*content\s*:\s*(?:`[^`]*\$\{|[^'"`\s}][^}]*))/;
      lines.forEach((line, idx) => {
        if (dynamicSendRegex.test(line)) {
          hits.push({ line: idx + 1, column: 1, snippet: line.trim() });
        }
      });
      if (hits.length === 0) {
        lines.forEach((line, idx) => {
          if (/\bnew\s+Client\s*\(/.test(line)) {
            hits.push({ line: idx + 1, column: 1, snippet: line.trim() });
          }
        });
      }
      return hits;
    },
  },
  {
    ruleId: 'MBD009',
    severity: 'error',
    guideId: 'http-interactions-ed25519',
    description: 'Discord HTTP Interactions endpoint missing Ed25519 cryptographic signature verification.',
    replacement: 'Verify `X-Signature-Ed25519` and `X-Signature-Timestamp` against raw body bytes before parsing or handling `PING` (`type: 1`).',
    keepWhen: 'The file exposes an HTTP webhook endpoint receiving Discord interactions.',
    dropWhen: 'Ed25519 signature verification already runs in an upstream router middleware.',
    matchFile: (content, lines) => {
      const looksLikeHttpInteraction =
        (/\bInteractionType\.Ping\b/.test(content) ||
          /\b(?:body|payload|interaction)\.type\s*===?\s*1\b/.test(content)) &&
        (/request|req|Request|headers/i.test(content));

      const hasVerification =
        /\bEd25519\b/i.test(content) ||
        /\bverifyKey\b/.test(content) ||
        /\bnacl\.sign\.detached\.verify\b/.test(content) ||
        /X-Signature-Ed25519/i.test(content);

      if (!looksLikeHttpInteraction || hasVerification) {
        return [];
      }

      const lineIdx = lines.findIndex(
        (line) =>
          /\bInteractionType\.Ping\b/.test(line) ||
          /\b(?:body|payload|interaction)\.type\s*===?\s*1\b/.test(line)
      );

      return lineIdx >= 0
        ? [{ line: lineIdx + 1, column: 1, snippet: lines[lineIdx].trim() }]
        : [];
    },
  },
  {
    ruleId: 'MBD010',
    severity: 'error',
    guideId: 'permissions-and-mention-safety',
    description: 'Potential hardcoded Discord bot token in source code.',
    replacement: 'Load the token from environment variables (`process.env.DISCORD_TOKEN`) or runtime secrets.',
    keepWhen: 'Contains a literal token string in `client.login(...)` or a real Discord token pattern.',
    dropWhen: 'It is an explicit fake placeholder inside unit tests or test fixtures.',
    matchLine: (line) =>
      /\.\s*login\s*\(\s*['"][A-Za-z0-9_.-]{20,}['"]\s*\)/.test(line) ||
      /['"][A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{20,}['"]/.test(line),
  },
  {
    ruleId: 'MBD011',
    severity: 'error',
    guideId: 'oauth2-dashboard-guild-auth',
    description: 'Public client-side environment variable exposing a Discord bot token (`NEXT_PUBLIC_*`, `VITE_*`, `REACT_APP_*`).',
    replacement: 'Keep `DISCORD_TOKEN` exclusively in server-side modules and private environment variables without public browser prefixes.',
    keepWhen: 'References a bot or Discord secret token with a public bundler prefix.',
    dropWhen: 'It holds a non-secret public Discord Client ID / Application ID rather than a bot token.',
    matchLine: (line) =>
      /\b(?:NEXT_PUBLIC|VITE|REACT_APP|PUBLIC)_(?:DISCORD_)?(?:BOT_)?TOKEN\b/.test(line),
  },
  {
    ruleId: 'MBD012',
    severity: 'warning',
    guideId: 'oauth2-dashboard-guild-auth',
    description: '32-bit bitwise permission check on `guild.permissions` (corrupts Discord 64-bit permission flags >= 1 << 31).',
    replacement: 'Use `BigInt(guild.permissions) & PermissionFlagsBits.ManageGuild` instead of 32-bit integer bitwise operations.',
    keepWhen: 'Evaluates Discord OAuth2 guild permission bitfields in a web dashboard backend.',
    dropWhen: 'Operates on a custom non-Discord 16/32-bit internal flag structure.',
    matchLine: (line) =>
      /\bguild\.permissions\s*&\s*(?:0x[0-9a-fA-F]+|\d+)|\b(?:Number|parseInt)\s*\(\s*guild\.permissions[^)]*\)\s*&/.test(
        line
      ),
  },
];

/**
 * Strip single-line comments trivially for line-level regex matching.
 * @param {string} line
 * @returns {boolean}
 */
function isCommentLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
}

/**
 * Collect scannable source files from a file or directory path.
 * @param {string} targetPath
 * @returns {string[]}
 */
function collectSourceFiles(targetPath) {
  const resolved = path.resolve(targetPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Target path does not exist: ${targetPath}`);
  }

  const stat = fs.statSync(resolved);
  if (stat.isFile()) {
    return SCANNABLE_EXTENSIONS.has(path.extname(resolved).toLowerCase()) ? [resolved] : [];
  }

  const collected = [];
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          walk(path.join(dir, entry.name));
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SCANNABLE_EXTENSIONS.has(ext)) {
          collected.push(path.join(dir, entry.name));
        }
      }
    }
  }
  walk(resolved);
  return collected;
}

/**
 * Scan a file or directory for legacy Discord bot patterns and security anti-patterns.
 * @param {string} targetPath
 * @returns {{
 *   target: string,
 *   filesScanned: number,
 *   findingsCount: number,
 *   findings: Array<{
 *     ruleId: string,
 *     severity: string,
 *     guideId: string,
 *     file: string,
 *     line: number,
 *     column: number,
 *     snippet: string,
 *     description: string,
 *     replacement: string,
 *     keepWhen: string,
 *     dropWhen: string
 *   }>
 * }}
 */
export function scanPath(targetPath) {
  const resolvedRoot = path.resolve(targetPath);
  const files = collectSourceFiles(resolvedRoot);
  const findings = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const relativeFile =
      files.length === 1 && fs.statSync(resolvedRoot).isFile()
        ? path.basename(filePath)
        : path.relative(resolvedRoot, filePath).replaceAll('\\', '/');

    for (const rule of LEGACY_RULES) {
      if (typeof rule.matchFile === 'function') {
        const fileHits = rule.matchFile(content, lines);
        for (const hit of fileHits) {
          findings.push({
            ruleId: rule.ruleId,
            severity: rule.severity,
            guideId: rule.guideId,
            file: relativeFile,
            line: hit.line,
            column: hit.column,
            snippet: hit.snippet,
            description: rule.description,
            replacement: rule.replacement,
            keepWhen: rule.keepWhen,
            dropWhen: rule.dropWhen,
          });
        }
      } else if (typeof rule.matchLine === 'function') {
        lines.forEach((line, idx) => {
          if (!isCommentLine(line) && rule.matchLine(line)) {
            findings.push({
              ruleId: rule.ruleId,
              severity: rule.severity,
              guideId: rule.guideId,
              file: relativeFile,
              line: idx + 1,
              column: Math.max(1, line.search(/\S/) + 1),
              snippet: line.trim(),
              description: rule.description,
              replacement: rule.replacement,
              keepWhen: rule.keepWhen,
              dropWhen: rule.dropWhen,
            });
          }
        });
      }
    }
  }

  findings.sort(
    (a, b) =>
      a.file.localeCompare(b.file) || a.line - b.line || a.ruleId.localeCompare(b.ruleId)
  );

  return {
    target: targetPath,
    filesScanned: files.length,
    findingsCount: findings.length,
    findings,
  };
}
