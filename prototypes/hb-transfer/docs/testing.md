# Verification record and physical-device checklist

## Current verification — October 18, 2026

Local Linux / Node 24.19.0: all five Node test groups passed over actual loopback HTTP. Coverage includes:

- SHA-256 reference and chunk/padding boundaries.
- Arbitrary binary contents with APK, ZIP, EXE, image, video, PDF, Unicode, extensionless and empty filenames; exact server and downloaded bytes.
- Authentication, Host/Origin/cross-site controls, invalid private addresses, forwarded-header rejection and arbitrary path denial.
- Chunk order, maximum sizes, corruption, incomplete transfers, cancellation, upload capacity, duplicate filenames and graceful partial cleanup.
- Short-code pairing, global rate limits, code/session expiry, browser revocation, restart isolation and malformed JSON errors.

GitHub Actions run [39154745720](https://github.com/Hbomb330/hbombrg-com/actions/runs/39154745720) passed on implementation commit `29574e4b4596bbe64f85901733b72b17c99597ec`:

- Core tests on Windows and Ubuntu, Node 22 and 24 (all four jobs passed).
- Playwright Chromium browser test: desktop upload → mobile download/save/readback; mobile upload → desktop download with exact saved-byte comparison; disconnect; no browser errors or horizontal overflow at 390×844, 600×1024, 1024×600 and 360×800.

The local browser attempt failed because Chromium was absent and its download failed; the successful browser test ran on GitHub's Ubuntu runner with Playwright 1.56.1. CI never establishes physical Wi-Fi, Windows Firewall or Fire Silk compatibility. The subsequent documentation-only commit records these results without changing tested application code.

No physical Windows/Fire transfer, real 256 MiB file, or actual APK/EXE installation has been verified. Automated APK/EXE payloads are arbitrary test bytes, not installable software.

## Windows → Android acceptance test

1. Start on Windows following README. Note the printed URL and received-files folder. Connect from Windows and Android using the pairing code.
2. Choose a small, known APK on Windows. Record its size and SHA-256 in PowerShell:

   ```powershell
   (Get-Item 'C:\path\example.apk').Length
   Get-FileHash 'C:\path\example.apk' -Algorithm SHA256
   ```

3. Upload from Windows. Confirm **Verified on Windows**, matching byte count, and matching SHA-256 in the shared list.
4. Refresh Android. Download & verify the APK; confirm progress and successful verification. Tap Save, locate the downloaded file, then select it with **Check saved copy**. Expect **Saved copy verified: exact size and SHA-256 match.** Installation is unnecessary.
5. Repeat with a ZIP, image or short video, an extensionless file, and a zero-byte file. Start small; increase to your real APK size, staying below 256 MiB and within tablet memory.

## Android → Windows acceptance test

1. On Android, select a known file from Downloads; upload and wait for **Verified on Windows**.
2. Find the ID-prefixed file in the printed Windows session folder. Check its size/hash with PowerShell against the shared list.
3. Refresh the Windows browser and download the same file if you want the original safe name. Verify the saved copy in the browser.
4. Send two files with the same name. Confirm both survive as distinct ID-prefixed files.

## Failure/access tests on the devices

- Open a second browser without pairing: file listing/download must remain unavailable.
- Enter a wrong pairing code: expect an authentication message; no file list.
- Cancel during a transfer: no corrupt completed item should appear. Idle partials are removed after two minutes; already-completed uploads remain.
- Turn off Wi-Fi during a transfer, restore it, and retry from the start. Never treat partial bytes as verified.
- Stop the server: remote access stops. Restart: old code/token fails; shared list is empty; previously completed files still exist on disk.
- Test a 256 MiB boundary file only if the tablet has enough memory; a larger file must be rejected. No unlimited-size claim.
- Inspect the interface in portrait and landscape; confirm buttons, long filenames, progress and saved-copy selection remain usable.

Use the optional Playwright command in README for a repeatable desktop/mobile-emulation UI check. Physical Android testing is still necessary.
