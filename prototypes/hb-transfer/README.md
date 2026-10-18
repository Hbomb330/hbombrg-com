# HB Transfer 0.2.0

A working, dependency-free Node.js server and browser client for transferring any file type between Windows and Android on **trusted local Wi-Fi**. No cloud service, account, subscription, Android app, or build step is required. This package is source, not an EXE installer.

## Start on Windows

1. Install Node.js LTS from https://nodejs.org (Node 22 or later; automated tests run here on Node 24.19.0).
2. Extract the entire ZIP to a writable folder, such as `Documents\HB-Transfer`. Do not run inside the ZIP.
3. Double-click **Start-HB-Transfer.cmd**. Select your Windows Wi-Fi IPv4 address from the numbered list. Use `ipconfig` in Command Prompt if there are several adapters. Option 0 is a computer-only test mode.
4. Leave that window open. It prints the URL, a fresh eight-digit pairing code (valid for ten minutes), and the received-files folder.
5. Open the exact printed `http://192.168.…:8787` URL in a browser on Windows and Android. Both must be on the same trusted Wi-Fi. Enter the pairing code on each. Type `http://`, not `https://`.
6. If Windows Firewall blocks the connection, use the narrowly scoped rule in [Windows setup](docs/windows-setup.md). Never disable the firewall or enable Public network access.

Advanced launch: `node server.mjs --host 192.168.1.20` (replace with the actual local address). `npm start` opens the same address chooser. No `npm install` is needed for ordinary use or core tests.

## Send Windows → Android

On Windows, choose a file and click **Upload & verify**. This stages a verified copy on Windows. On Android, click **Refresh**, then **Download & verify**. Once verification succeeds, click **Save verified file**. The browser chooses/prompts for its download destination. Use **Check saved copy** to select the downloaded file and verify the final disk copy.

## Send Android → Windows

On Android, select any file and click **Upload & verify**. Once verified, it is already saved in the Windows folder printed at startup. Each disk filename has a unique ID prefix to prevent overwrites. Alternatively, refresh the Windows browser and download it with its original safe filename. The server never opens or executes transferred files.

## What is included

- One-file-at-a-time browser UI, upload/download progress, cancellation, refresh, and disconnect.
- Arbitrary binary content: APK, ZIP, EXE, image, video, document, unknown extension, no extension, and empty files. No conversion, compression, extraction, or MIME parsing.
- Browser incremental SHA-256 and server SHA-256 readback of staged files; exact byte-count validation.
- Download size/SHA-256 checked before Save. Optional saved-copy readback verifies the browser's final output; “Save requested” alone does **not** certify a disk save.
- Eight-digit pairing code, ten-minute pairing window and five attempts per minute across the host. Each browser receives a random 256-bit session token, valid for eight hours, held only in memory. No tokens in URLs or local storage. Up to eight paired browsers; restarting revokes all access.
- Private IPv4 interface binding, private/loopback source filtering, exact Host checks, Origin/cross-site rejection, no CORS, and a restrictive Content Security Policy.
- Isolated upload folders and random IDs. No arbitrary path reads, directory listings, original-folder sharing, or automatic execution.

## Limits and security boundaries

**HTTP is not encrypted.** The key restricts access but cannot stop someone who can intercept traffic on the LAN. SHA-256 detects changed bytes; it is not peer authentication on untrusted Wi-Fi. Use only your trusted home network. Do not use public/guest Wi-Fi for sensitive files. Encrypted transport and QR pairing are not implemented here.

The app refuses wildcard/public-address binds, does not use UPnP, and creates no router, firewall, cloud, or tunnel configuration. Do not add port forwarding, a reverse proxy, or a tunnel. A private bind cannot prevent exposure deliberately configured outside the application. Keep Windows Firewall scoped to Private/LocalSubnet as documented.

Maximum file size: **256 MiB**. Uploads use 1 MiB chunks. Downloads are collected into a browser Blob for an Android-compatible Save link and can consume significantly more than file size in RAM; use smaller files on low-memory devices. “Any file type” does not mean unlimited file size. Folders must be zipped first. File contents are preserved; filenames are sanitized and filesystem metadata/permissions/alternate streams are not transferred.

A session allows 1 GiB total staged bytes, 100 files including pending uploads, and up to four simultaneous uploads across clients. An authenticated device can see/download every shared file in that session. Paired access lasts up to eight hours or until the server stops. Disconnect revokes that browser token when the host is reachable; Ctrl+C revokes every device. Reloading loses the token and requires pairing again. After ten minutes, restart the host to open a new pairing window.

Inactive partial uploads expire after two minutes. Cancelling an in-flight upload may leave a partial until that cleanup runs. Graceful shutdown removes incomplete uploads. A crash can leave `.part` files; remove old session folders manually while stopped. Completed files remain in `data/<session-id>/`; restarting starts an empty shared list and does not reshare old files. You can reselect them. Delete unneeded session folders manually to recover disk space. `data/` is ignored by Git.

IPv4 only. Keep screens awake and browsers in the foreground. No resume, pairing QR, automatic discovery, native installer, background service, or automatic APK installation. Transferring an EXE does not make it run on Android.

## Tests and repository use

Run `npm test`. Core tests use Node built-ins and actual loopback HTTP requests. See [test results and device checklist](docs/testing.md).

This folder is self-contained. The integration PR places it under `prototypes/hb-transfer/` in Hbomb330/hbombrg-com, with a separate Windows/Linux test workflow. The host runs only when started on your computer; it is not a hosted transfer service. See docs/testing.md for the current verification record.

Optional full browser smoke test (requires a development internet connection):

```powershell
npm install --no-save --package-lock=false playwright@1.56.1
npx playwright install chromium
node scripts/browser-smoke.mjs
```

This optional dependency is only for testing, never loaded by the app. The smoke script simulates desktop and mobile Chromium contexts; it does not replace testing a physical Android device.

## Layout

- `server.mjs` — private-LAN HTTP server, authenticated chunk protocol, storage and verification.
- `public/` — self-contained HTML/CSS/JS, with incremental SHA-256.
- `Start-HB-Transfer.cmd` — Windows launcher.
- `test/` — automated integrity, transport and access-control tests.
- `scripts/browser-smoke.mjs` — optional browser workflow test.
- `docs/` — firewall setup, protocol, tests and known limits.

## Reused source

Recovered from `HB-Transfer-MVP-0.1.0.zip` (October 10). Version 0.2 retains its chunk protocol, incremental SHA-256, isolated storage and browser interface. It adds expiring short-code pairing, revocable browser sessions, stricter IPv4 validation, forwarded-header rejection, clearer malformed-request errors and more automated coverage. The browser cancellation check avoids requiring the newer AbortSignal.throwIfAborted method.

## Fire 7 quick start

Use Silk on the Fire 7. Enter the full printed `http://` address in its address bar, then the pairing code. Start with a small photo or text file in each direction before trying video. Keep Silk in the foreground and the tablet awake. Downloads require two steps: **Download & verify**, then **Save verified file**. Check the Downloads folder and optionally reselect the saved file for verification. Silk file picker and download behavior still require your physical-device test.
