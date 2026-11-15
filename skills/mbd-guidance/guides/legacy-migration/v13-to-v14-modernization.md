---
id: v13-to-v14-modernization
title: Migrating Discord Bots from discord.js v12/v13 to v14.16+
category: legacy-migration
description: Complete equivalence table and migration guide from discord.js v12/v13 legacy APIs (MessageEmbed, MessageActionRow, Intents.FLAGS, string events, ephemeral boolean) to v14.16+ builders, enums, and MessageFlags.
tags: [v13, v14, migration, modernization, MessageEmbed, EmbedBuilder, MessageActionRow, ActionRowBuilder, Intents, GatewayIntentBits, Events, ChannelType]
apiVersion: v10
ecosystems: [discord.js v14.16+]
---

When upgrading `discord.js` v12/v13 codebases to v14.16+, replace legacy constructors, string bitfields, and deprecated flags with typed builders and API v10 enums.

## Equivalence Table (v13 -> v14.16+)

| Legacy v13 | Modern v14.16+ | Notes |
| :--- | :--- | :--- |
| `new MessageEmbed()` | `new EmbedBuilder()` (or Components V2 `ContainerBuilder`) | Use numeric hex (`0x5865f2`) or `Colors` enum |
| `new MessageActionRow()` | `new ActionRowBuilder()` | In TS type as `<ButtonBuilder>` / `<StringSelectMenuBuilder>` |
| `new MessageButton()` | `new ButtonBuilder()` | `setStyle('PRIMARY')` -> `setStyle(ButtonStyle.Primary)` |
| `new MessageSelectMenu()` | `new StringSelectMenuBuilder()` | Also `UserSelectMenuBuilder`, `RoleSelectMenuBuilder`, `ChannelSelectMenuBuilder` |
| `Intents.FLAGS.GUILDS` | `GatewayIntentBits.Guilds` | Numeric enum from `discord-api-types/v10` |
| `Permissions.FLAGS.*` | `PermissionFlagsBits.*` | BigInt bitfields |
| `client.on('message', ...)` | `client.on(Events.MessageCreate, ...)` | `'message'` was removed; `'ready'` -> `Events.ClientReady` |
| `interaction.reply({ ephemeral: true })` | `interaction.reply({ flags: MessageFlags.Ephemeral })` | `ephemeral: true` is deprecated in v14.16+ |
| `.setDMPermission(false)` | `.setContexts(InteractionContextType.Guild)` | Supports `Guild`, `BotDM`, `PrivateChannel` |
| `channel.type === 'GUILD_TEXT'` | `channel.type === ChannelType.GuildText` | `ChannelType` enum |
| `partials: ['CHANNEL', 'MESSAGE']` | `partials: [Partials.Channel, Partials.Message]` | `Partials` enum |

## Before / After Example

```ts
// ❌ Legacy v13
const { Client, Intents, MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

client.on('ready', () => console.log('Ready'));
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;
  const embed = new MessageEmbed().setTitle('Info').setColor('BLURPLE');
  const row = new MessageActionRow().addComponents(
    new MessageButton().setCustomId('ok').setLabel('OK').setStyle('SUCCESS')
  );
  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
});
```

```ts
// ✅ Modern v14.16+
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Colors,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
} from 'discord.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  allowedMentions: { parse: ['users'], repliedUser: false },
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const embed = new EmbedBuilder().setTitle('Info').setColor(Colors.Blurple);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('ok').setLabel('OK').setStyle(ButtonStyle.Success)
  );
  await interaction.reply({
    embeds: [embed],
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
});
```

## Key Verification Rules

- Use `interaction.isChatInputCommand()` instead of legacy `interaction.isCommand()`.
- In channel select menus, replace `.setChannelTypes(['GUILD_TEXT'])` with `.addChannelTypes(ChannelType.GuildText)`.
- If the bot uses `discord.js >= 14.19`, consider upgrading complex panels to **Components V2** (`components-v2-layout`).
