# Freeport Landing (PlayCanvas)
A single-zone prototype inspired by EverQuest's Freeport harbor. Walk the docks, city walls, and plaza to test controls and scale.
Click the canvas to lock the mouse, then use **WASD + mouse look** to move; hold **Shift/RB** or the **south face button** to sprint. Gamepad sticks and on-screen touch controls are supported on desktop and mobile browsers.

## Files you need
- `index.html`: Loads the PlayCanvas engine from the CDN, wires up the HUD, and mounts the canvas.
- `scripts/main.js`: Builds the Freeport scene, prevents walking through walls, and sets up camera controls (keyboard, gamepad, and touch).
- `styles.css`: Full-viewport canvas styling and HUD appearance.
- `README.md`: This guide.
- `FULL_SOURCE.md`: A copy-paste-ready listing of every source file in this prototype.

## Running locally
Open `index.html` in a modern browser (or serve the folder with any static server) to try the prototype.

## Resolving merge conflicts on GitHub
When GitHub shows conflict markers, the options in the UI map to the versions of the file like this:
- **Current change**: your branch's version of the code.
- **Incoming change**: the version from the branch you are merging into yours (often `main` or a PR source).
- **Accept both**: keeps both blocks so you can manually edit them into a single clean result afterward.

Choose the block that has the correct logic or content. After accepting, edit the merged text to remove duplicates or leftover markers, then save and commit the resolution.
