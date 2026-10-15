# HB Transfer 0.2.0 — local Wi-Fi prototype

Windows-hosted file transfer for Windows and a Fire tablet browser. Reuses the October 10 HB Transfer 0.1.0 MVP's incremental SHA-256, local-network guard design, launcher and visual style. Replaces its shared file list and whole-file browser download buffer with paired devices, receiver approval and native streamed downloads.

**Runnable source, not an EXE or APK. Physical Windows 11 / Fire 7 (2022) testing remains pending.** No cloud storage, account, CDN, telemetry, runtime dependency download or Internet connection is used by the application.

## Start here

1. Install Node.js 22 or newer from https://nodejs.org if needed. Extract the entire ZIP into a writable folder on Windows, such as Documents\HB-Transfer. No `npm install` is needed.
2. Double-click `Start-HB-Transfer.cmd`. Select the Wi-Fi IPv4 address matching `ipconfig`. Leave this window open. The launcher prints a local URL, pairing key and storage folder. Option 0 is PC-only testing.
3. Open the **exact printed http:// address** on Windows and in Amazon Silk on the Fire tablet. Use the same trusted home Wi-Fi. Do not enter the address in a search box. If blocked, see [Windows setup](docs/windows-setup.md).
4. Name the first browser `Windows PC` and the second `Fire tablet`. Enter the same pairing key on each. Check the eight-character device ID on the other screen before selecting it.
5. On the sending device, select the receiver and a file, then click **Request transfer**. On the receiving device, click **Accept file**. No file bytes upload before approval.
6. Keep both pages open. The sender uploads in 1 MiB chunks; Windows verifies the stored file's size and SHA-256.
7. The receiver clicks **Save to this device**. Its browser download manager streams the file to storage. Open the browser's Downloads to confirm it finished. **Check saved copy** optionally verifies the saved file's size and SHA-256 in bounded chunks.
8. Stop the host with Ctrl+C when finished.

For **tablet → Windows**, the verified file already exists in the printed storage folder with a unique ID prefix; Save gives you another copy with its sanitized original name. For **Windows → tablet**, a staging copy also remains on Windows.

## Implemented

- Arbitrary binary file contents and extensions, including empty files. Folders must be zipped first. No execution, extraction, conversion or automatic installation.
- Random 128-bit pairing key per host run, up to eight separately authenticated browser devices; 256-bit device credentials expire after eight hours. Disconnect revokes that browser credential.
- Explicit, per-file receiver accept/decline, sender/receiver isolation, cancellation of incomplete uploads, and progress polling every two seconds.
- Uploads and verification use 1 MiB chunks. Server downloads use Node streams and backpressure; the browser page does not construct a whole-file Blob. See https://nodejs.org/api/stream.html for the underlying streaming API.
- Native downloads require the receiver's HttpOnly/SameSite cookie plus a single-use, 60-second download ticket submitted in a form body. Credentials are not placed in URLs or local storage.
- Size/offset checking, server SHA-256 disk readback, optional receiver saved-copy verification, safe filenames and unique per-transfer disk paths.
- Private IPv4 binding/source filtering, exact Host validation, Origin/cross-site rejection, no CORS, restrictive CSP, pairing attempt throttling, bounded metadata/chunk requests.

## Limits and security boundary

**HTTP is unencrypted. Use trusted home Wi-Fi only.** Anyone able to intercept local HTTP can read files or steal credentials. Pairing is access control, not encryption or verified device identity. Names are self-selected. People given the pairing key can join; do not share it outside your devices. HTTPS/pinned identity is not implemented.

Never forward port 8787, add a tunnel, reverse proxy or public firewall rule. The app does not configure any of these. Keep the firewall enabled and scoped to Private/LocalSubnet. Private binding cannot undo an exposure configured elsewhere.

Limits: **10 GiB per file**, **20 GiB reserved/stored per session**, 100 offers per session, eight devices, four simultaneous upload/verification operations. The 10 GiB value is a configured ceiling, not a measured Fire 7 guarantee. Available disk space and the browser/download filesystem may impose lower limits. Windows needs space for staging copies; Save on Windows may create an additional copy. The app reports disk-write failure but does not pre-reserve disk space.

Offers/accepted transfers expire after 30 minutes of inactivity; interrupted uploads after two minutes, checked every 30 seconds. Completed copies remain in `data/<session-id>/`. Graceful shutdown removes incomplete files; a crash may leave `.part` files. Stop the app before deleting obsolete session folders. No old files are automatically reshared after restart.

No resume, discovery, QR pairing, background-service guarantee, native packaging, IPv6 or end-to-end encryption. Keep screens awake and browsers foregrounded. A failed upload must be requested and accepted again. A failed download can be retried with Save. Browser download progress and server bytes are not proof of a disk save: use the optional saved-copy check.

Each browser profile should use one app tab. Reload loses its in-memory API credential; pair again with a new identity, and re-offer the file. Existing offers belong to the original identity. Disconnect before re-pairing when possible; otherwise restart the host if slots fill. Stopping the host revokes all access and clears the shared session list, not completed disk files.

## Development

Run `npm run check` in this folder. Dependency-free tests use actual local HTTP requests. [Testing instructions](docs/testing.md) distinguish automated checks from outstanding physical tests. [Protocol](docs/protocol.md) describes the endpoints.

Development branch: `dev/hb-transfer-0.2` in `Hbomb330/hbombrg-com`, under `prototypes/hb-transfer/`. A new branch-specific workflow checks Windows and Linux. Existing website files, main branch and HB Chat code are unchanged. This is not a website deployment or a public application release.
