// Shrinks the walkthrough video after a recording, so the repository does not take another ~100 MB
// every time it is re-recorded (GitHub refuses a single file over 100 MiB).
//
// It re-encodes the .webm with VP8 at a constant quality, using the ffmpeg build that Playwright
// installs for its own video recording (`pnpm exec playwright install`), so nothing else has to be
// installed. Typical result: 104 MB down to about 40 MB, same length, text still sharp (only the
// instant right after a page change is briefly soft). It runs at roughly real time, so a 25-minute
// video takes about 30 minutes.
//
// Usage:   node scripts/compress-journey-video.mjs [input] [output] [crf]
//          input   defaults to public/videos/proplity-complete-userflow.webm
//          output  defaults to the input (it is replaced only after the new file is written)
//          crf     0 (best) to 63; 34 by default, lower is sharper and larger
// Env:     FFMPEG=/path/to/ffmpeg  to use another ffmpeg that has libvpx
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const input = resolve(
  process.argv[2] ?? join(__dirname, '../public/videos/proplity-complete-userflow.webm'),
);
const output = resolve(process.argv[3] ?? input);
const crf = process.argv[4] ?? '34';

// Every ffmpeg Playwright has installed, newest first. Not every build has the VP8 encoder, so the
// caller keeps the first one that does.
function ffmpegCandidates() {
  if (process.env.FFMPEG) return [process.env.FFMPEG];
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    join(homedir(), '.cache', 'ms-playwright'),
    join(homedir(), 'Library', 'Caches', 'ms-playwright'),
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'ms-playwright') : undefined,
  ].filter(Boolean);
  const found = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const dirs = readdirSync(root)
      .filter((d) => d.startsWith('ffmpeg-'))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const dir of dirs) {
      for (const bin of ['ffmpeg-linux', 'ffmpeg-mac', 'ffmpeg-win64.exe']) {
        const candidate = join(root, dir, bin);
        if (existsSync(candidate)) found.push(candidate);
      }
    }
  }
  return found;
}

// Which codec a Playwright ffmpeg can both read and write: its builds carry one of VP8 or VP9, not
// both, and the video has to be re-encoded with the codec it was recorded in.
function codecOf(ffmpegPath) {
  const list = (flag) =>
    spawnSync(ffmpegPath, ['-hide_banner', flag], { encoding: 'utf8' }).stdout ?? '';
  const encoders = list('-encoders');
  const decoders = list('-decoders');
  if (/^\s*V\S*\s+libvpx\s/m.test(encoders) && /^\s*V\S*\s+libvpx\s/m.test(decoders)) {
    return 'vp8';
  }
  if (/^\s*V\S*\s+libvpx-vp9\s/m.test(encoders) && /^\s*V\S*\s+libvpx-vp9\s/m.test(decoders)) {
    return 'vp9';
  }
  return null;
}

function codecOfVideo(ffmpegPath, file) {
  const out = spawnSync(ffmpegPath, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  return /Video:\s*(vp8|vp9)\b/.exec(out.stderr ?? '')?.[1] ?? null;
}

if (!existsSync(input)) {
  console.error(`Input not found: ${input}`);
  process.exit(1);
}
const candidates = ffmpegCandidates();
const videoCodec = candidates.length ? codecOfVideo(candidates[0], input) : null;
const pickedPath = candidates.find((path) => codecOf(path) === videoCodec);
if (!videoCodec || !pickedPath) {
  console.error(
    `No ffmpeg that can re-encode this ${videoCodec ?? 'unknown'} video was found. Run \`pnpm exec playwright install\`, or set FFMPEG=/path/to/ffmpeg (with libvpx${videoCodec === 'vp9' ? '-vp9' : ''}).`,
  );
  process.exit(1);
}
const picked = { path: pickedPath, codec: videoCodec === 'vp9' ? 'libvpx-vp9' : 'libvpx' };

const temp = `${output}.compressing.webm`;
const before = statSync(input).size;
console.log(
  `Encoding ${input} with ${picked.codec}, CRF ${crf} (this takes about as long as the video lasts)...`,
);
const codecArgs =
  picked.codec === 'libvpx-vp9'
    ? [
        '-c:v',
        'libvpx-vp9',
        '-b:v',
        '0',
        '-crf',
        crf,
        '-deadline',
        'good',
        '-cpu-used',
        '4',
        '-row-mt',
        '1',
      ]
    : [
        '-c:v',
        'libvpx',
        '-b:v',
        '0',
        '-crf',
        crf,
        '-deadline',
        'good',
        '-cpu-used',
        '3',
        '-threads',
        '4',
      ];
const result = spawnSync(
  picked.path,
  ['-hide_banner', '-loglevel', 'error', '-stats', '-y', '-i', input, ...codecArgs, '-an', temp],
  { stdio: 'inherit' },
);
if (result.status !== 0) {
  rmSync(temp, { force: true });
  console.error('ffmpeg failed; the original was left as it was.');
  process.exit(result.status ?? 1);
}

renameSync(temp, output);
const after = statSync(output).size;
const mib = (n) => (n / (1024 * 1024)).toFixed(1);
console.log(`Done: ${mib(before)} MiB -> ${mib(after)} MiB (${output})`);
if (after > 90 * 1024 * 1024) {
  console.warn(
    'Still above 90 MiB: GitHub refuses a file over 100 MiB. Try a higher CRF (for example 38).',
  );
}
