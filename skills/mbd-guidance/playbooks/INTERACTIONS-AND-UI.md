# Playbook: Interactions & Modern Discord UI

Use this playbook when designing or auditing Discord interactive flows (Slash Commands, Context Menus, Components V2, Buttons, Select Menus, Modals, and Autocomplete).

## Design & Review Checklist

1. **Command Registration & Contexts**
   - Do commands use `SlashCommandBuilder` / `ContextMenuCommandBuilder` with `.setContexts(...)` and `.setIntegrationTypes(...)` instead of deprecated `.setDMPermission()`?
   - Is REST deployment (`Routes.applicationCommands` / `Routes.applicationGuildCommands`) separated from `Events.ClientReady` startup to avoid rate limits when scaling shards?
   - Related guide: `slash-commands-and-options`.

2. **3-Second Deadline & Ephemeral Visibility**
   - Do handlers calling databases, LLMs, or external APIs invoke `deferReply()` / `deferUpdate()` before slow `await` calls?
   - Do ephemeral responses use `flags: MessageFlags.Ephemeral` (combined via bitwise OR with `MessageFlags.IsComponentsV2` when applicable) instead of deprecated `ephemeral: true`?
   - Does the global error handler check `interaction.deferred || interaction.replied` before sending error feedback?
   - Related guide: `ephemeral-and-defer-lifecycle`.

3. **Components V2 (`IsComponentsV2`)**
   - When `MessageFlags.IsComponentsV2` is enabled, does the payload omit `content`, `embeds`, `stickers`, and `poll`?
   - Do containers respect the 40 total component cap and 4000 combined characters across `TextDisplayBuilder` nodes?
   - Do `ThumbnailBuilder` and `MediaGalleryItemBuilder` include accessible descriptions via `setDescription`?
   - Related guide: `components-v2-layout`.

4. **Modals & Autocomplete**
   - Is `showModal()` invoked as the initial acknowledgment without calling `deferReply()` beforehand?
   - Do `isAutocomplete()` handlers respond within < 500 ms using cached data, capping results at `<= 25` choices and strings `<= 100` chars?
   - Related guide: `modals-and-autocomplete`.

5. **Component State (`custom_id`)**
   - Do buttons and select menus encode minimal state in `custom_id` (`<= 100` chars) using `namespace:action:ownerId:...`?
   - Does the handler verify `interaction.user.id === ownerId` before mutating state or paginating?
   - Related guide: `stateful-custom-ids-and-pagination`.
