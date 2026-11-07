"""Stage only the public files from the current Git commit."""
import io
from pathlib import Path
import shutil
import subprocess
import tarfile
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_PATHS = (
    "404.html",
    "_headers",
    "docs/checksums",
    "hbomb-rg-web-apps-social.png",
    "holiday-gallery.html",
    "index.html",
    "orbit-deck-static-pulse-edition.webp",
    "previews",
    "robots.txt",
    "signal-in-the-snowfall-2-webgl-product.png",
    "sitemap.xml",
    "sorry-webgl-product.png",
    "static-pulse-preview.mp4",
    "subzero-signal-product.png",
    "test-pattern-webgl-product.png",
    "transfer-chat.html",
)

archive = subprocess.check_output(
    ["git", "archive", "HEAD", "--", *PUBLIC_PATHS], cwd=ROOT
)
with TemporaryDirectory(dir=ROOT) as temp:
    staged = Path(temp) / "assets"
    with tarfile.open(fileobj=io.BytesIO(archive)) as bundle:
        bundle.extractall(staged, filter="data")

    output = ROOT / "dist"
    if output.exists():
        shutil.rmtree(output)
    staged.rename(output)
