---
id: cache-sweepers-and-sharding
title: Memory Control (makeCache, Sweepers) & Sharding Architecture
category: architecture
description: Prevent unbounded RAM growth in discord.js bots using Options.makeCache and sweepers, configure ShardingManager cleanly above 2000 guilds, and offload heavy work from the Gateway event loop.
tags: [architecture, cache, sweepers, Options, makeCache, sharding, ShardingManager, memory, gateway, scaling]
apiVersion: v10
ecosystems: [discord.js v14+, "@discordjs/ws"]
---

In bots serving dozens or thousands of guilds, default `discord.js` caches grow unboundedly as messages, members, presences, and reactions accumulate in memory.

## Critical Architecture Rules

1. **Cap `MessageManager` and enable `sweepers`**: Never leave unbounded message or presence caches when unused. Configure `Options.cacheWithLimits` + `sweepers`.
2. **Never zero out core internal caches**: **Do not** set `GuildManager: 0`, `ChannelManager: 0`, or `RoleManager: 0`—`discord.js` relies on them internally to resolve permissions, guild structures, and events. Cap heavy leaf caches (`MessageManager`, `ReactionManager`, `ThreadManager`, `PresenceManager`).
3. **Keep the Gateway event loop non-blocking**: Offload heavy tasks (Canvas/Sharp rendering, LLM calls, CSV exports, video transcoding) to worker queues after sending `deferReply()`.
4. **Shard before hitting 2000–2500 guilds**: Discord enforces a hard limit of **2500 guilds per shard** (start sharding around **1500–2000** guilds or when per-process memory exceeds ~1.5 GB).

## Production Client Cache & Sweeper Configuration

```ts
import { Client, GatewayIntentBits, Options } from 'discord.js';

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
  allowedMentions: {
    parse: ['users'],
    repliedUser: false,
  },
  makeCache: Options.cacheWithLimits({
    ...Options.DefaultMakeCacheSettings,
    MessageManager: 25,
    ReactionManager: 0,
    GuildBanManager: 0,
    PresenceManager: 0,
    StageInstanceManager: 0,
    VoiceStateManager: 0,
  }),
  sweepers: {
    ...Options.DefaultSweeperSettings,
    messages: {
      interval: 3600, // seconds (1 hour)
      lifetime: 1800, // evict messages older than 30 min
    },
    users: {
      interval: 3600,
      filter: () => (user) => user.bot && user.id !== user.client.user.id,
    },
  },
});
```

## Sharding Manager Entrypoint (`shard.mjs`)

```ts
import { ShardingManager } from 'discord.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manager = new ShardingManager(path.join(__dirname, 'bot.mjs'), {
  token: process.env.DISCORD_TOKEN,
  totalShards: 'auto',
  respawn: true,
});

manager.on('shardCreate', (shard) => {
  console.log(`[Shard ${shard.id}] Launched`);
});

await manager.spawn();
```

- **Multi-process state rule**: Under `ShardingManager`, shared state (cooldowns, job queues, audio sessions, economy locks) **must live in Redis / PostgreSQL**, never in process-local `Map()` instances.
- For cross-shard metrics (e.g., total guild count), call `client.shard.fetchClientValues('guilds.cache.size')` and reduce the array.
