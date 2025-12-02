# Freeport Landing (PlayCanvas)
A two-zone prototype inspired by EverQuest's Freeport harbor. The Freeport city footprint is ~20x larger with multiple districts, a harbor lighthouse, and lantern-lit plazas, while the connected **Freeport Desert** zone stretches east to an oasis camp with tents, palms, and roaming wildlife. A lightweight day/night cycle shifts the sun, ambient light, and lantern/beacon glow to keep the docks and desert feeling alive at different hours.

Click the canvas to lock the mouse, then use **WASD + mouse look** to move; hold **Shift** (keyboard) or the gamepad triggers to sprint. Tap **Tab** (keyboard) or **RB** (gamepad) to target whatever sits under the center of the screen; taps on mobile can also target nearby characters and crates. Gamepad sticks and on-screen touch controls are supported on desktop and mobile browsers. The HUD stays clean until you open the tabbed menu with **M** (keyboard), **A** (gamepad confirm), or the top-right **☰ Menu** button on mobile; **B** on gamepad always cancels/clears targets and closes menus.

## Files you need
- `index.html`: Loads the PlayCanvas engine from the CDN, mounts the canvas, and defines the tabbed menu shell.
- `scripts/main.js`: Builds the Freeport + desert scenes, prevents walking through walls, adds interactive NPCs with a repeatable quest, EQ-style combat, passive desert wildlife, and sets up camera controls (keyboard, gamepad, touch) plus the menu toggles.
- `styles.css`: Full-viewport canvas styling and the modal menu layout (including tabbed inventory/equipment lists).
- `README.md`: This guide.

## Running locally
Open `index.html` in a modern browser (or serve the folder with any static server) to try the prototype.

### Talking to NPCs, selecting targets, and fighting
- Walk within a few meters of an NPC to see their prompt, then press **E** (keyboard), **A** on gamepad (confirm/interaction), or tap the on-screen **Interact** button on mobile to cycle through their lines. **B** on gamepad cancels/clears a target and closes menus.
- Left-click, press **Tab/RB**, or tap characters (NPCs, enemies, the training dummy, or your own player) to show their nameplate and health bar over their head, EverQuest style. Taps on mobile also select nearby NPCs or quest crates so you can interact without using the Interact button. D-pad left/right cycles between nearby enemies when a target is available.
- Quartermaster Ryn offers a repeatable **Dock Supply Run** quest. Accept it (or grab a crate to auto-start) to gather the three marked crates around the docks, then return for your reward.
- Combat uses EQ-inspired abilities: press **1** (keyboard), **X** (gamepad west face), or tap **Attack** (mobile) for melee, and **2** for a ranged Ember Bolt. The training dummy, a dockside bat, and passive desert skitters can be used to test combat; the bat starts passive, becomes hostile if attacked, and respawns 30 seconds after defeat with 20 HP.
- Targeting and tabs: d-pad left/right (gamepad) cycles enemies when the world is active and cycles tabs when the menu is open. **Q/E** (keyboard) cycle tabs when the menu is visible.

### Classes, stats, and gear
- The sample character is a level 8 Ranger with classic EverQuest-style attributes (STR/STA/AGI/DEX/INT/WIS/CHA) plus HP, Mana, and AC.
- The tabbed menu (M / A / ☰) holds **Stats**, **Quests**, **Equipment**, **Inventory**, and **Help/Controls**. Equip items from the Inventory tab to move them into your worn gear and update your stats instantly; **B** closes the menu on gamepad.

## Git remote
This workspace is configured with the GitHub remote:

- `origin`: https://github.com/ian-dungan/mymmo.git

If you need to re-create it, run:

```bash
git remote add origin https://github.com/ian-dungan/mymmo.git
```

## Pushing your changes
When you are ready to publish your work, push the current branch to GitHub:

```bash
git push origin work
```

If you want the branch to become the default line of development, open a pull request on GitHub and merge it into `main`.

## Committing and pushing in one go
If you've made local edits and want to save them to the repo, run the full flow:

```bash
git status          # review what's changed
git add <files>     # or `git add .` for everything
git commit -m "describe your change"
git push origin work
```

After pushing, create or update a pull request on GitHub to merge the `work` branch into `main` when you're satisfied.

## Resolving merge conflicts on GitHub
When GitHub shows conflict markers, the options in the UI map to the versions of the file like this:
- **Current change**: your branch's version of the code.
- **Incoming change**: the version from the branch you are merging into yours (often `main` or a PR source).
- **Accept both**: keeps both blocks so you can manually edit them into a single clean result afterward.

Choose the block that has the correct logic or content. After accepting, edit the merged text to remove duplicates or leftover markers, then save and commit the resolution.
