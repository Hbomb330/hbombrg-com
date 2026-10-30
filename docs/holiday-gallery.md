# Blue Wave holiday website previews

Linked from the Blue Wave card. These are website demonstrations, not verified built-in features of the Windows 2.1.0 app. No application binaries, download URLs or hosting configuration change.

## Original media

Owner-supplied October 17 videos, visually checked. Silent H.264/MP4 derivatives at 1280px width, CRF 25, fast-start metadata. JPEG posters come from the videos. Halloween crops the bottom 28 pixels to remove a desktop taskbar. New Year countdown is baked into the artwork.

| Asset | Original filename | Source SHA-256 |
| --- | --- | --- |
| halloween | ghosts_drifting_over_waves_80494_Kling_30_.mp4 | 34cd8903881914d716c143f3acc57431143380ac1c9e870efb4e09066675ce23 |
| christmas | ghosts_drifting_over_waves_26841_Kling_30_.mp4 | 520b5b8594a82df69dc5871d744d8c2661de1af4d01441b368330cb21e8f4166 |
| new-year | ghosts_drifting_over_waves_46104_Kling_30_.mp4 | 122780a0c1479718d0e08885855afbd672650335a784440a9cbb67cb1c107412 |

## Behavior

Halloween is the default. Native links support direct links and browser history. Native video controls, no autoplay, no loops, preload none. Switching themes or hiding the tab pauses playback. All three sections remain visible without JavaScript. No trackers or external embeds.

## Browser verification

Run `npm install --no-save --package-lock=false playwright@1.56.1`, then
`npx playwright install --with-deps chrome`. Serve the repository with
`python3 -m http.server 8765 --bind 127.0.0.1` and run
`node tests/holiday-gallery.cjs` in another terminal.

The test deliberately uses the branded Chrome channel: Playwright's bundled
Chromium headless shell does not support these original H.264 previews. The
diagnostic run returned HTTP 200 for the MP4 but empty H.264 `canPlayType`,
`readyState: 0`, `networkState: 3`, and no decoded video frames. This is a test
browser codec limitation, not evidence that the artwork needs re-encoding.
See https://playwright.dev/docs/browsers#media-codecs.

The suite fails if codec support is missing and still requires real video
time advancement and decoded dimensions for each theme at desktop, tablet,
and mobile viewport widths. Failure output includes media/network diagnostics;
screenshots cover each theme and width. This is automated desktop Chrome
viewport testing, not physical-device or production-deployment verification.
