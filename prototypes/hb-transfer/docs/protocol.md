# Browser protocol v0.2

Same-origin HTTP, no CORS. Except `/api/pair`, every `/api` request needs `Authorization: Bearer <session key>`. Do not expose through a proxy. Host must exactly match selected IPv4:port; Origin, if present, must match that HTTP origin. Public/IPv6 peers are rejected. UI assets alone are unauthenticated and disclose no files/key.

0. `POST /api/pair`: JSON `{code:"12345678"}`. Code expires ten minutes after host startup; five attempts per minute globally, at most eight active paired sessions. Returns `{token}` (256 random bits, eight-hour lifetime). `POST /api/disconnect` with the token revokes it. UI holds tokens in memory only. The createApp test API also provides a random internal master token; the CLI never prints it.
1. `GET /api/files`: current session metadata `{files:[{id,name,size,sha256}],max,chunk}`.
2. `POST /api/uploads`: JSON `{name,size}`. Size is an integer 0..268435456. Returns `{id}`; creates a unique temporary file.
3. `PUT /api/uploads/<id>?offset=N`: raw bytes, nonempty and at most 1048576 bytes. Offset must match the currently accepted offset. No concurrent writes to one upload. Returns `{offset}`.
4. `POST /api/uploads/<id>/finish`: JSON `{sha256}` (64 lowercase hex digits). Server checks accepted length and filesystem length, then hashes the file from disk. Any mismatch removes the partial and returns 422. A matching file is renamed and added to session metadata. Browser hashes source chunks incrementally while uploading.
5. `GET /api/files/<id>`: octet-stream attachment. Browser hashes response bytes, validates length/hash against authenticated metadata, then offers a Blob Save link. Users may reselect the saved file for final on-disk verification.
6. `DELETE /api/uploads/<id>`: cancel a pending, non-busy upload. Interrupted/busy uploads expire after two idle minutes. No completed-file deletion endpoint.

Small JSON request limits; all data chunks capped. Session admission limits bound outstanding disk reservations. Completed files count against the session quota. No raw filesystem paths are accepted or returned by the API. Metadata is kept in memory; complete bytes persist locally after shutdown without being re-shared on restart.

Transport is not encrypted and hashes do not protect against an active on-path attacker. Random session keys provide basic LAN access protection, not TLS-equivalent trust.

Implementation references consulted October 10, 2026:
- Node crypto Hash: https://nodejs.org/api/crypto.html
- Web Crypto digest constraints (secure contexts; non-streaming): https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest

Because private-IP HTTP is not a secure context, the browser uses a bundled incremental SHA-256 implementation rather than relying on `crypto.subtle`. Tests cross-check it against Node crypto; no external CDN or runtime dependency is used.

Forwarded and X-Forwarded-* headers are rejected. Only valid RFC1918 or loopback IPv4 addresses are accepted, not hostnames or wildcard binds. Manual external proxies can still defeat private-network assumptions; do not configure them.
