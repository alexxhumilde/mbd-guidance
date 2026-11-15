---
id: web-bot-sync-and-ipc
title: Real-Time Web-to-Bot Synchronization & Authenticated IPC
category: web-integration
description: Synchronize configuration changes from a web dashboard to a running Discord bot without restarts using shared database state plus Redis Pub/Sub invalidation or timing-safe loopback HTTP IPC.
tags: [web, sync, ipc, redis, pubsub, dashboard, nextjs, sharding, timingSafeEqual, cache-invalidation]
apiVersion: v10
ecosystems: [Next.js, Node.js, discord.js v14+, Redis]
---

Web dashboards (often serverless or multi-process Next.js instances) and Gateway bots (`discord.js` / `ShardingManager`) run in separate processes. Never tightly couple the web server inside the Gateway shard loop.

## Recommended Synchronization Patterns

### Pattern 1 (Recommended): Shared Database + Redis Pub/Sub Invalidation
1. The web dashboard validates authorization, writes new guild settings to PostgreSQL (source of truth), and publishes a lightweight invalidation event (`{ guildId, updatedAt }`) to Redis channel `guild:config:updated`.
2. Every bot shard subscribes to `guild:config:updated`, checks if `client.guilds.cache.has(guildId)`, and refreshes or deletes its local TTL cache entry in `< 10 ms` without restarting.
3. On bot startup or cache miss, the bot reads directly from PostgreSQL—so missed pub/sub messages never cause permanent drift.

```ts
// Web side (Next.js Server Action / Route Handler after DB commit)
await redisPublisher.publish(
  'guild:config:updated',
  JSON.stringify({ guildId, version: updatedConfig.version })
);

// Bot shard side (startup listener)
redisSubscriber.subscribe('guild:config:updated');
redisSubscriber.on('message', async (_channel, rawPayload) => {
  const { guildId } = JSON.parse(rawPayload) as { guildId: string };
  if (!client.guilds.cache.has(guildId)) {
    return; // Ignore guilds owned by other shards
  }
  await guildConfigCache.refresh(guildId);
});
```

### Pattern 2 (Single-Host / No Redis): Loopback HTTP IPC with `timingSafeEqual`
When Redis is unavailable on a single VPS, expose an internal Fastify/Node HTTP listener bound strictly to **`127.0.0.1`** (never `0.0.0.0`) or a private VPC network, and authenticate requests using a constant-time secret check:

```ts
import crypto from 'node:crypto';
import http from 'node:http';

function verifySharedSecret(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function startInternalIpcServer(secret: string, onInvalidate: (guildId: string) => void) {
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/internal/invalidate') {
      res.writeHead(404).end();
      return;
    }

    const token = req.headers['x-internal-secret'];
    if (typeof token !== 'string' || !verifySharedSecret(token, secret)) {
      res.writeHead(401).end();
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 4096) req.destroy();
    });
    req.on('end', () => {
      const { guildId } = JSON.parse(body) as { guildId?: string };
      if (guildId) onInvalidate(guildId);
      res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
    });
  });

  server.listen(Number(process.env.BOT_IPC_PORT || 8787), '127.0.0.1');
  return server;
}
```

## Pitfalls to Avoid

- **Never run an unauthenticated localhost webhook**: Even on `127.0.0.1`, require a shared secret (`X-Internal-Secret`) or mTLS so SSRF or local processes cannot forge bot actions.
- **Never block Gateway heartbeats with a heavy Express/Next.js server** inside the same event loop under high web traffic.
