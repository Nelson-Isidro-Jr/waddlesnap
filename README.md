# WaddleSnap

A cute pink penguin screenshot tool for Windows.

- **Same-size snaps** – save sizes (e.g. 1280×720), press `Ctrl+Alt+S`, move the frame, press `Enter`. The image is always exactly that many pixels.
- **Free snap** – `Ctrl+Alt+F`, draw any box, optionally save it as a size.
- **Super Paste** – `Ctrl+Alt+P` pastes your clipboard N times in one go (optional Enter/Tab/Space between).

## Build
```
npm ci
npx electron-builder --win nsis --x64
```
The Super Paste helper (`src/bin/waddlepaste.exe`) is built from `native/waddlepaste.c` with MinGW-w64.

## Tests
`.github/workflows/windows-e2e.yml` builds the installer on Windows, installs it, and drives the real app with real keyboard/mouse input (`test/windows`).
