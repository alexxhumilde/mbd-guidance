# MBD Guidance — Modern Discord Bot Guidance & Audit Skill

**MBD Guidance** is a zero-dependency local CLI and hybrid AI agent skill focused on modern development, legacy migration, and security/architecture audits for **Discord bots** (`discord.js` v14+, `@discordjs/rest`, and **Serverless HTTP Interactions** on Cloudflare Workers / Next.js).

It combines two proven architectures:
1. **`googlechrome/modern-web-guidance` pattern**: Offline CLI with weighted BM25 search (`search`), full guide retrieval (`retrieve`), catalog listing (`list`), and static anti-pattern scanning (`legacy-scan`) with `keepWhen` / `dropWhen` triage rubrics.
2. **`cloudflare/security-audit-skill` pattern**: A structured [SKILL.md](skills/mbd-guidance/SKILL.md) with three operating modes (*Guidance*, *Legacy Modernization*, and *Full Bot Audit*), domain playbooks, and a deterministic audit report validator ([scripts/validate-audit-report.mjs](scripts/validate-audit-report.mjs)).

---

## Project Architecture

```text
├── bin/mbd-guidance.mjs             # Main CLI (search, retrieve, list, legacy-scan)
├── src/
│   ├── catalog.mjs                  # Recursive Markdown guide loader & frontmatter parser
│   ├── search-engine.mjs            # Weighted BM25 ranking + Discord domain synonyms
│   └── legacy-scanner.mjs           # Static scanner with 10 deterministic rules (MBD001–MBD010)
├── scripts/
│   └── validate-audit-report.mjs    # Deterministic validator for findings.json audit reports
├── schemas/
│   └── audit-report.schema.json     # JSON Schema contract for audit reports
├── skills/mbd-guidance/
│   ├── SKILL.md                     # Agent instructions & operating modes
│   ├── playbooks/                   # Audit & domain review checklists
│   └── guides/                      # 13 curated Discord API v10 technical guides
├── plugin.json                      # Plugin manifest (Antigravity / Marketplace)
├── gemini-extension.json            # Gemini CLI extension manifest
└── tests/mbd-guidance.test.mjs      # Test suite powered by node:test
```

---

## CLI Usage

Requires **Node.js >= 20** (zero external dependencies in `node_modules`).

```sh
# List all guides grouped by category
node ./bin/mbd-guidance.mjs list

# Search guides
node ./bin/mbd-guidance.mjs search "components v2 container"
node ./bin/mbd-guidance.mjs search "serverless ed25519 signature"

# Retrieve one or more full guides
node ./bin/mbd-guidance.mjs retrieve "components-v2-layout,ephemeral-and-defer-lifecycle"

# Scan an existing bot for legacy patterns or security risks
node ./bin/mbd-guidance.mjs legacy-scan ./path-to-bot --json

# Validate a full audit report
node ./scripts/validate-audit-report.mjs ./findings.json
```

---

## Guide Catalog (13)

