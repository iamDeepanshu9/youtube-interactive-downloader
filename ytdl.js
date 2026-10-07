#!/usr/bin/env node

import { execSync, spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { input, select, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';

// Graceful exit on Ctrl+C
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\nOperation cancelled by user. Goodbye!'));
  process.exit(0);
});

// Format seconds into HH:MM:SS or MM:SS
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return 'Unknown';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Format bytes into human readable format
function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return ` (~${val.toFixed(1)} ${units[i]})`;
}

// Format numbers (e.g. view count)
function formatNumber(num) {
  if (!num) return 'N/A';
  return new Intl.NumberFormat().format(num);
}

// Display banner
function showBanner() {
  console.clear();
  console.log(chalk.bold.hex('#FF0000')('╔═══════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.hex('#FF0000')('║') + chalk.bold.white('          ▶  YOUTUBE INTERACTIVE DOWNLOADER           ') + chalk.bold.hex('#FF0000')('║'));
  console.log(chalk.bold.hex('#FF0000')('║') + chalk.dim.gray('           Powered by yt-dlp & ffmpeg engine          ') + chalk.bold.hex('#FF0000')('║'));
  console.log(chalk.bold.hex('#FF0000')('╚═══════════════════════════════════════════════════════╝'));
  console.log();
}

// Check dependencies
function checkDependencies() {
  try {
    execSync('yt-dlp --version', { stdio: 'ignore' });
  } catch {
    console.error(chalk.red.bold('Error: yt-dlp is not installed or not in PATH!'));
    console.log(chalk.yellow('Install it via Homebrew: brew install yt-dlp'));
    process.exit(1);
  }

  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
  } catch {
    console.log(chalk.yellow('Warning: ffmpeg is not found. Merging high-res video and audio may fail.'));
    console.log(chalk.yellow('Install it via Homebrew: brew install ffmpeg'));
  }
}

// Fetch video metadata
async function fetchVideoData(url) {
  const spinner = ora({
    text: chalk.cyan('Fetching video information & available streams...'),
    color: 'yellow'
  }).start();

  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', [
      '--dump-single-json',
      '--no-playlist',
      '--no-warnings',
      '--skip-download',
      url
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        spinner.succeed(chalk.green('Video metadata loaded successfully!'));
        try {
          const firstBrace = stdout.indexOf('{');
          const lastBrace = stdout.lastIndexOf('}');
          if (firstBrace === -1 || lastBrace === -1) {
            throw new Error('No JSON object found in output');
          }
          const jsonStr = stdout.slice(firstBrace, lastBrace + 1);
          const json = JSON.parse(jsonStr);
          resolve(json);
        } catch (err) {
          reject(new Error(`Failed to parse video info: ${err.message}`));
        }
      } else {
        spinner.fail(chalk.red('Failed to fetch video information.'));
        const errMessage = stderr || stdout || 'Unknown error occurred';
        if (errMessage.includes('Private video') || errMessage.includes('Sign in')) {
          reject(new Error('This video is private, restricted, or requires login.'));
        } else if (errMessage.includes('Incomplete YouTube ID') || errMessage.includes('URL')) {
          reject(new Error('Invalid YouTube URL. Please check the link.'));
        } else {
          reject(new Error(errMessage.trim()));
        }
      }
    });
  });
}

