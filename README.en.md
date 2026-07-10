# DDCourse

English · [简体中文](./README.md)

> A calm, private course player that remembers where you left off.

DDCourse is a lightweight, local-first learning player. It organizes lessons, tracks progress, bookmarks, and notes while keeping every video on your own device.

## Features

- Local folder and multi-file playback
- Automatic course grouping by subfolder
- Resume playback and per-video speed memory
- Course progress, completion state, and weekly focus time
- Search and unfinished-only filtering
- 0.5×–3× playback speed with Q/W/E/R presets
- Voice enhancement through the Web Audio API
- Previous/next lesson and 10-second seek controls
- Keyboard shortcuts and responsive mobile layout
- Progress import/export as JSON
- Drag-and-drop loading
- Installable desktop PWA experience

## Install the app

### Windows EXE installer (recommended)

Download `DDCourse-Setup-1.1.0.exe` from the project Releases page and follow the setup wizard. The installer provides:

- A selectable installation directory
- A desktop shortcut
- A Start menu entry
- Chinese and English setup interfaces
- Standard uninstallation through Windows Settings

To build the installer yourself:

```bash
npm install
npm run desktop:build
```

The generated installer is saved as `release/DDCourse-Setup-1.1.0.exe`.

### Browser installation

1. Open the deployed DDCourse site in the latest Chrome or Microsoft Edge.
2. Select **Install app** in the top-right corner.
3. Confirm the prompt. DDCourse will appear on your desktop and in the Start menu, and will open in its own window.

If the button is unavailable, open the browser menu and select **Install DDCourse** or **Apps → Install this site as an app**.

### Web development

Node.js 22.13 or newer is required.

```bash
npm install
npm run dev
```

Open the local address printed in the terminal. Installability in development depends on the browser; the full PWA installation flow is available after deployment over HTTPS.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `←` / `→` | Seek backward / forward 10 seconds |
| `P` / `[` | Previous lesson |
| `N` / `]` | Next lesson |
| `Q` / `W` / `E` / `R` | 1× / 1.25× / 1.5× / 2× |

## Privacy

Videos are played directly from your device and are never uploaded. Learning progress is stored in the browser's local storage and can be exported manually.

## Tech

React 19, TypeScript, Vinext, and plain CSS. No database, account system, or heavy client-state library.

The interface prioritizes Xiaomi MiSans. MiSans is a free commercial-use font provided by Xiaomi Inc. and is used under its official font intellectual property license agreement.

## License

MIT
