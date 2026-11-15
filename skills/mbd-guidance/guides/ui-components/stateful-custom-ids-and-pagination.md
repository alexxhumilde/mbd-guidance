---
id: stateful-custom-ids-and-pagination
title: Stateful Custom IDs, Ownership Checks & Pagination
category: ui-components
description: Design resilient, restart-safe Discord buttons and select menus using structured custom_ids, strict user ownership checks, and clean collector timeouts.
tags: [custom_id, pagination, buttons, select-menu, collector, MessageComponentInteraction, state, ownership]
apiVersion: v10
ecosystems: [discord.js v14+, Serverless HTTP Interactions]
---

In-memory `MessageComponentCollector` instances lose all state on bot restarts or deploys. For durable buttons and select menus, encode minimal verifiable state directly into **`custom_id`**.

## Critical Rules & Gotchas

1. **100-character hard limit**: Each `custom_id` is capped at **100 characters** and must be unique within the same message.
2. **Standard format `<namespace>:<action>:<ownerId>:<page>[:payload]`**:
   - Enables stateless routing from `Events.InteractionCreate` even days after a restart or in serverless environments.
   - Never store sensitive or authoritative trust values (prices, admin flags) in `custom_id` alone—validate authorization server-side.
3. **Mandatory ownership verification (`ownerId`)**: For user-initiated paginators or action menus, check `interaction.user.id === ownerId`. Reject other users with an ephemeral notice (`MessageFlags.Ephemeral`) so bystanders cannot hijack someone else's menu.
4. **Clean collector expiration**: When using short-lived collectors (e.g., 30s confirmation prompts), attach an `'end'` listener to disable buttons (`setDisabled(true)`) instead of leaving stale buttons that show *"This interaction failed"*.

## Stateless Router & Pagination Pattern

```ts
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type ButtonInteraction,
} from 'discord.js';

export function buildPaginationRow(ownerId: string, page: number, totalPages: number) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`items:page:${ownerId}:${Math.max(1, page - 1)}`)
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId(`items:indicator:${ownerId}:${page}`)
      .setLabel(`Page ${page} / ${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`items:page:${ownerId}:${Math.min(totalPages, page + 1)}`)
      .setLabel('Next')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages)
  );
}

export async function handlePaginationButton(interaction: ButtonInteraction) {
  const [namespace, action, ownerId, rawPage] = interaction.customId.split(':');
  if (namespace !== 'items' || action !== 'page') {
    return;
  }

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'Only the user who ran this command can control these pagination buttons.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const page = Number.parseInt(rawPage, 10);
  if (!Number.isFinite(page) || page < 1) {
    await interaction.reply({ content: 'Invalid page index.', flags: MessageFlags.Ephemeral });
    return;
  }

  const { content, totalPages } = await fetchPage(interaction.guildId!, page);
  const clampedPage = Math.min(page, Math.max(1, totalPages));

  await interaction.update({
    content,
    components: [buildPaginationRow(ownerId, clampedPage, totalPages)],
  });
}
```
