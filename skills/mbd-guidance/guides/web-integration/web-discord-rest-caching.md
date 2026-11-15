---
id: web-discord-rest-caching
title: Safe Discord REST Consumption & Caching from Web Backends
category: web-integration
description: Fetch guild channels, roles, and metadata from Next.js backends using @discordjs/rest with strict response sanitization, TTL caching, and request deduplication to avoid 429 rate-limit bans.
tags: [web, rest, "@discordjs/rest", Routes, cache, rate-limit, 429, channels, roles, nextjs, dashboard]
apiVersion: v10
ecosystems: [Next.js App Router, "@discordjs/rest", Discord API v10]
---

Web dashboards frequently query Discord's REST API using the **bot token** (`@discordjs/rest`) to populate dropdowns for log channels, welcome channels, and moderation roles. Uncached browser reloads can easily exhaust route rate limits (`429 Too Many Requests`) and starve the live bot.

## Critical Rules & Gotchas

1. **Use `@discordjs/rest` instead of raw `fetch` loops**: `@discordjs/rest` automatically tracks `X-RateLimit-Bucket`, `X-RateLimit-Remaining`, and `Retry-After` headers across routes.
2. **Cache and deduplicate in-flight requests**: Cache `guildChannels` and `guildRoles` server-side for **30–120 seconds** (Redis or server memory) keyed by `guildId`, and coalesce concurrent calls for the same guild so multiple tabs do not trigger duplicate Discord REST requests.
3. **Sanitize DTOs before returning to the browser**: Never serialize raw Discord API payloads directly to client components if they include sensitive internal fields or unneeded metadata. Project strictly what the UI needs (`id`, `name`, `type`, `position`, `color`, `managed`).
4. **Never query a guild before verifying user authorization**: Confirm the user has `ManageGuild` on `guildId` (`oauth2-dashboard-guild-auth`) before invoking `@discordjs/rest` on that guild—otherwise attackers can enumerate channels and roles of arbitrary servers where the bot is installed.

## Sanitized & Cached Guild Resource Loader

```ts
import { REST } from '@discordjs/rest';
import { Routes, ChannelType, type APIGuildChannel, type APIRole } from 'discord-api-types/v10';

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

interface CachedEntry<T> {
  expiresAt: number;
  data: T;
}

const channelCache = new Map<string, CachedEntry<SanitizedChannel[]>>();
const inflightChannels = new Map<string, Promise<SanitizedChannel[]>>();

export interface SanitizedChannel {
  id: string;
  name: string;
  type: ChannelType;
  position: number;
}

export async function getGuildTextChannels(guildId: string): Promise<SanitizedChannel[]> {
  const now = Date.now();
  const cached = channelCache.get(guildId);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const pending = inflightChannels.get(guildId);
  if (pending) {
    return pending;
  }

  const request = (async () => {
    const raw = (await rest.get(Routes.guildChannels(guildId))) as APIGuildChannel<ChannelType>[];
    const sanitized = raw
      .filter((ch) => ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement)
      .map((ch) => ({
        id: ch.id,
        name: ch.name ?? 'unnamed',
        type: ch.type,
        position: ch.position ?? 0,
      }))
      .sort((a, b) => a.position - b.position);

    channelCache.set(guildId, { expiresAt: Date.now() + 60_000, data: sanitized });
    return sanitized;
  })();

  inflightChannels.set(guildId, request);
  try {
    return await request;
  } finally {
    inflightChannels.delete(guildId);
  }
}

export async function getAssignableRoles(guildId: string) {
  const roles = (await rest.get(Routes.guildRoles(guildId))) as APIRole[];
  return roles
    .filter((role) => role.id !== guildId && !role.managed)
    .map((role) => ({
      id: role.id,
      name: role.name,
      color: role.color,
      position: role.position,
    }))
    .sort((a, b) => b.position - a.position);
}
```

## Refreshing Stale Dropdowns

- Provide an explicit rate-limited "Refresh channels" action (e.g., max 1 forced bypass per guild every 15 seconds) instead of setting cache TTL to `0`.
- Remember that `@everyone` shares `role.id === guildId` and managed bot/integration roles have `role.managed === true`; filter both out before populating dashboard role selectors.
