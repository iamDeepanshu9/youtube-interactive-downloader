# Repository Guidelines

## Project Structure & Module Organization

This repository contains a single interactive Node.js CLI. The executable and application logic live in `bin/ytdl.js`; keep its shebang intact so the package can expose the `ytdl` command. `package.json` defines the ES-module package, dependencies, and npm scripts, while `package-lock.json` pins dependency versions. `README.md` documents installation and user-facing behavior. The root `ytdl` symlink points to the CLI entry point. There are currently no dedicated test or asset directories; add tests under `test/` as the project grows.

## Build, Test, and Development Commands

- `npm ci`: install the exact dependency versions from the lockfile.
- `npm start`: launch the interactive CLI through Node.js.
- `./ytdl`: run the local executable directly.
- `node bin/ytdl.js "https://youtu.be/..."`: start with a URL and skip the first prompt.
- `node --check bin/ytdl.js`: perform a quick syntax check.

There is no compilation step. Local execution requires `yt-dlp` on `PATH`; `ffmpeg` is needed for merging video/audio and format conversion. No automated test command is configured yet.

## Coding Style & Naming Conventions

Use modern JavaScript ES modules, two-space indentation, semicolons, and single-quoted strings, matching `bin/ytdl.js`. Name functions and variables in `camelCase`, constants descriptively, and files in lowercase. Keep process execution argument-based with `spawn` where possible; avoid interpolating user input into shell commands. Preserve concise comments around non-obvious CLI behavior. No formatter or linter is configured, so review style consistency before submitting.

## Testing Guidelines

For every change, run `node --check bin/ytdl.js` and manually exercise affected prompts with a public, short YouTube URL. Verify cancellation, invalid URLs, output-folder handling, and the relevant audio/video path. If adding automated tests, use `node:test`, name files `test/*.test.js`, and add an `npm test` script.

## Commit & Pull Request Guidelines

No Git history is available in this checkout to establish an existing convention. Use short, imperative commit subjects such as `Handle invalid custom output paths`. Keep commits focused. Pull requests should explain the user-visible change, list verification commands, link related issues, and include terminal output or screenshots when prompts or progress display change. Do not commit downloaded media, credentials, cookies, or machine-specific paths.
