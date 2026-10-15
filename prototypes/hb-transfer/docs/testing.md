# Test status and device acceptance checklist

## Executed in the development environment

October 15, 2026, Linux / Node 24.19.0: `npm run check` passed seven automated test groups. They verify:

- Incremental SHA-256 against Node across padding/chunk boundaries.
- Private address binding, path/Windows reserved-name handling.
- Pairing key rejection/throttling, Host/Origin/cross-site rejection, device disconnect.
- Receiver approval before any disk bytes, sender cannot self-accept, third device isolation, decline and cancellation.
- Both logical directions with APK, ZIP, EXE, image, video, PDF, unknown/no extension, empty and Unicode filenames; Windows-hosted bytes and native attachment responses match.
- One-use download tickets, wrong offsets, oversize chunks, corrupt hashes, expired incomplete upload cleanup.
- A 64 MiB upload/download using incremental hashes and bounded chunks. No claim of measured Fire memory use or 10 GiB reliability.

Browser rendering and native browser-save interaction were **not executed locally**: the environment had no Chromium binary and its browser download failed. `scripts/browser-smoke.mjs` supplies a reproducible optional two-browser workflow check. Do not treat HTTP tests as proof of Silk compatibility. GitHub workflow results are independently available on the branch; configured jobs alone are not a successful run.

## Windows 11 + Fire 7 (2022): all pending until you test

1. Extract files, launch on Windows, select Wi-Fi address and open URL in Edge and Silk. Record Node, Windows, Fire OS and Silk versions.
2. Pair `Windows PC` and `Fire tablet`. Check IDs. Wrong key should be refused. Both device selectors should populate within two seconds.
3. Send a small photo Windows → Fire. Confirm no transfer starts until Fire accepts. Decline one offer and check it never uploads.
4. Accept a new offer. Wait for verified copy on Windows. Tap Save in Silk, confirm Downloads completes, select that file with Check saved copy and require a SHA-256 match.
5. Send a PDF or ZIP Fire → Windows. Accept in Edge; inspect the printed Windows data folder. Optionally Save in Edge and verify the saved copy.
6. Repeat with an empty file, unknown extension, Unicode name and two files with the same original name. Disk paths should not overwrite each other.
7. Test 100 MiB then 1 GiB in each direction, only with sufficient free storage. Record time, stability and disk hash result. Test larger sizes incrementally; 10 GiB is an implementation ceiling, not certification. Do not use sensitive files for initial tests.
8. Cancel while waiting and mid-upload. Check cancellation/expiry removes `.part` data. If cancellation races with a busy write, it may take about 2–2.5 minutes to expire. Completed files are retained.
9. Interrupt Wi-Fi during upload/download, then reconnect. Uploads require a new request; downloads can retry Save. Check the saved copy. Test locking/backgrounding separately; uninterrupted background transfers are not promised.
10. Pair a third browser; it must not see or download someone else's offer. Stop Windows host and confirm every device loses access. Restart and confirm new key and empty list.
11. At tablet portrait/landscape sizes, verify controls are visible, file names wrap, keyboard focus is visible, and no horizontal scrolling occurs. Large text and 200% zoom need manual checks.
12. Disconnect both browsers, stop the host, and remove old session folders only after preserving wanted files.

## Optional Chromium workflow test

From this folder, in a development environment with Internet access:

```sh
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
node scripts/browser-smoke.mjs
```

This is test tooling only; it is not required to use HB Transfer. The script uses separate desktop/mobile browser contexts, exercises pairing/approval/upload/native download/hash checks and checks page widths. It does not emulate Fire OS, Silk's download manager, Windows Firewall or real Wi-Fi.
