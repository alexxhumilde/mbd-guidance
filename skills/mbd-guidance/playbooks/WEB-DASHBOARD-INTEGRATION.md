# Playbook: Web Dashboard & Bot Integration

Use this playbook when designing or auditing a web dashboard (Next.js, Express, Remix, etc.) connected to a Discord bot.

## Mandatory Design & Audit Checklist

1. **OAuth2 Guild Authorization & IDOR Prevention**
   - Do dashboard login flows request minimal scopes (`identify`, `guilds`)?
   - Does every mutation endpoint (`POST /api/guilds/[guildId]/*` or Next.js Server Action) verify server-side that the user session holds `ManageGuild` or `Administrator` (or `owner`) for the target `guildId`, **and** that the bot is installed in that guild?
   - Related guide: `oauth2-dashboard-guild-auth`.

2. **64-Bit `BigInt` Permission Bitfields**
   - Are all Discord guild permission checks performed with `BigInt(guild.permissions) & PermissionFlagsBits.*` instead of 32-bit `Number` bitwise operators?
   - Related guide: `oauth2-dashboard-guild-auth`.

3. **Token & Secret Isolation**
   - Are `DISCORD_TOKEN` and `DISCORD_CLIENT_SECRET` kept exclusively in server-side modules and environment variables without `NEXT_PUBLIC_`, `VITE_`, or `REACT_APP_` prefixes?
   - Related guide: `oauth2-dashboard-guild-auth`.

4. **Authenticated Web <-> Bot Synchronization**
   - Are web configuration writes persisted to a shared database (PostgreSQL) and propagated to Gateway shards via Redis Pub/Sub or a loopback-bound (`127.0.0.1`) HTTP IPC endpoint verified with `crypto.timingSafeEqual`?
   - Does the bot shard filter Pub/Sub invalidation events with `client.guilds.cache.has(guildId)`?
   - Related guide: `web-bot-sync-and-ipc`.

5. **REST Caching & Rate-Limit Protection**
   - Are guild channel/role lookups from the web backend executed via `@discordjs/rest` after user authorization, cached with a TTL (30–120s), deduplicated in-flight, and projected into sanitized DTOs?
   - Related guide: `web-discord-rest-caching`.
