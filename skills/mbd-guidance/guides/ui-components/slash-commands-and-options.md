---
id: slash-commands-and-options
title: Slash Commands, Contexts, Integration Types & REST Registration
category: ui-components
description: Define Application Commands using SlashCommandBuilder, InteractionContextType, ApplicationIntegrationType, granular permissions, and idempotent REST registration via @discordjs/rest.
tags: [slash, SlashCommandBuilder, InteractionContextType, ApplicationIntegrationType, setContexts, setDMPermission, rest, Routes, options]
apiVersion: v10
ecosystems: [discord.js v14.15+, "@discordjs/rest", Discord API v10]
---

Expose bot commands via **Application Commands** (`SlashCommandBuilder` and Context Menus) with explicit interaction contexts and idempotent REST deployment.

## Critical Rules & Gotchas

1. **Replace `setDMPermission()` with `setContexts()`**: `setDMPermission(false)` is deprecated in Discord API v10. Use `.setContexts(InteractionContextType.Guild)` for guild-only commands, or add `InteractionContextType.BotDM` and `InteractionContextType.PrivateChannel` where appropriate.
2. **Declare `setIntegrationTypes()`**: Specify `ApplicationIntegrationType.GuildInstall` and/or `ApplicationIntegrationType.UserInstall` when supporting user-installed commands across chats.
3. **Never register commands inside `Events.ClientReady` in production**: Running `PUT /applications/{id}/commands` on every boot or per shard triggers rate limits and `429` errors. Isolate registration in a `deploy-commands.mjs` script executed in CI/CD or on demand.
4. **Hard Discord limits**: Max **100** global `CHAT_INPUT` commands, **25** options per command, lowercase names matching `^[-_\p{L}\p{N}]{1,32}$`, descriptions `<= 100` chars.

## Modern Implementation (`discord.js` v14+)

```ts
import {
  ApplicationIntegrationType,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

export const modCommand = new SlashCommandBuilder()
  .setName('mod')
  .setDescription('Server moderation tools')
  .setContexts(InteractionContextType.Guild)
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addSubcommand((sub) =>
    sub
      .setName('ban')
      .setDescription('Ban a guild member')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('Target member').setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName('reason')
          .setDescription('Audit log reason')
          .setMaxLength(512)
          .setRequired(false)
      )
      .addIntegerOption((opt) =>
        opt
          .setName('delete_days')
          .setDescription('Days of messages to delete (0-7)')
          .setMinValue(0)
          .setMaxValue(7)
      )
  );
```

## Idempotent REST Registration Script

```ts
import { REST, Routes } from 'discord.js';

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
const body = commands.map((cmd) => cmd.toJSON());

const route = process.env.DISCORD_DEV_GUILD_ID
  ? Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID!, process.env.DISCORD_DEV_GUILD_ID)
  : Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!);

await rest.put(route, { body });
```

- **Dev workflow tip**: Use `applicationGuildCommands` during local development (instant propagation) and `applicationCommands` in production (atomic bulk overwrite).
- **Subcommand constraint**: Once a command defines a subcommand or subcommand group, root-level options are rejected by Discord.
