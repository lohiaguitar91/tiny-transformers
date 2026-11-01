# pocket-arcade

A tiny retro handheld in a single HTML file, with three cartridges: **Snake**, **Bricks** and **Blocks**.
No dependencies, no build step, no network needed once it has loaded. Same spirit as the other
demos here: open `index.html` and it runs.

## Play it offline on a phone

Pick whichever is easiest:

- **Install it as an app (recommended).** Serve this folder over HTTPS (GitHub Pages works) and open
  `index.html` on the phone. A service worker caches the game on first load; when the LED on the
  console turns green and reads `OFFLINE OK`, it will keep working with no connection.
  Then use *Add to Home Screen* (iOS Safari: Share → Add to Home Screen; Android Chrome: menu →
  Install app) to get a full-screen icon on the home screen.
- **Just the file.** Save `index.html` to the phone and open it. Everything the game needs is inside
  the one file. Android Chrome opens it directly; on iOS, open it from the Files app.

## Controls

| Action | Touch | On-screen pad | Keyboard |
| --- | --- | --- | --- |
| Power on | tap the screen | any button | Enter |
| Menu | tap a cartridge (tap again to play) | D-pad + A | arrows + Z |
| Snake | swipe on the screen | D-pad | arrows / WASD |
| Bricks | drag to move the paddle, tap to launch | D-pad left/right, A to launch | arrows, Z |
| Blocks | drag sideways to move, tap to rotate, drag down to soft-drop, flick down to hard-drop | D-pad, A/B rotate, Up hard-drop | arrows, Z/X, Up |
| Pause | | START | Enter / Esc |
| Options (sound, screen palette, shell colour, LCD grid, rumble) | tap `SELECT:OPTIONS` | SELECT | Shift |
| Mute | tap `♪ sound` on the bezel | | M |

High scores and settings are kept in the browser's local storage on the device.
There is one secret: a famous ten-button code, entered on the menu, unlocks a fifth shell colour.

## Files

- `index.html` — the whole game (markup, styles, 160×144 pixel renderer, bitmap font, chip-tune synth, three games).
- `sw.js` — service worker that caches the game for offline play when served over HTTPS.
- `manifest.webmanifest`, `icon-*.png`, `apple-touch-icon.png` — home-screen install metadata.
