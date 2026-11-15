---
name: mbd-guidance
description: |
  Modern Discord Bot guidance, legacy pattern scanner, web dashboard integration (Next.js OAuth2, IPC sync, REST caching), and security/architecture audit workflow for discord.js v14+, @discordjs/rest, and serverless HTTP Interactions (Cloudflare Workers, Next.js, Node.js).
  MANDATORY: Execute FIRST for Discord bot tasks: Slash Commands, Components V2, Modals, Autocomplete, Ephemeral/Defer lifecycle, stateful custom_ids, Ed25519 HTTP signature verification, permissions/mentions safety, cache sweepers, sharding, v13->v14 migration, connecting a bot with a web dashboard (OAuth2, Redis Pub/Sub, IPC, REST caching), or full Discord bot security/architecture audits.
  DO NOT trigger for unrelated frontend UI, generic SQL/ORM work outside Discord interaction/dashboard boundaries, or non-Discord bots unless explicitly requested.
---

# Modern Discord Bot Guidance (`mbd-guidance`)

Keep Discord bot implementations aligned with **Discord API v10** and **discord.js v14.16+**, steering away from legacy v12/v13 constructors, privilege/mention leaks, `10062 Unknown Interaction` timeouts, and unverified HTTP interaction webhooks.

## Operating Modes

This skill operates in **three modes** depending on the user's request. Loading this skill **does not authorize** starting a full audit or writing audit report files when the user only asked a question or requested feature work.

1. **Guidance Mode (Feature work & best practices)** — Default mode. Query the CLI (`search` -> `retrieve`), verify code compliance, and disclose applied guides.
2. **Legacy Modernization Mode (Updating existing bots)** — Use when asked to modernize an existing bot, migrate from v12/v13 to v14, or check for deprecated patterns via `legacy-scan`.
3. **Full Bot Audit Mode (Comprehensive security & architecture review)** — Activate **only** when the user explicitly requests a full/comprehensive/end-to-end bot audit, defensive pentest, or formal audit report.

If the request is ambiguous between Guidance/Modernize vs Full Audit, ask one concise clarifying question before generating audit artifacts.

---

## Invocation Path

Run the zero-dependency local CLI (100% offline):
- Inside this repository or locally linked: `node ./bin/mbd-guidance.mjs <command>` (or `npm run <command> -- ...`).
- Globally installed package: `mbd-guidance <command>` (or `npx -y mbd-guidance@latest <command>`).

---

## Mode 1: Guidance Mode (4-Step Workflow)

### Step 1. Search Use Cases
Run `search` with a **2–5 word query** targeting a single Discord platform capability (`<verb/pattern> + <Discord primitive>`), omitting app-specific names:

```sh
node ./bin/mbd-guidance.mjs search "<query>"
```

- **Match found**: Proceed directly to `retrieve` for matching `id`(s).
- **Weak/empty results**: Rephrase once using concrete Discord terms (`components-v2`, `ephemeral`, `defer`, `ed25519`, `slash`, `autocomplete`, `custom_id`, `sweepers`, `sharding`) or run `list`.

### Step 2. Retrieve Best Practices
Fetch full guide(s) by comma-separated IDs:

```sh
node ./bin/mbd-guidance.mjs retrieve "<id1,id2>"
```

If `--spill-large` writes output exceeding 9.5 KB to a temporary file, read that file path using your file-reading tool.

### Step 3. Verify Guidance Compliance
Before finishing code changes, cross-check your implementation against the retrieved guides:
- Omit `content`, `embeds`, `stickers`, and `poll` when `MessageFlags.IsComponentsV2` is set.
- Use `flags: MessageFlags.Ephemeral` instead of deprecated `ephemeral: true`.
- Acknowledge interactions within 3 seconds (`deferReply` / `deferUpdate` before slow I/O).
- Enforce `allowedMentions`, role hierarchy checks, and Ed25519 raw-body verification on HTTP endpoints.

### Step 4. Disclose Skill Usage
When retrieved guides shaped your implementation, close your response with a `### Modern Discord Bot Guidance` section:
- `- **\`<guide-id>\`**: <Non-obvious implementation rule or pitfall prevented in 1–2 sentences> ("<short verbatim quote from the guide>").`
- If you searched the skill and zero guides applied, note it in one sentence.

---

## Mode 2: Legacy Modernization Mode

When asked to detect deprecated code or upgrade an existing bot:

1. **Scan**: Run the deterministic static scanner:
   ```sh
   node ./bin/mbd-guidance.mjs legacy-scan <path> --json
   ```
2. **Triage (`keepWhen` / `dropWhen`)**: Evaluate every finding against its `keepWhen` / `dropWhen` rubric by inspecting the real source lines. Drop false positives (e.g., non-Discord Node `EventEmitter` listeners or upstream Ed25519 router middleware).
3. **Retrieve & Modernize**: Retrieve each confirmed finding's `guideId` (`retrieve "<guideId>"`) and apply the modern replacement without breaking registered commands.
4. **Re-scan**: Re-run `legacy-scan <path>` on modified files to verify resolution.

---

## Mode 3: Full Bot Audit Mode

For full Discord bot audits, follow [AUDIT-WORKFLOW.md](playbooks/AUDIT-WORKFLOW.md) and review the domain playbooks matching the repository surface:

- [INTERACTIONS-AND-UI.md](playbooks/INTERACTIONS-AND-UI.md) — Interaction lifecycle, Components V2, modals, autocomplete, and stateless pagination.
- [SECURITY-AND-PERMISSIONS.md](playbooks/SECURITY-AND-PERMISSIONS.md) — Ed25519 HTTP verification, least-privilege permissions, role hierarchy, mention injection, `guildId` tenant isolation, and secret hygiene.
- [ARCHITECTURE-AND-SCALING.md](playbooks/ARCHITECTURE-AND-SCALING.md) — Minimal intents, `makeCache`, `sweepers`, non-blocking event loop, rate limits, and `ShardingManager`.
- [WEB-DASHBOARD-INTEGRATION.md](playbooks/WEB-DASHBOARD-INTEGRATION.md) — OAuth2 guild authorization, `BigInt` permissions, IDOR prevention, Redis Pub/Sub / IPC sync, and REST caching.

Every confirmed finding in `findings.json` must cross a concrete **trust boundary** backed by verified source evidence and pass validation before delivery:

```sh
node ./scripts/validate-audit-report.mjs <path-to-findings.json>
```

---

## Language Guideline

Internal guides, playbooks, and scanner rubrics are authored in English for token efficiency and API alignment. Always reply to the user in the **user's own language**.
