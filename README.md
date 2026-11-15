<p align="center">
  <img src="./assets/logo.png" alt="MBD Guidance Logo" width="160" />
</p>

# MBD Guidance — Modern Discord Bot Guidance & Audit Skill

**MBD Guidance** is a zero-dependency CLI and hybrid AI coding-agent skill for modern development, legacy migration, web dashboard integration, and security/architecture audits of **Discord bots** (`discord.js` v14.28.1+, `@discordjs/rest`, and **Serverless HTTP Interactions** on Cloudflare Workers / Next.js / Node.js).

It combines two proven architectures:
1. **`googlechrome/modern-web-guidance` pattern**: Offline CLI with weighted BM25 search (`search`), full guide retrieval (`retrieve`), catalog listing (`list`), and static anti-pattern scanning (`legacy-scan`) with `keepWhen` / `dropWhen` triage rubrics.
2. **`cloudflare/security-audit-skill` pattern**: A structured, self-contained [SKILL.md](skills/mbd-guidance/SKILL.md) with three operating modes (*Guidance*, *Legacy Modernization*, and *Full Bot Audit*), domain playbooks, and a deterministic audit report validator ([skills/mbd-guidance/scripts/validate-audit-report.mjs](skills/mbd-guidance/scripts/validate-audit-report.mjs)).

---

## Quickstart

