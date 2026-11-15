---
id: ephemeral-and-defer-lifecycle
title: Interaction Lifecycle, Deferral & Ephemeral Flags
category: ui-components
description: Master Discord's strict 3-second interaction acknowledgment deadline, MessageFlags.Ephemeral replacement for deprecated ephemeral booleans, deferReply vs deferUpdate, and editReply/followUp semantics.
tags: [ephemeral, MessageFlags, defer, deferReply, deferUpdate, editReply, followUp, 10062, timeout, interaction]
apiVersion: v10
ecosystems: [discord.js v14.16+, Discord API v10]
---

Every Discord interaction enforces a **strict 3-second deadline** for the initial acknowledgment. Missing that window invalidates the token and fails with `10062 Unknown Interaction`.

## Critical Rules & Gotchas

1. **Use `flags: MessageFlags.Ephemeral`, never `ephemeral: true`**: In `discord.js` v14.16+ and API v10, the boolean `ephemeral: true` emits deprecation warnings. Always pass `flags: MessageFlags.Ephemeral` (or combine with `MessageFlags.IsComponentsV2` via `|`).
2. **Ephemeral visibility is locked at initial ACK**: Calling `deferReply()` without `MessageFlags.Ephemeral` prevents making `editReply()` ephemeral later. Pass `flags: MessageFlags.Ephemeral` inside `deferReply(...)` whenever the final output should be private.
3. **`deferReply()` vs `deferUpdate()` on components**:
   - In Slash Commands / Context Menus: call `deferReply()` before any operation exceeding ~500 ms (DB queries, HTTP APIs, media generation).
   - In Buttons / Select Menus that **update the current message**: call `deferUpdate()` followed by `editReply()`, not `deferReply()`.
   - In Buttons / Select Menus that **open a separate ephemeral reply**: call `deferReply({ flags: MessageFlags.Ephemeral })`.
4. **Never reply twice**: Guard global `catch` handlers with `interaction.replied || interaction.deferred` before responding.

## Safe Lifecycle Pattern (`discord.js` v14.16+)

```ts
import { MessageFlags, type ChatInputCommandInteraction } from 'discord.js';

export async function runSlowCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const report = await generateHeavyReport(interaction.guildId!);

  await interaction.editReply({
    content: report.summary,
    allowedMentions: { parse: [] },
  });
}

export async function safeReplyError(
  interaction: ChatInputCommandInteraction,
  message: string
) {
  const payload = {
    content: message,
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  };

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(payload);
    return;
  }

  await interaction.reply(payload);
}
```

## Token Expiration Window

- After initial ACK (`reply` or `defer*`), `interaction.token` remains valid for **15 minutes** for `editReply()`, `deleteReply()`, and `followUp()`.
- If a background job exceeds 15 minutes, post completion notices via an explicit channel (`channel.send`) with verified permissions instead of `followUp()`.