// Extract available resolutions dynamically from yt-dlp formats
function buildQualityOptions(data) {
  const formats = data.formats || [];
  
  // Find all distinct video heights
  const resolutionMap = new Map();

  for (const f of formats) {
    if (f.vcodec && f.vcodec !== 'none' && f.height) {
      const height = f.height;
      const fps = f.fps || 30;
      const size = f.filesize || f.filesize_approx || 0;

      if (!resolutionMap.has(height)) {
        resolutionMap.set(height, { height, maxFps: fps, approxSize: size });
      } else {
        const existing = resolutionMap.get(height);
        if (fps > existing.maxFps) existing.maxFps = fps;
        if (size > existing.approxSize) existing.approxSize = size;
      }
    }
  }

  // Common resolutions ordered from high to low
  const standardHeights = [4320, 2160, 1440, 1080, 720, 480, 360, 240, 144];
  const detectedHeights = Array.from(resolutionMap.keys()).sort((a, b) => b - a);

  const choices = [];

  // 1. Best Quality option
  choices.push({
    name: `${chalk.bold.yellow('⭐ Best Available Quality')} ${chalk.dim('(Auto highest video + audio, merged into MP4)')}`,
    value: {
      type: 'video',
      formatStr: 'bv*+ba/b',
      mergeExt: 'mp4',
      label: 'Best Available'
    }
  });

  // 2. Specific resolutions found
  const friendlyNames = {
    4320: '8K Ultra HD',
    2160: '4K Ultra HD (2160p)',
    1440: '2K Quad HD (1440p)',
    1080: '1080p Full HD',
    720: '720p HD',
    480: '480p SD',
    360: '360p Low',
    240: '240p Small',
    144: '144p Minimum'
  };

  for (const height of detectedHeights) {
    const resInfo = resolutionMap.get(height);
    const friendlyName = friendlyNames[height] || `${height}p`;
    const fpsBadge = resInfo.maxFps >= 50 ? chalk.cyan(` ${resInfo.maxFps}fps`) : '';
    const sizeBadge = resInfo.approxSize ? chalk.dim(formatBytes(resInfo.approxSize)) : '';

    choices.push({
      name: `🎬 ${chalk.bold(friendlyName)}${fpsBadge} ${chalk.dim('[MP4]')}${sizeBadge}`,
      value: {
        type: 'video',
        formatStr: `bv*[height<=${height}]+ba/b[height<=${height}]`,
        mergeExt: 'mp4',
        label: `${height}p`
      }
    });
  }

  // 3. Audio options
  choices.push({
    name: `${chalk.bold.green('🎵 Audio Only - MP3')} ${chalk.dim('(High Quality 320kbps)')}`,
    value: {
      type: 'audio-mp3',
      label: 'Audio MP3'
    }
  });

  choices.push({
    name: `${chalk.bold.green('🎵 Audio Only - M4A')} ${chalk.dim('(Original YouTube AAC Stream)')}`,
    value: {
      type: 'audio-m4a',
      formatStr: 'ba[ext=m4a]/ba',
      label: 'Audio M4A'
    }
  });

  choices.push({
    name: `${chalk.bold.green('🎵 Audio Only - WAV')} ${chalk.dim('(Lossless Uncompressed Audio)')}`,
    value: {
      type: 'audio-wav',
      label: 'Audio WAV'
    }
  });

  // 4. Custom format option
  choices.push({
    name: `${chalk.bold.magenta('⚙️  Custom Format Code')} ${chalk.dim('(Manually specify format ID e.g. 137+140)')}`,
    value: {
      type: 'custom',
      label: 'Custom'
    }
  });

  return choices;
}

