# Verify HBOMB Windows application signatures (Windows 11)

This guide checks **Authenticode signing**, which is different from SHA-256 download integrity. Published checksums verify bytes against the published release; they do not identify a publisher. **No signing status is asserted here until tested on the actual published files.**

## Files to check

Download from the existing links on [hbombrg.com](https://hbombrg.com) or the [GitHub releases](https://github.com/Hbomb330/hbombrg-com/releases):

- Blue Wave 2.1.0: `HBOMB.Blue.Wave.2.1.0.exe`
- Time Core 2.3.0: `HBOMB.Time.Core.Setup.2.3.0.exe`
- Weather 1.1.6: `HBOMB-Weather-1.1.6-Portable.zip`; extract all files and check `HBOMB Weather.exe`
- Notepad 1.3.0: `HBOMB.Notepad.Setup.1.3.0.exe`; optionally also check the separate portable executable

First compare downloaded file SHA-256 values with the exact corresponding published checksum files, including the ZIP itself for Weather. If a checksum differs, stop and investigate. Do not execute an unverified file.

## Read-only PowerShell check

Save the downloaded files to `C:\HBOMB-Signature-Test`, extract Weather's ZIP into a subfolder there, and run in a regular (non-administrator) Windows PowerShell terminal:

```powershell
Get-ChildItem -LiteralPath 'C:\HBOMB-Signature-Test' -Filter *.exe -File -Recurse |
  ForEach-Object {
    $signature = Get-AuthenticodeSignature -LiteralPath $_.FullName
    [PSCustomObject]@{
      File = $_.Name
      Status = $signature.Status
      Message = $signature.StatusMessage
      Publisher = $signature.SignerCertificate.Subject
      CertificateExpiry = $signature.SignerCertificate.NotAfter
      TimestampSigner = $signature.TimeStamperCertificate.Subject
      Path = $_.FullName
    }
  } | Format-List
```

The command only reads files; it does not install or launch them.

- `Valid`: signature validates on this Windows installation. Inspect the certificate publisher and timestamp; a valid signature does not establish software safety.
- `NotSigned`: Windows did not recognize an Authenticode signature on the file.
- `HashMismatch`: signature integrity problem; do not run the file.
- `NotTrusted`: trust-chain issue; investigate before running.
- `UnknownError` or another status: preserve the full status message for diagnosis.

An installer can be signed while the installed application's executable is not, or vice versa. To check both, separately inspect installed binaries **without launching them**. Do not infer a result for one from the other.

## SmartScreen and Windows security

SmartScreen download reputation is distinct from Authenticode signature validation. A valid signature does not guarantee a warning-free download, and an unsigned application is not automatically malicious. Smart App Control, antivirus, browser download protection, and organization policy can also affect installation.

Keep SmartScreen, Smart App Control, Defender and other protections enabled. Do not bypass a warning, add antivirus exclusions, or disable security features to test installation. Record the exact warning and app version; stop if Windows blocks the file.

## Reporting

For each executable, record filename, SHA-256 match (yes/no), signature status, publisher (if present), status message, Windows version, and any actual download/installation warning. Avoid publishing personal local paths or sensitive details. No Windows installation trust outcome is claimed until tested on a physical Windows machine.

This documentation does not change any release assets, download URLs or application versions.
