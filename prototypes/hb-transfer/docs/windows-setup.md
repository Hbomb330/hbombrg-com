# Windows setup and troubleshooting

Use Windows 11, Node.js 22+, and Amazon Silk on Fire 7 (2022), with JavaScript, cookies, file picker and native downloads enabled. Windows Edge and Silk are intended targets; physical compatibility remains unverified. No Android APK is needed.

1. Connect both devices to your home router's Wi-Fi. On Windows, open Settings → Network & internet → Wi-Fi → your connected network and confirm it is a **Private** network, only if you trust that network.
2. Run `ipconfig`. Match the launcher address with **Wireless LAN adapter Wi-Fi → IPv4 Address**. Do not select VPN, Hyper-V, Ethernet-without-Wi-Fi-routing, or virtual adapter addresses by mistake.
3. Start HB Transfer and open its exact printed address on Windows first, then Android. A loopback address (`127.0.0.1`) only works on the Windows host.

## Narrow firewall rule, only if blocked

Keep the firewall enabled. Avoid accepting a broad Public profile prompt for Node. To allow only this program, address, port and local subnet, open PowerShell **as Administrator**, replace the sample address below with the address HB Transfer printed, and run:

```powershell
$hbAddress = '192.168.1.20'
$hbNode = (Get-Command node.exe -ErrorAction Stop).Source
New-NetFirewallRule -DisplayName 'HB Transfer local Wi-Fi' -Direction Inbound -Action Allow -Protocol TCP -LocalAddress $hbAddress -LocalPort 8787 -RemoteAddress LocalSubnet -Profile Private -Program $hbNode
```

This is an explicit configuration step for you; the launcher does not change firewall rules. If a broad Node allow rule already exists, review it in Windows Defender Firewall with Advanced Security and scope it appropriately. The narrow rule does not override another broad allow rule.

Remove the HB Transfer rule when no longer needed:

```powershell
Remove-NetFirewallRule -DisplayName 'HB Transfer local Wi-Fi'
```

If Windows gets a different IP address, remove/recreate the rule for that address and reopen the new URL on both devices.

## Troubleshooting

- **Cannot reach the site:** check the exact URL/IP, server window, Private firewall rule, and same LAN. Guest networks/client isolation and VPNs can block device-to-device traffic. Do not fix this with router port forwarding.
- **Address already in use:** close the previous HB Transfer window/server; port 8787 must be free.
- **Pair again:** use the pairing key from the current running window. It changes after restart. Use a single tab per browser profile; reloading requires pairing again and creating new offers.
- **Transfer stalls/backgrounds:** keep both devices awake, foreground the browser and retry. There is no resume.
- **Cannot select APK:** change the Android picker from recent photos to Files/Downloads. HB Transfer does not filter file types. Picker/provider restrictions are controlled by Android.
- **Browser warns about an EXE/APK:** do not assume transferring a file makes it safe. Use files you trust. Android installation is a separate action and not part of this app.
- **Save does nothing in Silk:** inspect Silk Downloads and download permissions, allow this local site to download, then click Save again. Keep cookies enabled. If still blocked, record the Silk version and error for the device test; do not assume a disk save succeeded.
- **Large file fails:** check free storage on both devices and filesystem limits. The 10 GiB ceiling has not been validated on Fire 7. Start with small files, then 100 MiB and 1 GiB.
- **Device missing:** pair both browsers and wait two seconds. Confirm each page shows a different device ID.
- **Page reloaded during transfer:** pair again, cancel the old offer from the other device, then send a new request. There is no resume.
- **Upload fails/disk full:** check the printed received-files location, free space and folder permissions. Incomplete files are not shared.
- **Restart shows no files:** intentional session isolation. Completed files are still in old `data` folders. Select them again to share.

Stop sharing with Ctrl+C in the Windows window. No service remains running after the process exits.
