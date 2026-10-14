# HB Transfer + HB Chat preview

The separate `transfer-chat.html` page introduces the two projects without
changing `index.html`, its navigation, Windows downloads, or application previews.
It is a buildless page with inline CSS and JavaScript and no external dependencies.

## Preview the pull request locally

```sh
git fetch origin
git switch --track origin/feat/transfer-chat-hero
python3 -m http.server 8000
```

If the branch already exists locally, use `git switch feat/transfer-chat-hero`.
Open <http://localhost:8000/transfer-chat.html>. The page can also be opened
directly from disk; keep it beside `index.html` so the home links work.
No Cloudflare preview deployment is assumed or created by this change.

## Review checklist

- Check at 360px, 768px and 1440px widths; confirm no horizontal scrolling,
  overlapping copy or clipped action buttons. Also review with 200% text zoom.
- Follow Transfer, Chat, availability, home and back-to-top links.
- Use keyboard Tab to check the skip link, navigation, motion control and FAQ.
- Pause and resume motion. With reduced motion enabled in the OS/browser,
  decorative animations and smooth scrolling should stop automatically.
- Disable JavaScript: content, navigation and the native FAQ remain usable;
  the motion button stays hidden.
- The visuals are labeled concepts and have a descriptive accessible label.
  Example messages, file names and progress are not live app state.

## Content grounding

- Reuses the existing HBOMB Transfer & Chat concept's headline, file-sharing
  direction and independent-app identity, with blue/red styling matching the
  existing homepage.
- HB Transfer's local Wi-Fi / Windows-to-Android direction is presented as
  intent and an early MVP, not a verified production capability. An MVP archive
  exists, but its implementation was not audited for release readiness.
- HB Chat's current project README confirms Android 10+, peer/invite controls,
  a small-file testing flow and Internet-dependent PeerJS signaling. The README
  explicitly requires real-device testing for live/background reliability.
- No speed, unlimited-size, encryption, offline-chat or production-readiness
  claims. No APK links, invented release URLs or private-repository links appear
  in the public page. All navigation targets are local, available resources.

## Validation

```sh
python3 scripts/check-transfer-chat.py
```

The new CI workflow runs this check on pull requests and main pushes. It checks
HTML structure, local link targets, duplicate IDs and inline JavaScript syntax.
The existing homepage verification workflow stays unchanged.

Automated static checks do not verify visual layout or device compatibility.
Browser rendering and real-device review remain manual before merging.
This PR does not publish, merge, or modify either application's code.
