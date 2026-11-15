# Playbook: Full Bot Audit Workflow

Follow these 4 phases exclusively in **Mode 3 (Full Bot Audit Mode)** to deliver a deterministic, traceable, source-verified audit.

## Phase 1: Reconnaissance & Surface Inventory

1. Run the deterministic scanner as a baseline:
   ```sh
   node ./bin/mbd-guidance.mjs legacy-scan <target> --json
   ```
2. Inventory the repository:
   - **Runtime & stack**: `package.json`, `discord.js` version, Gateway vs Serverless HTTP Interactions model.
   - **Declared intents**: Privileged (`MessageContent`, `GuildMembers`, `GuildPresences`) vs standard intents.
   - **Entry surfaces**: Slash commands, Context menus, buttons/selects/modals, HTTP webhook routes, Gateway event listeners (`messageCreate`, `guildMemberAdd`, etc.).
   - **State & persistence**: Databases, in-memory caches, background queues.

## Phase 2: Playbook & Trust-Boundary Hunting

Partition coverage systematically across the domain playbooks:
1. [INTERACTIONS-AND-UI.md](INTERACTIONS-AND-UI.md)
2. [SECURITY-AND-PERMISSIONS.md](SECURITY-AND-PERMISSIONS.md)
3. [ARCHITECTURE-AND-SCALING.md](ARCHITECTURE-AND-SCALING.md)
4. [WEB-DASHBOARD-INTEGRATION.md](WEB-DASHBOARD-INTEGRATION.md)

Core rule: **Do not report unverified guesses.** Every candidate finding must specify:
- **Lower-privilege principal** (e.g., guild member, unauthenticated HTTP caller, moderator lacking role hierarchy).
- **Crossed trust boundary** (e.g., `user-input -> bot-response`, `http-request -> interaction-handler`, `guild-A -> guild-B`).
- **Exact file and line evidence** verified by directly reading source files.

## Phase 3: Verification & False-Positive Filtering

For each candidate (including `legacy-scan` results):
1. Apply the rule's `keepWhen` and `dropWhen` rubric explicitly.
2. Check for compensating controls in upstream middleware, global `Client` options (such as `allowedMentions`), or prior validation helpers.
3. If confirmation depends on deployment configuration outside the repository (e.g., Cloudflare secrets or Discord role permissions on live servers), classify the item as `needs_validation` rather than asserting certainty.

## Phase 4: Report Generation & Schema Validation (`findings.json` + `AUDIT-REPORT.md`)

1. Write `findings.json` conforming to [schemas/audit-report.schema.json](../../../schemas/audit-report.schema.json).
2. Validate `findings.json` with the deterministic validator script:
   ```sh
   node ./scripts/validate-audit-report.mjs <path-to-findings.json>
   ```
3. Only after the validator exits with code `0`, deliver the executive summary and remediation plan referencing the corresponding `mbd-guidance` `guideId`s.
