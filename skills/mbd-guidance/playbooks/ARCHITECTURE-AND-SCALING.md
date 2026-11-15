# Playbook: Architecture, Memory & Scaling

Use this playbook to evaluate production stability, RAM footprint, restart resilience, and sharding readiness.

## Mandatory Verification Points

1. **Cache Limits & Sweepers**
   - Does `new Client(...)` configure `Options.cacheWithLimits` to cap `MessageManager` and zero out unused caches (`ReactionManager`, `PresenceManager`, `GuildBanManager`)?
   - Are core internal caches (`GuildManager`, `ChannelManager`, `RoleManager`) left intact rather than set to `0`?
   - Are periodic `sweepers` configured to evict stale messages and transient users?
   - Related guide: `cache-sweepers-and-sharding`.

2. **Non-Blocking Gateway Event Loop**
   - Do expensive workloads (AI inference, media rendering, exports, scraping) call `deferReply()` and offload execution to queues/workers without starving Gateway heartbeats?
   - Do interaction and event handlers isolate errors to prevent unhandled rejections from crashing the shard process?

3. **Sharding & External State**
   - Does the bot avoid storing critical state (cooldowns, queues, sessions, economy locks) solely in local process `Map()` instances when running under `ShardingManager` or multiple serverless instances?
   - Is `ShardingManager` / `@discordjs/ws` planned once guild count approaches 1500–2500 guilds?

4. **Rate Limit Hygiene (`429`)**
   - Does the codebase avoid tight loops over `channel.send` or bulk role edits without pacing/queuing, and avoid re-registering global Slash Commands on every shard startup?
