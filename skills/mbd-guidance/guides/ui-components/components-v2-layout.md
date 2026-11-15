---
id: components-v2-layout
title: Discord Components V2 Layout (Containers, Sections, TextDisplay & Media)
category: ui-components
description: Build rich structured Discord message layouts using Components V2 (MessageFlags.IsComponentsV2, ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder, ThumbnailBuilder, MediaGalleryBuilder) instead of legacy embeds.
tags: [components-v2, ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder, ThumbnailBuilder, MediaGalleryBuilder, IsComponentsV2, MessageFlags, embeds, ui]
apiVersion: v10
ecosystems: [discord.js v14.19+, Discord API v10]
---

Use **Components V2** (`MessageFlags.IsComponentsV2`) for structured dashboard cards, status panels, receipts, and rich interactive messages instead of stacking legacy `EmbedBuilder` + `content`.

## Critical Rules & Constraints

1. **Mandatory flag**: Every Components V2 response **MUST** set `flags: MessageFlags.IsComponentsV2` (combine with `MessageFlags.Ephemeral` via bitwise OR: `MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral`).
2. **`content` and `embeds` are forbidden**: When `MessageFlags.IsComponentsV2` is active, Discord **rejects** (`50035 Invalid Form Body`) any payload containing `content`, `embeds`, `stickers`, or `poll`. All text must live inside `TextDisplayBuilder` (`type: 10`).
3. **Total component & character caps**: A Components V2 message supports up to **40 components total** (including nested children inside `ContainerBuilder` and `SectionBuilder`) and up to **4000 combined characters** across all `TextDisplayBuilder` instances.
4. **Irreversible flag on edits**: Once a message is created with `IsComponentsV2`, you cannot strip that flag in subsequent `edit()` / `editReply()` calls; updates must keep the V2 component structure.

## Modern Implementation (`discord.js` v14+)

```ts
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from 'discord.js';

const headerSection = new SectionBuilder()
  .addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## Server Status\nAll nodes are healthy.'),
    new TextDisplayBuilder().setContent('-# API Latency: `42ms` · Uptime: `99.98%`')
  )
  .setThumbnailAccessory(
    new ThumbnailBuilder()
      .setURL('https://cdn.example.com/status-ok.png')
      .setDescription('Green operational status badge')
  );

const actionsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
    .setCustomId(`status:refresh:${interaction.user.id}`)
    .setLabel('Refresh')
    .setStyle(ButtonStyle.Secondary)
);

const card = new ContainerBuilder()
  .setAccentColor(0x22c55e)
  .addSectionComponents(headerSection)
  .addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  )
  .addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder()
        .setURL('https://cdn.example.com/metrics-graph.png')
        .setDescription('24-hour API latency chart')
    )
  )
  .addActionRowComponents(actionsRow);

await interaction.reply({
  components: [card],
  flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
});
```

## Raw Discord REST / HTTP Interactions Payload (API v10)

For serverless handlers without builders (e.g., Cloudflare Workers / Next.js):

```json
{
  "type": 4,
  "data": {
    "flags": 32768,
    "components": [
      {
        "type": 17,
        "accent_color": 2278750,
        "components": [
          {
            "type": 10,
            "content": "## Control Panel\nReady for commands."
          },
          {
            "type": 14,
            "divider": true,
            "spacing": 1
          },
          {
            "type": 1,
            "components": [
              {
                "type": 2,
                "style": 2,
                "label": "Refresh",
                "custom_id": "panel:refresh:1234567890"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

- `1 << 15` (`32768`) = `IS_COMPONENTS_V2`
- `1 << 6` (`64`) = `EPHEMERAL`
- Component types: `17` Container, `9` Section, `10` Text Display, `11` Thumbnail, `12` Media Gallery, `13` File, `14` Separator.

## Fallback & Compatibility

- If your project is pinned to `discord.js` `< 14.19` and cannot upgrade yet, fall back to `EmbedBuilder` (max 25 `fields`) and do not mix `IsComponentsV2` with `embeds`.
- Always provide `.setDescription(...)` alt text on `ThumbnailBuilder` and `MediaGalleryItemBuilder` for accessibility.
