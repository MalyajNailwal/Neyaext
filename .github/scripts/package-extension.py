"""Build and verify an installable Neya ZIP using only approved runtime files."""
import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import tempfile
import zipfile

RUNTIME_FILES = (
    'manifest.json', 'background.js', 'content.js', 'detector.js',
    'popup.js', 'popup.html', 'popup.css', 'sidepanel.js', 'sidepanel.html', 'sidepanel.css',
    'icons/icon-16.png', 'icons/icon-32.png', 'icons/icon-48.png', 'icons/icon-128.png',
)


def build(source, output, expected_version=None, instructions=None):
    source = Path(source).resolve()
    output = Path(output).resolve()
    for name in RUNTIME_FILES:
        item = source / name
        if not item.is_file() or item.resolve() != item:
            raise ValueError(f'Missing or unsafe extension file: {name}. Select the folder containing manifest.json.')
    manifest = json.loads((source / 'manifest.json').read_text())
    version = manifest.get('version', '')
    if not re.fullmatch(r'\d+\.\d+\.\d+', version) or any(int(part) > 65535 for part in version.split('.')):
        raise ValueError('Invalid extension version')
    if expected_version is not None and expected_version != version:
        raise ValueError('Tag and manifest versions must match')
    if manifest.get('manifest_version') != 3:
        raise ValueError('Neya requires Manifest V3')

    references = [manifest['background']['service_worker'], manifest['action']['default_popup'], manifest['side_panel']['default_path']]
    references += list(manifest.get('icons', {}).values())
    references += list(manifest.get('action', {}).get('default_icon', {}).values())
    for script in manifest.get('content_scripts', []):
        references += script.get('js', []) + script.get('css', [])

    class Assets(HTMLParser):
        def handle_starttag(self, tag, attrs):
            for key, value in attrs:
                if key in ('src', 'href') and value and not re.match(r'^(https?:|data:|#)', value):
                    references.append(value)

    for name in ('popup.html', 'sidepanel.html'):
        Assets().feed((source / name).read_text())
    missing = set(references) - set(RUNTIME_FILES)
    if missing:
        raise ValueError(f'Referenced files missing from package allowlist: {sorted(missing)}')

    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=output.parent, suffix='.zip', delete=False) as handle:
        temporary = Path(handle.name)
    try:
        with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED) as archive:
            for name in RUNTIME_FILES:
                archive.write(source / name, name)
            if instructions:
                archive.write(instructions, 'INSTALL.txt')
        with zipfile.ZipFile(temporary) as archive:
            if archive.testzip() or 'manifest.json' not in archive.namelist():
                raise ValueError('Invalid ZIP or missing root manifest')
            if json.loads(archive.read('manifest.json')) != manifest:
                raise ValueError('Packaged manifest does not match source')
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)
    print(f'Validated Neya {version}: {output.name} (manifest.json at ZIP root)')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--version')
    parser.add_argument('--instructions', type=Path)
    args = parser.parse_args()
    instructions = args.instructions or (args.source / 'INSTALL.txt')
    build(args.source, args.output, args.version, instructions if instructions.is_file() else None)
