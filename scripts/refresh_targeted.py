"""Refresh the free regional lead catalog and evidence in one batch.

Install scripts/requirements.txt first, then run from the repository root:
    python scripts/refresh_targeted.py
"""
import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'work' / 'catalog'
SOURCE = WORK / 'region-places.geojsonseq'
DEFAULT_BBOX = '-90.9,34.2,-88.9,36.0'

def run(*args, env=None):
    print('>', ' '.join(map(str, args)), flush=True)
    subprocess.run(args, cwd=ROOT, env=env, check=True)

def latest_release():
    with urlopen('https://stac.overturemaps.org/catalog.json', timeout=20) as response:
        release = json.load(response)['latest']
    if not re.fullmatch(r'20\d{2}-\d{2}-\d{2}\.\d+', release):
        raise ValueError('Unexpected Overture release identifier')
    return release

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bbox', default=DEFAULT_BBOX, help='xmin,ymin,xmax,ymax')
    parser.add_argument('--release', help='Overture release ID; default discovers latest from STAC')
    parser.add_argument('--reuse-source', action='store_true', help='Reuse a matching downloaded extract')
    args = parser.parse_args()
    release = args.release or latest_release()
    WORK.mkdir(parents=True, exist_ok=True)
    metadata = WORK / 'source.json'
    if args.reuse_source:
        if not SOURCE.exists() or not metadata.exists() or json.loads(metadata.read_text()) != {'release': release, 'bbox': args.bbox}:
            raise ValueError('No source extract matches that release and bounding box')
    else:
        temporary = WORK / 'region-places.next.geojsonseq'
        temporary.unlink(missing_ok=True)
        run(sys.executable, '-m', 'overturemaps', 'download', f'--bbox={args.bbox}', '-f', 'geojsonseq',
            '-t', 'place', '-r', release, '-o', temporary)
        temporary.replace(SOURCE)
        metadata.write_text(json.dumps({'release': release, 'bbox': args.bbox}), encoding='utf-8')
    for name in ('lead-verification.jsonl', 'lead-contact-verification.jsonl', 'site-audit.json'):
        (WORK / name).unlink(missing_ok=True)
    env = {**os.environ, 'OVERTURE_RELEASE': release}
    run(sys.executable, 'scripts/select_targeted.py', env=env)
    run(sys.executable, 'scripts/verify_places.py', env=env)
    run(sys.executable, 'scripts/verify_contact_pages.py', env=env)
    checks = []
    for name in ('lead-verification.jsonl', 'lead-contact-verification.jsonl'):
        checks.extend(json.loads(line) for line in (WORK / name).read_text(encoding='utf-8').splitlines())
    if sum(row.get('reason') == 'passed' for row in checks) < 50:
        raise RuntimeError('Too few contacts passed; catalog files were preserved')
    run(sys.executable, 'scripts/package_leads.py', env=env)
    run('node', 'scripts/audit_opportunities.mjs', env=env)
    run('node', 'scripts/build_opportunities.mjs', env=env)
    run(sys.executable, 'scripts/build_no_site.py', env=env)
    print('Review the changed JSON/CSV files and build the site before deploying.')

if __name__ == '__main__':
    main()
