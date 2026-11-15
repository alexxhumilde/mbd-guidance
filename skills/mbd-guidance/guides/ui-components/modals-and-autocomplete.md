---
id: modals-and-autocomplete
title: Modals & Fast Autocomplete Handlers
category: ui-components
description: Implement ModalBuilder forms safely within Discord's 5-row limit and handle isAutocomplete() interactions under the 3-second deadline with caching and prefix filtering.
tags: [modal, ModalBuilder, TextInputBuilder, showModal, isModalSubmit, autocomplete, isAutocomplete, respond]
apiVersion: v10
ecosystems: [discord.js v14+, Discord API v10]
---

**Modals** and **Autocomplete** capture structured user input without reading chat messages or requiring privileged intents.

## Critical Rules & Gotchas

1. **`showModal()` must be the first response**: Never call `deferReply()` or `deferUpdate()` before `interaction.showModal(modal)`. Deferring consumes the initial ACK and causes `InteractionAlreadyReplied` (`40060`).
2. **Modal limits**: Maximum **5** `ActionRowBuilder<TextInputBuilder>` rows per modal, `custom_id` up to **100** chars, and prefilled `value` up to **4000** chars.
3. **Autocomplete latency budget (< 500 ms)**: Discord drops autocomplete suggestions after 3 seconds, and users notice lag above ~300 ms. **Never** run unindexed DB queries or slow external fetches on every keystroke—read from an in-memory or TTL cache.
4. **Cap `respond()` at 25 choices**: Truncate with `.slice(0, 25)` and clamp each `name` to `<= 100` chars and string `value` to `<= 100` chars.

## Modal Implementation

```ts
import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
} from 'discord.js';

export async function openTicketModal(interaction: ChatInputCommandInteraction) {
  const modal = new ModalBuilder()
    .setCustomId(`ticket:create:${interaction.user.id}`)
    .setTitle('Create Support Ticket');

  const subjectInput = new TextInputBuilder()
    .setCustomId('subject')
    .setLabel('Short summary')
    .setStyle(TextInputStyle.Short)
    .setMinLength(5)
    .setMaxLength(100)
    .setRequired(true);

  const detailsInput = new TextInputBuilder()
    .setCustomId('details')
    .setLabel('Describe the issue in detail')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(1000)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(subjectInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(detailsInput)
  );

  await interaction.showModal(modal);
}

export async function handleTicketModalSubmit(interaction: ModalSubmitInteraction) {
  const subject = interaction.fields.getTextInputValue('subject').trim();
  const details = interaction.fields.getTextInputValue('details').trim();

  await interaction.reply({
    content: `Ticket submitted: **${subject}** (${details.length} chars)`,
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
}
```

## Autocomplete Implementation with Safe Bounds

```ts
import type { AutocompleteInteraction } from 'discord.js';

export async function handleItemAutocomplete(
  interaction: AutocompleteInteraction,
  cachedItems: ReadonlyArray<{ id: string; label: string }>
) {
  const focused = interaction.options.getFocused(true);
  const query = String(focused.value).trim().toLowerCase();

  const matches = cachedItems
    .filter((item) => item.label.toLowerCase().includes(query))
    .slice(0, 25)
    .map((item) => ({
      name: item.label.slice(0, 100),
      value: item.id.slice(0, 100),
    }));

  await interaction.respond(matches);
}
```

- If a remote cache lookup fails or exceeds an internal timeout (`AbortSignal.timeout(1500)`), fall back to `await interaction.respond([])` to avoid unhandled promise rejections.