// Download runner
async function runDownload(url, selectedOption, outputDir, fileNamePattern) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, fileNamePattern);

  const args = [
    '--no-playlist',
    '--progress',
    '--console-title',
    '-o', outputPath
  ];

  if (selectedOption.type === 'video') {
    args.push('-f', selectedOption.formatStr);
    args.push('--merge-output-format', selectedOption.mergeExt);
  } else if (selectedOption.type === 'audio-mp3') {
    args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0');
  } else if (selectedOption.type === 'audio-m4a') {
    args.push('-f', selectedOption.formatStr);
  } else if (selectedOption.type === 'audio-wav') {
    args.push('-x', '--audio-format', 'wav');
  } else if (selectedOption.type === 'custom') {
    args.push('-f', selectedOption.formatStr);
    args.push('--merge-output-format', 'mp4');
  }

  args.push(url);

  console.log();
  console.log(chalk.dim('─'.repeat(60)));
  console.log(chalk.bold.cyan('Starting download with yt-dlp...'));
  console.log(chalk.dim(`Command: yt-dlp ${args.map(a => a.includes(' ') ? `"${a}"` : a).join(' ')}`));
  console.log(chalk.dim('─'.repeat(60)));
  console.log();

  return new Promise((resolve) => {
    // spawn with stdio 'inherit' so yt-dlp's native terminal progress bar,
    // percentage, ETA, and speed display live with smooth updates!
    const proc = spawn('yt-dlp', args, { stdio: 'inherit' });

    proc.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

// Main workflow loop
async function main() {
  checkDependencies();

  let initialUrl = process.argv[2] || '';

  while (true) {
    showBanner();

    let url = initialUrl;
    initialUrl = ''; // Clear for next iterations

    if (!url) {
      try {
        url = await input({
          message: chalk.bold.white('Paste YouTube Video / Shorts / Music URL:'),
          validate: (val) => {
            const trimmed = val.trim();
            if (!trimmed) return 'URL cannot be empty.';
            if (!trimmed.includes('youtube.com') && !trimmed.includes('youtu.be')) {
              return 'Please enter a valid YouTube link (e.g., https://youtu.be/... or https://www.youtube.com/watch?v=...)';
            }
            return true;
          }
        });
      } catch (err) {
        console.log(chalk.yellow('\nExiting...'));
        process.exit(0);
      }
    }

    url = url.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    // 1. Fetch info
    let data;
    try {
      data = await fetchVideoData(url);
    } catch (err) {
      console.log(chalk.red(`\n✖ ${err.message}`));
      console.log(chalk.dim('Tip: If YouTube recently updated, try: brew upgrade yt-dlp\n'));
      
      const retry = await confirm({
        message: 'Would you like to try another URL?',
        default: true
      }).catch(() => false);

      if (retry) continue;
      else break;
    }

    // 2. Display Video Details Box
    console.log();
    console.log(chalk.bold.cyan('╭─ Video Details ───────────────────────────────────────'));
    console.log(chalk.bold.cyan('│ ') + chalk.bold.white('Title:    ') + chalk.green(data.title || 'Unknown'));
    console.log(chalk.bold.cyan('│ ') + chalk.bold.white('Channel:  ') + chalk.yellow(data.channel || data.uploader || 'Unknown'));
    console.log(chalk.bold.cyan('│ ') + chalk.bold.white('Duration: ') + chalk.magenta(data.duration_string || formatDuration(data.duration)));
    if (data.view_count) {
      console.log(chalk.bold.cyan('│ ') + chalk.bold.white('Views:    ') + chalk.dim(formatNumber(data.view_count)));
    }
    console.log(chalk.bold.cyan('╰───────────────────────────────────────────────────────'));
    console.log();

    // 3. Prompt for Format / Quality
    const qualityChoices = buildQualityOptions(data);
    let selectedQuality;
    try {
      selectedQuality = await select({
        message: chalk.bold.white('Select resolution / format to download:'),
        choices: qualityChoices,
        pageSize: 12
      });
    } catch {
      break;
    }

    // If custom format was selected, prompt for format code
    if (selectedQuality.type === 'custom') {
      try {
        const customCode = await input({
          message: 'Enter yt-dlp format string (e.g. 137+140 or bestvideo+bestaudio):',
          default: 'bestvideo+bestaudio/best',
          validate: (v) => v.trim().length > 0 || 'Format string cannot be empty'
        });
        selectedQuality.formatStr = customCode.trim();
      } catch {
        break;
      }
    }

    // 4. Output Folder Selection
    const homeDir = os.homedir();
    const downloadsFolder = path.join(homeDir, 'Downloads');
    const cwd = process.cwd();
    const remotionPublic = path.join(cwd, 'public');

    const folderChoices = [
      {
        name: `📂 Current Directory ${chalk.dim(`(${cwd})`)}`,
        value: cwd
      },
      {
        name: `📥 Downloads Folder ${chalk.dim(`(${downloadsFolder})`)}`,
        value: downloadsFolder
      }
    ];

    if (fs.existsSync(remotionPublic)) {
      folderChoices.push({
        name: `🎬 Remotion Public Folder ${chalk.dim(`(${remotionPublic})`)}`,
        value: remotionPublic
      });
    }

    folderChoices.push({
      name: `✏️  Custom folder path...`,
      value: '__custom__'
    });

    let selectedFolder;
    try {
      selectedFolder = await select({
        message: chalk.bold.white('Where should the file be saved?'),
        choices: folderChoices
      });
    } catch {
      break;
    }

    if (selectedFolder === '__custom__') {
      try {
        selectedFolder = await input({
          message: 'Enter directory path:',
          default: cwd,
          validate: (dir) => {
            const resolved = path.resolve(dir.replace(/^~/, homeDir));
            if (!fs.existsSync(resolved)) {
              try {
                fs.mkdirSync(resolved, { recursive: true });
                return true;
              } catch (e) {
                return `Directory cannot be created: ${e.message}`;
              }
            }
            return true;
          }
        });
        selectedFolder = path.resolve(selectedFolder.replace(/^~/, homeDir));
      } catch {
        break;
      }
    }

    // 5. Filename Option (supports custom e.g. bg.mp4 for Remotion)
    let fileNamePattern = '%(title)s [%(resolution)s].%(ext)s';
    if (selectedQuality.type.startsWith('audio')) {
      fileNamePattern = '%(title)s.%(ext)s';
    }

    let namingChoice;
    try {
      namingChoice = await select({
        message: chalk.bold.white('File naming:'),
        choices: [
          {
            name: `🏷️  Automatic (Video title)`,
            value: 'auto'
          },
          {
            name: `✏️  Custom filename (e.g. bg.mp4 for Remotion / lyrics video)`,
            value: 'custom'
          }
        ]
      });
    } catch {
      break;
    }

    if (namingChoice === 'custom') {
      try {
        const customName = await input({
          message: 'Enter filename (e.g., bg.mp4):',
          default: 'bg.mp4',
          validate: (val) => val.trim().length > 0 || 'Filename cannot be empty'
        });
        fileNamePattern = customName.trim();
      } catch {
        break;
      }
    }

    // 6. Execute Download
    const success = await runDownload(url, selectedQuality, selectedFolder, fileNamePattern);

    console.log();
    if (success) {
      console.log(chalk.bold.green('✔ Download completed successfully!'));
      console.log(chalk.white(`📁 Saved to: ${chalk.bold.cyan(selectedFolder)}`));
    } else {
      console.log(chalk.bold.red('✖ Download failed or was interrupted.'));
      console.log(chalk.dim('Tip: If you saw an error above, check your internet connection or update yt-dlp via: brew upgrade yt-dlp'));
    }

    // 7. Post-action prompt
    console.log();
    const actionChoices = [
      { name: '🔄 Download another video', value: 'again' },
      { name: '📂 Open output folder in Finder', value: 'open' },
      { name: '🚪 Exit', value: 'exit' }
    ];

    let nextAction;
    try {
      nextAction = await select({
        message: 'What would you like to do next?',
        choices: actionChoices
      });
    } catch {
      break;
    }

    if (nextAction === 'open') {
      try {
        execSync(`open "${selectedFolder}"`);
        console.log(chalk.green(`Opened ${selectedFolder} in Finder.`));
      } catch (e) {
        console.log(chalk.yellow(`Could not open folder: ${e.message}`));
      }

      const continueAfterOpen = await confirm({
        message: 'Download another video?',
        default: true
      }).catch(() => false);

      if (!continueAfterOpen) break;
    } else if (nextAction === 'exit') {
      break;
    }
  }

  console.log(chalk.bold.hex('#FF0000')('\nThanks for using YouTube Downloader! Happy editing & downloading! 🎉\n'));
}

main().catch((err) => {
  console.error(chalk.red(`Fatal error: ${err.message}`));
  process.exit(1);
});
