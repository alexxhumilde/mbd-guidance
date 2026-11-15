---
id: modals-and-autocomplete
title: Rich Modals (LabelBuilder, FileUpload, Selects, Radio/Checkbox) & Autocomplete
category: ui-components
description: Implement modern discord.js v14.23+–v14.28.1 ModalBuilder forms using LabelBuilder, FileUploadBuilder, Select Menus, Radio/Checkbox components, TextDisplayBuilder, and fast isAutocomplete() handlers under the 3-second deadline.
tags: [modal, ModalBuilder, LabelBuilder, FileUploadBuilder, RadioGroupBuilder, CheckboxBuilder, CheckboxGroupBuilder, TextInputBuilder, TextDisplayBuilder, addLabelComponents, getUploadedFiles, showModal, isModalSubmit, autocomplete, isAutocomplete, respond]
apiVersion: v10
ecosystems: [discord.js v14.28+, Discord API v10]
---

Modern **Modals** (`discord.js v14.23+` – `v14.28.1`) and **Autocomplete** capture structured forms, file uploads, select menus, and radio/checkbox inputs without reading chat messages or requesting privileged intents.

## Critical Rules & Gotchas

1. **`showModal()` must be the first response**: Never call `deferReply()` or `deferUpdate()` before `interaction.showModal(modal)`. Deferring consumes the initial ACK and causes `InteractionAlreadyReplied` (`40060`).
2. **Use `addLabelComponents()` and `addTextDisplayComponents()` (`14.23+`)**: `ModalBuilder.addComponents()` and wrapping `TextInputBuilder` directly in `ActionRowBuilder` are **deprecated** in modern `discord.js`. Wrap modal controls inside `LabelBuilder` (`setLabel`, optional `setDescription`).
3. **Modal limits**: Maximum **5** top-level components per modal (`LabelBuilder` or `TextDisplayBuilder`), `custom_id` up to **100** chars, and `TextInputBuilder` values up to **4000** chars.
4. **Rich Modal inputs (`14.23+` – `14.28.1`)**:
   - **Select menus inside modals**: `setStringSelectMenuComponent`, `setUserSelectMenuComponent`, `setRoleSelectMenuComponent`, `setChannelSelectMenuComponent`, `setMentionableSelectMenuComponent`.
   - **File uploads (`14.24.0+` / `14.28.0+`)**: `setFileUploadComponent` with `FileUploadBuilder` (supports file type filtering via `fileTypes`). Read attachments with `interaction.fields.getUploadedFiles(customId)`.
   - **Radio & Checkboxes (`14.26.0+`)**: `setRadioGroupComponent`, `setCheckboxGroupComponent`, `setCheckboxComponent`. Read with `getRadioGroup()`, `getCheckboxGroup()`, and `getCheckbox()`.
5. **Autocomplete latency budget (< 500 ms)**: Discord drops autocomplete suggestions after 3 seconds. Read from an in-memory or TTL cache, cap `respond()` at `.slice(0, 25)`, and clamp `name` / string `value` to `<= 100` chars.

## Modern Rich Modal Implementation (`discord.js` v14.28+)

```ts
import {
  FileUploadBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
} from 'discord.js';

export async function openTicketModal(interaction: ChatInputCommandInteraction) {
  const modal = new ModalBuilder()
    .setCustomId(`ticket:create:${interaction.user.id}`)
    .setTitle('Create Support Ticket')
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('Provide a clear summary and optional log attachment.')
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Priority')
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId('priority')
            .setRequired(true)
            .addOptions(
              new StringSelectMenuOptionBuilder().setLabel('Normal').setValue('normal'),
              new StringSelectMenuOptionBuilder().setLabel('Urgent').setValue('urgent')
            )
        ),
      new LabelBuilder()
        .setLabel('Summary')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId('subject')
            .setStyle(TextInputStyle.Short)
            .setMinLength(5)
            .setMaxLength(100)
            .setRequired(true)
        ),
      new LabelBuilder()
        .setLabel('Details')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId('details')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(1000)
            .setRequired(true)
        ),
      new LabelBuilder()
        .setLabel('Screenshot / Log')
        .setDescription('Optional diagnostic attachment')
        .setFileUploadComponent(
          new FileUploadBuilder().setCustomId('attachment').setMaxValues(1).setRequired(false)
        )
    );

  await interaction.showModal(modal);
}

export async function handleTicketModalSubmit(interaction: ModalSubmitInteraction) {
  const [priority] = interaction.fields.getStringSelectValues('priority');
  const subject = interaction.fields.getTextInputValue('subject').trim();
  const files = interaction.fields.getUploadedFiles('attachment');

  await interaction.reply({
    content: `Ticket [${priority}]: **${subject}** (${files?.size ?? 0} file(s))`,
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
