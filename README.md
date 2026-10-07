# YouTube Interactive Downloader

An interactive command-line tool for downloading YouTube videos or audio with a guided quality picker, custom filenames, output-folder selection, and live progress. It uses `yt-dlp` for downloads and `ffmpeg` for merging and conversion.

> Use this tool only for content you own or have permission to download, and follow YouTube's Terms of Service and applicable copyright law.

## Features

- Detects available resolutions, frame rates, and approximate file sizes
- Downloads the best available quality or a chosen resolution
- Exports audio as MP3, M4A, or WAV
- Accepts custom `yt-dlp` format strings
- Supports automatic or custom filenames
- Runs on macOS, Linux, and Windows through Node.js

## Requirements

- [Node.js](https://nodejs.org/en/download) 20.17 or newer
- [yt-dlp](https://github.com/yt-dlp/yt-dlp/wiki/Installation)
- [ffmpeg](https://ffmpeg.org/download.html) for merging video/audio and converting formats

Confirm that all three commands are available:

```bash
node --version
yt-dlp --version
ffmpeg -version
```

### Install system tools

macOS with Homebrew:

```bash
brew install yt-dlp ffmpeg
```

Windows with Winget:

```powershell
winget install --id yt-dlp.yt-dlp
winget install --id Gyan.FFmpeg
```

Linux package names vary by distribution. For Debian or Ubuntu, install `ffmpeg`, then follow the official yt-dlp installation guide linked above to obtain a current yt-dlp release.

## Download and Run

1. Select **Code → Download ZIP** on this GitHub repository.
2. Extract the ZIP and open a terminal in the extracted folder.
3. Install the Node.js dependencies:

   ```bash
   npm ci
   ```

4. Start the tool:

   ```bash
   npm start
   ```

Paste a YouTube URL when prompted. You can also supply it immediately:

```bash
npm start -- "https://www.youtube.com/watch?v=VIDEO_ID"
```

On macOS or Linux, `./ytdl` is an equivalent shortcut. Windows users should use `npm start`.

## How It Works

The CLI checks its external dependencies, requests video metadata, and builds a menu from the formats returned by yt-dlp. After you choose a format, destination, and filename, it streams yt-dlp's native progress output. Downloads are saved only to the folder you select.

For high-resolution video, YouTube commonly provides separate video and audio streams; ffmpeg combines them into one MP4. Audio options use ffmpeg when conversion is needed.

## Troubleshooting

- **`yt-dlp is not installed or not in PATH`**: install yt-dlp, restart the terminal, and rerun `yt-dlp --version`.
- **Merging or audio conversion fails**: install ffmpeg and confirm `ffmpeg -version` works.
- **A previously working URL fails**: update yt-dlp (`brew upgrade yt-dlp`, `winget upgrade yt-dlp.yt-dlp`, or the update method for your installation).
- **Restricted/private videos**: this tool intentionally does not collect login credentials or browser cookies.

## Development

```bash
npm ci
node --check bin/ytdl.js
npm start
```

The application is a single ES-module entry point at `bin/ytdl.js`. See `AGENTS.md` for contributor conventions.

## License

MIT
