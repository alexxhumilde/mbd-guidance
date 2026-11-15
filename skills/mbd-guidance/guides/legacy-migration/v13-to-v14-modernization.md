---
id: v13-to-v14-modernization
title: Migrating & Upgrading Discord Bots to discord.js v14.28.1
category: legacy-migration
description: Complete equivalence table and migration guide from discord.js v12/v13 and older v14 releases (MessageEmbed, Intents.FLAGS, ready event, ephemeral boolean, fetchPinned, ModalBuilder.addComponents) to discord.js v14.28.1 builders, enums, MessageFlags, and fetchPins.
tags: [v13, v14, v14.28, migration, modernization, MessageEmbed, EmbedBuilder, MessageActionRow, ActionRowBuilder, Intents, GatewayIntentBits, Events, ChannelType, fetchPinned, fetchPins, ClientReady]
apiVersion: v10
ecosystems: [discord.js v14.28.1]
---

When upgrading `discord.js` v12/v13 or older v14 bots to **v14.28.1**, replace legacy constructors, deprecated string events, and superseded manager methods with modern typed APIs.

## Equivalence Table (v13 / Early v14 -> v14.28.1)

| Legacy API | Modern `v14.28.1` | Notes |
| :--- | :--- | :--- |
| `new MessageEmbed()` | `new EmbedBuilder()` (or Components V2 `ContainerBuilder`) | Use numeric hex (`0x5865f2`) or `Colors` enum |
| `new MessageActionRow()` | `new ActionRowBuilder()` | In TS type as `<ButtonBuilder>` / `<StringSelectMenuBuilder>` |
| `new MessageButton()` | `new ButtonBuilder()` | `setStyle('PRIMARY')` -> `setStyle(ButtonStyle.Primary)` |
| `new MessageSelectMenu()` | `new StringSelectMenuBuilder()` | Also `UserSelectMenuBuilder`, `RoleSelectMenuBuilder`, `ChannelSelectMenuBuilder` |
| `Intents.FLAGS.GUILDS` | `GatewayIntentBits.Guilds` | Numeric enum from `discord-api-types/v10` |
| `Permissions.FLAGS.*` | `PermissionFlagsBits.*` | BigInt bitfields |
| `client.on('message', ...)` | `client.on(Events.MessageCreate, ...)` | `'message'` was removed |
| `client.once('ready', ...)` | `client.once(Events.ClientReady, ...)` | `'ready'` was deprecated in `14.22.0` (`clientReady`) |
| `interaction.reply({ ephemeral: true })` | `interaction.reply({ flags: MessageFlags.Ephemeral })` | `ephemeral: true` deprecated in `14.16+` |
| `.setDMPermission(false)` | `.setContexts(InteractionContextType.Guild)` | Deprecated in `14.15+`; pair with `setIntegrationTypes()` |
| `channel.messages.fetchPinned()` | `channel.messages.fetchPins()` | Paginated pins endpoint introduced in `14.22.0` |
| `modal.addComponents(new ActionRowBuilder().addComponents(...))` | `modal.addLabelComponents(new LabelBuilder()...)` | `addComponents()` on `ModalBuilder` deprecated in `14.23+` |
| `guild.setOwner(...)` | Removed from API | Guild ownership transfer options deprecated in `14.23.0` |
| `channel.type === 'GUILD_TEXT'` | `channel.type === ChannelType.GuildText` | `ChannelType` enum |
| `partials: ['CHANNEL', 'MESSAGE']` | `partials: [Partials.Channel, Partials.Message]` | `Partials` enum |

## Modern v14.22 – v14.28.1 Capabilities

- **Rich Modals (`14.23` – `14.26`)**: `LabelBuilder`, `TextDisplayBuilder`, Select Menus, `FileUploadBuilder`, `RadioGroupBuilder`, `CheckboxGroupBuilder`, and `CheckboxBuilder` inside modals (`modals-and-autocomplete`).
- **Role Insights & Gradient Colors (`14.22` / `14.27`)**: `guild.roles.fetchMemberCounts()` and gradient role colors via `RoleColorsResolvable`.
- **Voice Messages (`14.27`)**: `MessageFlags.IsVoiceMessage` for audio attachments with waveform metadata.
- **Interaction-Scoped Channel Permissions (`14.28.0` – `14.28.1`)**: `channel.permissions` and `channel.appPermissions` resolved safely in interaction scope (`permissions-and-mention-safety`).

## Before / After Example

```ts
// ❌ Legacy v13 / early v14
const { Client, Intents, MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

client.on('ready', () => console.log('Ready'));
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;
  const pinned = await interaction.channel.messages.fetchPinned();
  const embed = new MessageEmbed().setTitle(`Pins: ${pinned.size}`).setColor('BLURPLE');
  const row = new MessageActionRow().addComponents(
    new MessageButton().setCustomId('ok').setLabel('OK').setStyle('SUCCESS')
  );
  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
});
```

```ts
// ✅ Modern v14.28.1
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
  if (!interaction.isChatInputCommand() || !interaction.channel) return;
  const pinsPage = await interaction.channel.messages.fetchPins();
  const embed = new EmbedBuilder().setTitle(`Pins: ${pinsPage.items.length}`).setColor(Colors.Blurple);
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
- Prefer **Components V2** (`components-v2-layout`) over `EmbedBuilder` for new status dashboards and interactive cards.
