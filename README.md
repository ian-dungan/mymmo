# Freeport Landing (PlayCanvas)
A single-zone prototype inspired by EverQuest's Freeport harbor. Walk the docks, city walls, and plaza to test controls and scale.
Click the canvas to lock the mouse, then use **WASD + mouse look** to move; hold **Shift/RB** or the **south face button** to sprint. Gamepad sticks and on-screen touch controls are supported on desktop and mobile browsers. The HUD stays clean until you open the tabbed menu with **M** (keyboard), **Y** (gamepad), or the top-right **☰ Menu** button on mobile.

## Files you need
- `index.html`: Loads the PlayCanvas engine from the CDN, mounts the canvas, and defines the tabbed menu shell.
- `scripts/main.js`: Builds the Freeport scene, prevents walking through walls, adds interactive NPCs with a repeatable quest, and sets up camera controls (keyboard, gamepad, touch) plus the menu toggles.
- `styles.css`: Full-viewport canvas styling and the modal menu layout.
- `README.md`: This guide.

## Running locally
Open `index.html` in a modern browser (or serve the folder with any static server) to try the prototype.

### Talking to NPCs and selecting targets
- Walk within a few meters of an NPC to see their prompt, then press **E** (keyboard), the **south face** button on a gamepad, or tap the on-screen **Interact** button on mobile to cycle through their lines.
- Left-click or tap characters (NPCs, the training dummy, or your own player) to show their nameplate and health bar over their head, EverQuest style. Taps on mobile also select nearby NPCs or quest crates so you can interact without using the Interact button.
- Quartermaster Ryn offers a repeatable **Dock Supply Run** quest. Accept it to gather the three marked crates around the docks, then return for your reward.

### Classes, stats, and menu tabs
- The sample character is a level 8 Ranger with classic EverQuest-style attributes (STR/STA/AGI/DEX/INT/WIS/CHA) plus HP, Mana, and AC.
- Open the menu (M / Y / ☰) to view **Stats**, quest progress, inventory notes, and a **Help / Controls** tab.

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