Install the self-contained skill across your coding agents using the universal **[Skills CLI](https://skills.sh)**:

```sh
# Install into the current project (auto-detects installed agents)
npx skills add alexxhumilde/mbd-guidance --skill mbd-guidance

# Install globally (user-level) across agents
npx skills add alexxhumilde/mbd-guidance --skill mbd-guidance --global
```

Or run the bundled CLI directly without cloning:

```sh
# Interactive / CLI installer wrapper
npx -y github:alexxhumilde/mbd-guidance install

# Try the guidance CLI without installing
npx -y github:alexxhumilde/mbd-guidance search "components v2 container"
npx -y github:alexxhumilde/mbd-guidance retrieve "components-v2-layout"
npx -y github:alexxhumilde/mbd-guidance legacy-scan .
```

---

## Agent-Specific Installation Methods

`mbd-guidance` ships native plugin/extension manifests and self-contained runtime scripts so it works out of the box across major AI coding agents.

<details>
<summary><b>Vercel Skills CLI (<code>npx skills</code>) — 40+ Agents Supported</b></summary>

Supports Antigravity, Claude Code, Cursor, GitHub Copilot, Windsurf, OpenAI Codex, Gemini CLI, Cline, Roo Code, OpenCode, Kimi, and more:

```sh
# Project-level install
npx skills add alexxhumilde/mbd-guidance --skill mbd-guidance

# User-level global install for all detected agents
npx skills add alexxhumilde/mbd-guidance --skill mbd-guidance --global

# Non-interactive install to specific agents
npx skills add alexxhumilde/mbd-guidance --skill mbd-guidance -a antigravity claude-code cursor -y

# Inspect available flags and agent identifiers
npx skills --help
```
</details>

<details>
<summary><b>Google Antigravity</b></summary>

Install natively via the Antigravity CLI plugin installer (uses root `plugin.json`):

```sh
agy plugin install https://github.com/alexxhumilde/mbd-guidance
```

Or install as a skill via the Skills CLI:

```sh
npx skills add alexxhumilde/mbd-guidance --skill mbd-guidance -a antigravity --global
```

Manual discovery paths in Antigravity:
- **Global plugin**: `~/.gemini/config/plugins/mbd-guidance/`
- **Global standalone skill**: `~/.gemini/config/skills/mbd-guidance/` (copy `skills/mbd-guidance/`)
- **Workspace skill**: `.agents/skills/mbd-guidance/` (copy `skills/mbd-guidance/`)
</details>

<details>
<summary><b>Claude Code</b></summary>

Install directly via Claude Code's plugin marketplace (uses `.claude-plugin/marketplace.json` and `.claude-plugin/plugin.json`):

```text
/plugin marketplace add alexxhumilde/mbd-guidance
/plugin install mbd-guidance@alexxhumilde
/reload-plugins
```

Or install the standalone skill via Skills CLI:

```sh
npx skills add alexxhumilde/mbd-guidance --skill mbd-guidance -a claude-code --global
```
</details>

<details>
<summary><b>Cursor</b></summary>

Install via the Skills CLI (`-a cursor`) or load the repository plugin (`.cursor-plugin/plugin.json`):

```sh
npx skills add alexxhumilde/mbd-guidance --skill mbd-guidance -a cursor
```
</details>

<details>
<summary><b>OpenAI Codex</b></summary>

Install via Codex plugin marketplace (uses `.agents/plugins/marketplace.json` and `.codex-plugin/plugin.json`):

```sh
codex plugin marketplace add alexxhumilde/mbd-guidance
codex plugin add mbd-guidance@alexxhumilde
```

Or install via Skills CLI:

```sh
npx skills add alexxhumilde/mbd-guidance --skill mbd-guidance -a codex
```
</details>

<details>
<summary><b>GitHub Copilot CLI & GitHub CLI</b></summary>

In **GitHub Copilot CLI** (uses `.github/plugin/plugin.json`):

```text
/plugin marketplace add alexxhumilde/mbd-guidance
/plugin install mbd-guidance@alexxhumilde
```

Or via **GitHub CLI**:

```sh
gh skill install alexxhumilde/mbd-guidance
```
</details>

<details>
<summary><b>Gemini CLI</b></summary>

Install as a Gemini CLI extension (uses `gemini-extension.json` and `policies/mbd-guidance.toml`):

```sh
gemini extensions install https://github.com/alexxhumilde/mbd-guidance
```

Or install via Skills CLI:

```sh
npx skills add alexxhumilde/mbd-guidance --skill mbd-guidance -a gemini-cli --global
```
</details>

<details>
<summary><b>Windsurf / Cline / Roo Code / OpenCode</b></summary>

```sh
npx skills add alexxhumilde/mbd-guidance --skill mbd-guidance -a windsurf cline roo opencode
```
</details>

<details>
<summary><b>Grok Build CLI</b></summary>

Uses `.grok-plugin/marketplace.json`:

```sh
grok plugin install https://github.com/alexxhumilde/mbd-guidance --trust
```
</details>

<details>
<summary><b>Kimi Code</b></summary>

Uses `kimi.plugin.json`:

```text
/plugins install https://github.com/alexxhumilde/mbd-guidance
```
</details>

---

## Project Architecture

`skills/mbd-guidance/` is completely self-contained so agent installers that extract only the skill directory (`npx skills add`) still have full offline access to the CLI, search engine, legacy scanner, schema, and audit report validator:

```text
├── assets/logo.png                                  # Skill & plugin logo
├── bin/mbd-guidance.mjs                             # Root CLI wrapper -> skills/mbd-guidance/scripts/mbd-guidance.mjs
├── src/                                             # Root package exports -> skills/mbd-guidance/src/*
├── scripts/validate-audit-report.mjs                # Root validator wrapper -> skills/mbd-guidance/scripts/validate-audit-report.mjs
├── schemas/audit-report.schema.json                 # JSON Schema contract for audit reports
├── skills/mbd-guidance/                             # Self-contained agent skill package
│   ├── SKILL.md                                     # Agent instructions & 3 operating modes
│   ├── scripts/
│   │   ├── mbd-guidance.mjs                         # Standalone CLI (search, retrieve, list, legacy-scan, install/update)
│   │   └── validate-audit-report.mjs                # Standalone deterministic validator for findings.json
│   ├── src/
│   │   ├── catalog.mjs                              # Recursive Markdown guide loader & frontmatter parser
│   │   ├── search-engine.mjs                        # Weighted BM25 ranking + Discord domain synonyms
│   │   └── legacy-scanner.mjs                       # Static scanner with 13 deterministic rules (MBD001–MBD013)
│   ├── schemas/audit-report.schema.json             # Self-contained audit report JSON Schema
│   ├── playbooks/                                   # Audit & domain review checklists (5 playbooks)
│   └── guides/                                      # 13 curated Discord API v10 technical guides
├── policies/mbd-guidance.toml                       # Gemini CLI plan-mode policy rule
├── plugin.json                                      # Antigravity / agent-plugins.org plugin manifest
├── gemini-extension.json                            # Gemini CLI extension manifest
├── kimi.plugin.json                                 # Kimi Code plugin manifest
├── .agents/plugins/marketplace.json                 # Agent marketplace manifest
├── .claude-plugin/{plugin,marketplace}.json         # Claude Code plugin & marketplace manifests
├── .codex-plugin/plugin.json                        # OpenAI Codex plugin manifest
├── .cursor-plugin/plugin.json                       # Cursor plugin manifest
├── .github/plugin/plugin.json                       # GitHub Copilot CLI plugin manifest
├── .grok-plugin/marketplace.json                    # Grok Build CLI marketplace manifest
└── tests/mbd-guidance.test.mjs                      # Test suite powered by node:test
```

---

## CLI Usage

Requires **Node.js >= 20** (zero external runtime dependencies in `node_modules`).

```sh
# List all guides grouped by category
node ./skills/mbd-guidance/scripts/mbd-guidance.mjs list

# Search guides
node ./skills/mbd-guidance/scripts/mbd-guidance.mjs search "components v2 container"
node ./skills/mbd-guidance/scripts/mbd-guidance.mjs search "serverless ed25519 signature"

# Retrieve one or more full guides
node ./skills/mbd-guidance/scripts/mbd-guidance.mjs retrieve "components-v2-layout,ephemeral-and-defer-lifecycle"

# Scan an existing bot for legacy patterns or security risks
node ./skills/mbd-guidance/scripts/mbd-guidance.mjs legacy-scan ./path-to-bot --json

# Validate a full audit report
node ./skills/mbd-guidance/scripts/validate-audit-report.mjs ./findings.json
```

When running directly inside this repository, the root shortcuts also work: `node ./bin/mbd-guidance.mjs <command>` or `npm run <script> -- ...`.

---

## Guide Catalog (13)

| Category | ID | Topic |
| :--- | :--- | :--- |
| `ui-components` | `components-v2-layout` | `MessageFlags.IsComponentsV2`, `ContainerBuilder`, `SectionBuilder`, `TextDisplayBuilder`, 40-component cap |
| `ui-components` | `slash-commands-and-options` | `SlashCommandBuilder`, `InteractionContextType`, `ApplicationIntegrationType`, idempotent REST sync |
| `ui-components` | `modals-and-autocomplete` | `ModalBuilder` (`LabelBuilder`, `FileUploadBuilder`, Selects, Radio/Checkbox) & `isAutocomplete()` < 500 ms |
| `ui-components` | `ephemeral-and-defer-lifecycle` | 3-second deadline (`10062`), `MessageFlags.Ephemeral`, `deferReply` vs `deferUpdate` |
| `ui-components` | `stateful-custom-ids-and-pagination` | Structured `custom_id` (`<= 100` chars), `ownerId` validation, clean collector timeouts |
| `legacy-migration` | `v13-to-v14-modernization` | Full v12/v13 -> v14.28.1 equivalence table (`EmbedBuilder`, `GatewayIntentBits`, `Events`, `fetchPins()`) |
| `legacy-migration` | `prefix-to-interactions` | Migrating `!prefix` commands and dropping privileged `MessageContent` intent |
| `security` | `http-interactions-ed25519` | Web Crypto Ed25519 verification over `rawBody`, `PING` handling, serverless `waitUntil()` |
| `security` | `permissions-and-mention-safety` | `allowedMentions`, `appPermissions`, moderation role hierarchy, least privilege, `guildId` isolation |
| `architecture` | `cache-sweepers-and-sharding` | `Options.cacheWithLimits`, `sweepers`, non-blocking event loop, `ShardingManager` |
| `web-integration` | `oauth2-dashboard-guild-auth` | OAuth2 `identify` + `guilds`, 64-bit `BigInt` `ManageGuild` checks, IDOR prevention |
| `web-integration` | `web-bot-sync-and-ipc` | Shared DB + Redis Pub/Sub invalidation or `timingSafeEqual` loopback HTTP IPC |
| `web-integration` | `web-discord-rest-caching` | `@discordjs/rest` channel/role loaders, DTO sanitization, TTL cache & deduplication |

---

## `legacy-scan` Rules (MBD001 – MBD013)

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
| `MBD013` | `warning` | Deprecated `messages.fetchPinned()` instead of paginated `messages.fetchPins()` | `v13-to-v14-modernization` |

---

## Testing

```sh
npm test
```

---

## Contributing & License

Found an outdated `discord.js` pattern, missing API v10 feature, or false positive in `legacy-scan`? Read [CONTRIBUTING.md](CONTRIBUTING.md) or open an issue on [GitHub](https://github.com/alexxhumilde/mbd-guidance/issues).

This project is licensed under the [Apache License 2.0](LICENSE).
