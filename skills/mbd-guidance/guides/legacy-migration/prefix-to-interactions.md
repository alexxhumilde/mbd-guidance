---
id: prefix-to-interactions
title: Migrating Prefix Commands to Slash Commands & Context Menus
category: legacy-migration
description: Eliminate dependency on the privileged MessageContent intent and fragile prefix parsing by migrating text commands (!help, ?ban) to typed Slash Commands and Context Menus.
tags: [prefix, MessageContent, messageCreate, migration, interactions, slash, context-menu, privileged-intents]
apiVersion: v10
ecosystems: [discord.js v14+, Discord API v10]
---

Prefix-based text commands (`!command args`) depend on the **privileged `GatewayIntentBits.MessageContent` intent**, which blocks bot verification past 100 guilds unless Discord approves an explicit justification.

## Why & When to Migrate

1. **Minimal intents**: Moving to Application Commands (`SlashCommandBuilder` and Context Menus) lets you drop `GatewayIntentBits.MessageContent` and `GatewayIntentBits.GuildMessages` when the bot does not passively read chat (e.g., automod or conversational chat).
2. **Client-side validation**: Discord validates option types (`User`, `Role`, `Channel`, bounded `Integer`, `Attachment`) before dispatching the interaction.
3. **Native permission overrides**: Server admins can restrict slash commands per role or channel natively in Discord Settings via `setDefaultMemberPermissions`.

## Legacy vs Modern Mapping

```ts
// ❌ Legacy prefix command (fragile parsing + requires MessageContent intent)
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.content.startsWith('!ban')) return;
  const args = message.content.slice(4).trim().split(/\s+/);
  const target = message.mentions.members?.first();
  if (!target) return message.reply('Mention a target user.');
  await target.ban({ reason: args.slice(1).join(' ') || 'No reason provided' });
});
```

```ts
// ✅ Modern Slash Command + Context Menu (zero MessageContent intent required)
import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

export const messageReportMenu = new ContextMenuCommandBuilder()
  .setName('Report Message')
  .setType(ApplicationCommandType.Message)
  .setContexts(InteractionContextType.Guild);

export const banSlash = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Ban a guild member')
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addUserOption((opt) =>
    opt.setName('user').setDescription('User to ban').setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName('reason').setDescription('Moderation log reason').setMaxLength(512)
  );
```

## Safe Transition Strategy

- Emit a temporary ephemeral or deprecation notice in existing prefix handlers for 1–2 releases pointing users to the new `/command` before removing `MessageContent`.
- Use **Message Context Menus** (`ApplicationCommandType.Message`) for actions that previously relied on replying to a message with `!quote`, `!translate`, or `!report`.
- Use **User Context Menus** (`ApplicationCommandType.User`) for profile-targeted commands (`!userinfo`, `!avatar`, `!warn`).
