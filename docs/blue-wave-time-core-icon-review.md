# Blue Wave + Time Core storefront icon review (draft)

This branch is reserved for the two user-approved icon designs. **The artwork binaries are not yet committed**; do not merge this branch.

## Proposed changes
- Replace only the Blue Wave card's ≈ and Time Core card's 24 with the corresponding artwork.
- Keep all four app descriptions, interface previews, download destinations, application functionality, and other icon symbols unchanged.
- Use optimized 512×512 WebP images at `assets/blue-wave-icon.webp` and `assets/time-core-icon.webp`, responsive sizes and meaningful alt text.
- Review desktop, tablet, and mobile layouts before merging.

## Current status
Original source images and prepared assets are available in the ChatGPT conversation's downloadable HBOMB icon PR package, but this GitHub connection cannot transfer the local binary files directly. The existing storefront has intentionally **not** been edited, so there are no broken image references.

## Review gate
Add both image binaries and apply the accompanying package's `apply_icons.py` to `index.html`, then inspect the actual diff and CI. Obtain explicit owner approval before merging or deploying.
