---
id: permissions-and-mention-safety
title: Permissions, Role Hierarchy & Mention Injection Safety
category: security
description: Enforce least privilege with PermissionFlagsBits, prevent role hierarchy bypasses in moderation commands, eliminate @everyone/@here mention injection via allowedMentions, and isolate multi-tenant guild data.
tags: [security, permissions, PermissionFlagsBits, allowedMentions, hierarchy, moderation, mentions, token, multi-tenant, guildId]
apiVersion: v10
ecosystems: [discord.js v14+, Discord API v10]
---

Discord bots operate as privileged proxies across thousands of guilds. Untrusted user inputs and administrative commands cross real trust boundaries.

## Critical Security Rules

1. **Neutralize mention injection (`allowedMentions`)**: Echoing untrusted user strings without `allowedMentions` lets attackers trigger `@everyone`, `@here`, or arbitrary role pings via the bot. Set a safe global default on `new Client(...)`:
   ```ts
   allowedMentions: { parse: ['users'], repliedUser: false }
   ```
   And pass `allowedMentions: { parse: [] }` on logs or public echo commands handling untrusted input.
2. **Enforce role hierarchy before moderation**: `setDefaultMemberPermissions` only controls command visibility in the Discord UI—it does not verify hierarchy. Always verify:
   - The executor (`interaction.member`) holds a strictly higher role than the target (`targetMember.roles.highest.comparePositionTo(executor.roles.highest) < 0`), unless the executor is `guild.ownerId`.
   - The bot itself can act on the target (`targetMember.bannable` / `targetMember.moderatable` / `targetMember.kickable`).
   - `targetMember.id !== guild.ownerId` and `targetMember.id !== interaction.user.id`.
3. **Least privilege**: Avoid demanding `PermissionFlagsBits.Administrator` for normal or moderation commands; request exact capabilities (`ManageMessages`, `ModerateMembers`, `ManageRoles`).
4. **Strict `guildId` multi-tenant isolation**: Scope every database read and mutation using `interaction.guildId` from the verified interaction payload—never trust a guild ID supplied via command text options or unverified `custom_id` fields.
5. **Zero hardcoded secrets**: Never commit literal tokens in `client.login('...')`; load `process.env.DISCORD_TOKEN` and rotate any leaked token immediately.

## Hardened Moderation Check Helper

```ts
import { GuildMember, MessageFlags, type ChatInputCommandInteraction } from 'discord.js';

export async function assertModerationTarget(
  interaction: ChatInputCommandInteraction,
  target: GuildMember
): Promise<boolean> {
  const guild = interaction.guild;
  const executor = interaction.member;

  if (!guild || !(executor instanceof GuildMember)) {
    return false;
  }

  if (target.id === interaction.user.id || target.id === guild.ownerId) {
    await interaction.reply({
      content: 'You cannot run this moderation action against yourself or the server owner.',
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  if (
    interaction.user.id !== guild.ownerId &&
    executor.roles.highest.comparePositionTo(target.roles.highest) <= 0
  ) {
    await interaction.reply({
      content: 'Your highest role must outrank the target member.',
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  if (!target.moderatable) {
    await interaction.reply({
      content: 'The bot role lacks hierarchy to moderate this member.',
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  return true;
}
```
