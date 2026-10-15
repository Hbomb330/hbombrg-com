# Local HTTP protocol — 0.2

All endpoints use the exact bound IPv4 Host/port. Cross-origin and cross-site requests are rejected. No CORS. All API endpoints except pairing require a device bearer credential; native downloads instead require the same device's HttpOnly cookie. Pairing key is only used to acquire a device credential.

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/pair` | POST | JSON `{key,name}`; returns `{token,device}`, sets device cookie |
| `/api/state` | GET | Own identity, paired device summaries, offers involving this device, limits |
| `/api/disconnect` | POST | Revoke current credential and clear cookie |
| `/api/transfers` | POST | JSON `{name,size,receiver}`; create pending offer |
| `/api/transfers/:id/accept` | POST | Receiver only; allow upload |
| `/api/transfers/:id/decline` | POST | Receiver only; refuse offer |
| `/api/transfers/:id/chunk?offset=N` | PUT | Sender only, accepted/uploading state, raw bytes ≤1 MiB, exact next offset |
| `/api/transfers/:id/finish` | POST | Sender JSON `{sha256}`; verify size and disk SHA-256, atomically rename |
| `/api/transfers/:id` | DELETE | Either participant; cancel incomplete transfer |
| `/api/transfers/:id/ticket` | POST | Receiver only; get single-use 60-second native-download ticket |
| `/api/transfers/:id/download` | POST | Receiver cookie and form-urlencoded `ticket`; attachment stream |

Transitions: pending → accepted → uploading → ready. Empty files go accepted → ready. Pending offers can be declined. Pending/accepted/uploading can be cancelled or expire; failed integrity removes partial bytes. No writes before acceptance. The host stores data regardless of receiver platform; the Windows operator controls that disk and can read staged files. This is not isolation from the host itself.

Ready files are immutable for the session. Native download attempts show bytes read toward the socket and streaming/sent-to-browser/interrupted status. These counters do not verify a browser disk save. SHA-256 saved-copy checking is a separate client action. No range/resume protocol. Receivers may retry native downloads by requesting a fresh ticket.

Metadata is in memory; restarting rotates all credentials and starts an empty transfer list. Completed files remain on disk. Request bodies are limited to 4 KiB metadata, 1 KiB download forms, or 1 MiB chunks. File count, disk-byte reservations and concurrent writes are bounded. Node stream pipeline handles download backpressure.
