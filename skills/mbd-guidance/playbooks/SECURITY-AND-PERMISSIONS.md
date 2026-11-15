# Playbook: Security, Trust Boundaries & Permissions

Use this playbook to review or audit a Discord bot through concrete trust boundaries.

## Bot Threat Model

Every Discord bot operates across **three primary trust boundaries**:
1. **Untrusted Guild User / External HTTP Caller** -> supplies command options, modal inputs, button `custom_id` payloads, or raw HTTP requests.
2. **Bot Process (Privileged Principal)** -> holds `DISCORD_TOKEN`, guild moderation/admin permissions, and database credentials.
3. **Guild Multi-Tenancy (`guildId`)** -> a user or admin in Guild A must never read, overwrite, or delete configuration or records belonging to Guild B.

## Mandatory Verification Points

1. **HTTP Interactions Authenticity (Serverless / Webhooks)**
   - If the bot exposes an HTTP endpoint (`POST /interactions`), does it verify `X-Signature-Ed25519` and `X-Signature-Timestamp` over the **exact raw body bytes** before parsing JSON?
   - Does it return `{ type: 1 }` only after signature verification passes, and reject invalid signatures with HTTP `401`?
   - Related guide: `http-interactions-ed25519`.

2. **Mention Injection (`@everyone` / `@here` / Role Pings)**
   - Is `allowedMentions` configured globally on `new Client(...)` or per message whenever user-controlled text is echoed?
   - Related guide: `permissions-and-mention-safety`.

3. **Authorization & Role Hierarchy**
   - Do commands avoid requesting `PermissionFlagsBits.Administrator` when granular permissions suffice?
   - Do moderation actions (`ban`, `kick`, `timeout`, role edits) verify that the executor's highest role outranks the target's highest role, check `target.moderatable` / `target.bannable`, and block actions against `guild.ownerId`?
   - Do `ButtonInteraction` / `StringSelectMenuInteraction` / `ModalSubmitInteraction` handlers enforce permissions and ownership (`ownerId`) server-side regardless of UI visibility?

4. **Multi-Tenant Guild Isolation (`guildId`)**
   - Do all database queries scope reads and writes by verified `interaction.guildId`, never by an untrusted command argument or unverified `custom_id` field?

5. **Secrets & Intent Minimization**
   - Are `DISCORD_TOKEN` and `DISCORD_PUBLIC_KEY` read exclusively from environment variables or runtime secret stores, never hardcoded or logged?
   - Is `GatewayIntentBits.MessageContent` avoided unless strictly required by core functionality?
