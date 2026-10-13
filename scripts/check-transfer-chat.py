"""Dependency-free integrity check for the standalone product page."""
from html.parser import HTMLParser
from pathlib import Path
import subprocess
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
VOID = set('area base br col embed hr img input link meta param source track wbr'.split())


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.links = []
        self.stack = []
        self.scripts = []
        self.in_script = False
        self.labels = []
        self.h1_count = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag not in VOID:
            self.stack.append(tag)
        if 'id' in attrs:
            assert attrs['id'] not in self.ids, f"Duplicate ID: {attrs['id']}"
            self.ids.add(attrs['id'])
        if 'aria-labelledby' in attrs:
            self.labels.extend(attrs['aria-labelledby'].split())
        if tag == 'a':
            assert attrs.get('href'), 'Anchor missing href'
            self.links.append(attrs['href'])
        if tag == 'img':
            assert 'alt' in attrs, 'Image missing alt'
        if tag == 'script':
            assert 'src' not in attrs, 'Page should have no external scripts'
            self.in_script = True
            self.scripts.append('')
        if tag == 'h1':
            self.h1_count += 1

    def handle_endtag(self, tag):
        assert self.stack and self.stack[-1] == tag, f'Mismatched closing tag: {tag}'
        self.stack.pop()
        if tag == 'script':
            self.in_script = False

    def handle_data(self, data):
        if self.in_script:
            self.scripts[-1] += data


page = Page()
page.feed((ROOT / 'transfer-chat.html').read_text())
page.close()
assert not page.stack, f'Unclosed elements: {page.stack}'
assert page.h1_count == 1, 'Expected one main heading'
assert set(page.labels) <= page.ids, 'Broken accessible heading reference'
for link in page.links:
    target = urlsplit(link)
    assert not target.scheme and not target.netloc, f'Unexpected external link: {link}'
    if target.path:
        assert (ROOT / unquote(target.path)).is_file(), f'Missing local target: {link}'
    else:
        assert unquote(target.fragment) in page.ids, f'Broken fragment: {link}'
assert page.scripts, 'Motion controls script missing'
for script in page.scripts:
    result = subprocess.run(['node', '--check'], input=script, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
print(f'PASS: balanced HTML, unique IDs, heading labels, {len(page.links)} local links and JavaScript syntax')
