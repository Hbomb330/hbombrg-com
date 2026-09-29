HBOMB R.G. WEB APPS OS — V3.2 DEPLOY
Domain: https://hbombrg.com/

DEPLOYMENT
1. Upload the CONTENTS of this ZIP to the site's web root. index.html must remain at the root.
2. Keep all PNG/WEBP/MP4 files beside index.html; the page uses relative asset paths.
3. robots.txt, sitemap.xml, 404.html and _headers are already included.
4. _headers is useful on Cloudflare Pages and other hosts that support this convention. If your host ignores it, configure equivalent headers in the host dashboard.
5. After publishing, test https://hbombrg.com/ on desktop and mobile, then test a fake URL to confirm 404 handling.

APP LINKS
Edit HBOMB_APP_CONFIG near the bottom of index.html. Fill launchUrl/downloadUrl only when a destination is ready. Empty URLs intentionally show Coming Soon.

RELEASE RULE
V3.0 RELEASE remains the known-good rollback checkpoint. V3.2 changes deployment packaging/metadata, not the core window/dock engine.

V3.3: Four concept preview images in previews/. Cards animate subtly; Open Preview shows an enlarged interface simulation. These are representative visuals, not captured app footage. Deploy the full folder so relative SVG paths resolve.
