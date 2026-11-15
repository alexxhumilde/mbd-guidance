---
id: oauth2-dashboard-guild-auth
title: Discord OAuth2 Web Dashboard Auth, BigInt Permissions & IDOR Prevention
category: web-integration
description: Build secure Discord web dashboards (Next.js App Router) using OAuth2 identify + guilds scopes, 64-bit BigInt permission checks (ManageGuild), mutual guild intersection, and server-side IDOR protection.
tags: [web, dashboard, oauth2, nextjs, guilds, identify, BigInt, ManageGuild, PermissionFlagsBits, idor, security]
apiVersion: v10
ecosystems: [Next.js App Router, Node.js, Discord OAuth2 v10]
---

When connecting a Discord bot to a web dashboard (Next.js, Express, or Fastify), authentication and guild authorization must happen strictly server-side using 64-bit `BigInt` bitfields.

## Critical Security Rules

1. **Always use `BigInt` for Discord permission bitfields**: Discord permissions exceed 32 bits (`>= 1 << 31`). Running `(guild.permissions & 0x20)` or `(Number(guild.permissions) & ...)` truncates to signed 32-bit integers and corrupts checks for newer flags. Always use `BigInt(guild.permissions)`.
2. **Minimal OAuth2 scopes**: Request only `identify guilds` for a dashboard login—never request `bot`, `messages.read`, or `guilds.join` in the user login flow unless explicitly executing that feature.
3. **Never trust client-supplied `guildId` (IDOR prevention)**: Re-verify on every `POST`/`PATCH` route handler or Server Action (`POST /api/guilds/[guildId]/settings`) that the authenticated user's session holds `ManageGuild` or `Administrator` (or `owner === true`) on that exact `guildId` **and** that the bot is present in that guild.
4. **Keep `DISCORD_TOKEN` strictly server-side**: Never expose bot tokens or `DISCORD_CLIENT_SECRET` via `NEXT_PUBLIC_*`, `VITE_*`, or `REACT_APP_*` environment variables.

## Server-Side Permission & Mutual Guild Helper (`Next.js` / TypeScript)

```ts
import { PermissionFlagsBits } from 'discord-api-types/v10';

export interface OAuthGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

export function canManageGuild(guild: Pick<OAuthGuild, 'owner' | 'permissions'>): boolean {
  if (guild.owner) {
    return true;
  }
  const perms = BigInt(guild.permissions);
  return (
    (perms & PermissionFlagsBits.ManageGuild) === PermissionFlagsBits.ManageGuild ||
    (perms & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator
  );
}

export async function assertGuildAdminSession(
  userAccessToken: string,
  targetGuildId: string,
  botGuildIds: ReadonlySet<string>
): Promise<OAuthGuild> {
  if (!botGuildIds.has(targetGuildId)) {
    throw new Error('Bot is not installed in target guild');
  }

  const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
    headers: { Authorization: `Bearer ${userAccessToken}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Discord OAuth2 guild lookup failed: ${response.status}`);
  }

  const guilds = (await response.json()) as OAuthGuild[];
  const match = guilds.find((g) => g.id === targetGuildId);

  if (!match || !canManageGuild(match)) {
    throw new Error('Forbidden: user lacks ManageGuild permission for target guild');
  }

  return match;
}
```

## Dashboard Caching vs Fresh Checks

- Cache the user's `/users/@me/guilds` list in an encrypted server session or short-lived Redis key (30–60s TTL) to avoid OAuth2 rate limits when navigating dashboard pages.
- On destructive or privilege-changing writes (e.g., setting automod roles, logging channels, or prefix overrides), enforce a fresh or short-TTL server-side authorization check before persisting to the database.
