# sync the game + the assets it uses into deploy/<game> (rm + copy so old hard links are not written through)
import os, shutil, sys, filecmp
SRC = 'c:/book/fp-extinguisher'
GAMES = {
  'agr03': ('agr03.html', ['grip', 'assets/Construction_Female_01', 'assets/Construction_Male_01', 'assets/Male_Adult_01', 'assets/anim',
            'assets/audio/agr03', 'assets/polyhaven', 'assets/renderpeople', 'assets/ROCKETBOX_LICENSE.md']),
  'saf01': ('saf01.html', ['assets/Construction_Male_01', 'assets/Construction_Male_02', 'assets/Male_Adult_01', 'assets/anim',
            'assets/audio/saf01', 'assets/polyhaven', 'assets/renderpeople', 'assets/ROCKETBOX_LICENSE.md']),
}
BAD = ('.env', 'fullbody', 'splat')

def put(s, d):
    if os.path.exists(d) and os.path.getsize(s) == os.path.getsize(d) and filecmp.cmp(s, d, shallow=False):
        return 0
    os.makedirs(os.path.dirname(d), exist_ok=True)
    if os.path.exists(d):
        os.remove(d)
    shutil.copy2(s, d)
    return 1

for game in sys.argv[1:]:
    page, items = GAMES[game]
    D = f'c:/book/deploy/{game}'
    n = put(f'{SRC}/{page}', f'{D}/index.html')
    files = 1
    for it in items:
        p = f'{SRC}/{it}'
        if os.path.isfile(p):
            n += put(p, f'{D}/{it}'); files += 1
            continue
        for root, _, fs in os.walk(p):
            for f in fs:
                s = os.path.join(root, f)
                rel = os.path.relpath(s, SRC).replace(os.sep, '/')
                if any(b in rel.split('/') or rel.endswith(b) for b in BAD):
                    continue
                n += put(s, f'{D}/{rel}'); files += 1
    bad = [os.path.join(r, f) for r, ds, fs in os.walk(D) for f in fs + ds if f in BAD or f.endswith('.env')]
    size = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(D) if '.vercel' not in r for f in fs)
    print(f'{game}: {files} files checked, {n} copied/updated, deploy folder {size / 1e6:.1f} MB, forbidden: {bad or "none"}')