| Category | ID | Topic |
| :--- | :--- | :--- |
| `ui-components` | `components-v2-layout` | `MessageFlags.IsComponentsV2`, `ContainerBuilder`, `SectionBuilder`, `TextDisplayBuilder`, 40-component cap |
| `ui-components` | `slash-commands-and-options` | `SlashCommandBuilder`, `InteractionContextType`, `ApplicationIntegrationType`, idempotent REST sync |
| `ui-components` | `modals-and-autocomplete` | `ModalBuilder` (5-row cap), `showModal()` without prior defer, `isAutocomplete()` < 500 ms |
| `ui-components` | `ephemeral-and-defer-lifecycle` | 3-second deadline (`10062`), `MessageFlags.Ephemeral`, `deferReply` vs `deferUpdate` |
| `ui-components` | `stateful-custom-ids-and-pagination` | Structured `custom_id` (`<= 100` chars), `ownerId` validation, clean collector timeouts |
| `legacy-migration` | `v13-to-v14-modernization` | Full v12/v13 -> v14.16+ equivalence table (`EmbedBuilder`, `GatewayIntentBits`, `Events`, `ChannelType`) |
| `legacy-migration` | `prefix-to-interactions` | Migrating `!prefix` commands and dropping privileged `MessageContent` intent |
| `security` | `http-interactions-ed25519` | Web Crypto Ed25519 verification over `rawBody`, `PING` handling, serverless `waitUntil()` |
| `security` | `permissions-and-mention-safety` | `allowedMentions`, moderation role hierarchy, least privilege, `guildId` tenant isolation |
| `architecture` | `cache-sweepers-and-sharding` | `Options.cacheWithLimits`, `sweepers`, non-blocking event loop, `ShardingManager` |
| `web-integration` | `oauth2-dashboard-guild-auth` | OAuth2 `identify` + `guilds`, 64-bit `BigInt` `ManageGuild` checks, IDOR prevention |
| `web-integration` | `web-bot-sync-and-ipc` | Shared DB + Redis Pub/Sub invalidation or `timingSafeEqual` loopback HTTP IPC |
| `web-integration` | `web-discord-rest-caching` | `@discordjs/rest` channel/role loaders, DTO sanitization, TTL cache & deduplication |

---

## `legacy-scan` Rules (MBD001 – MBD012)

| Rule | Severity | Detects | Guide |
| :--- | :--- | :--- | :--- |
| `MBD001` | `error` | v13 constructors (`MessageEmbed`, `MessageActionRow`, `MessageButton`, `MessageSelectMenu`) | `v13-to-v14-modernization` |
| `MBD002` | `warning` | Deprecated `ephemeral: true` instead of `flags: MessageFlags.Ephemeral` | `ephemeral-and-defer-lifecycle` |
| `MBD003` | `warning` | Event listeners using literal strings or legacy names (`'message'`, `'ready'`) | `v13-to-v14-modernization` |
| `MBD004` | `error` | `Intents.FLAGS.*`, `Permissions.FLAGS.*`, or magic numeric intent bitfields | `v13-to-v14-modernization` |
| `MBD005` | `warning` | Deprecated `.setDMPermission()` / `dm_permission` instead of `setContexts()` | `slash-commands-and-options` |
| `MBD006` | `warning` | Prefix command parsing over `message.content` | `prefix-to-interactions` |
| `MBD007` | `warning` | Broad `PermissionFlagsBits.Administrator` checks or defaults | `permissions-and-mention-safety` |
| `MBD008` | `warning` | Dynamic replies or `new Client()` missing `allowedMentions` configuration | `permissions-and-mention-safety` |
| `MBD009` | `error` | HTTP Interactions handlers (`type === 1` / `InteractionType.Ping`) missing Ed25519 verification | `http-interactions-ed25519` |
| `MBD010` | `error` | Potential hardcoded bot tokens in source code | `permissions-and-mention-safety` |
| `MBD011` | `error` | Public frontend env vars (`NEXT_PUBLIC_*`, `VITE_*`, `REACT_APP_*`) exposing bot tokens | `oauth2-dashboard-guild-auth` |
| `MBD012` | `warning` | 32-bit bitwise permission checks on `guild.permissions` instead of `BigInt` | `oauth2-dashboard-guild-auth` |

---

## Installing in Your Coding Agents

### Antigravity / Gemini CLI
1. Clone or copy this repository.
2. Link the project as a plugin or copy `skills/mbd-guidance/` into your global skills directory (`~/.gemini/antigravity/skills/mbd-guidance` or `.gemini/skills/mbd-guidance` inside a workspace).
3. If published to npm (`npm publish`), update the invocation examples in `SKILL.md` to `npx -y mbd-guidance@latest`.

### Claude Code / Cursor / Codex
Copy `skills/mbd-guidance/` alongside `bin/`, `src/`, `scripts/`, and `schemas/` (or link globally via `npm link`) into:
- **Claude Code**: `~/.claude/skills/mbd-guidance/` or `.claude/skills/mbd-guidance/`
- **Cursor / OpenAI Codex**: `.agents/skills/mbd-guidance/`

---

## Testing

```sh
npm test
```
