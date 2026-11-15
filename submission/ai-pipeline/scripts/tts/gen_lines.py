# python -I gen_lines.py <page.html> <out dir> <who=voice_id[,model]> ... [--add=who:k1,k2] [--keys=k1,k2] [--list] [--force]
# Reads the Arabic text of every line spoken by those people from the page's TXT table, makes an mp3 + character timings
# per line with ElevenLabs (key from C:\book\.env, never printed), and writes manifest.json {key: {who, dur, voice, model}}.
# Lines come from the flow's literal say items { say: 'who', k: 'key' }; lines picked at run time are added with --add.
# --list = show which lines would be made (and their size) without calling ElevenLabs.
import sys, os, re, json, base64; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import el
sys.stdout.reconfigure(encoding='utf-8')
page, out = sys.argv[1], sys.argv[2]
args = [a for a in sys.argv[3:] if not a.startswith('--')]
force, listing, only = '--force' in sys.argv, '--list' in sys.argv, None
VO = {}
for a in args: who, v = a.split('='); vid, *m = v.split(','); VO[who] = (vid, m[0] if m else 'eleven_multilingual_v2')
src = open(page, encoding='utf-8').read()
txt = dict(re.findall(r"^\s*([a-z_0-9A-Z]+): \['([^']*)',", src, re.M)); first = set(txt)   # first = the first entry on its line
txt.update(re.findall(r"[{,]\s*([a-z_0-9A-Z]+): \['([^']*)',", src))          # several entries on one line
pairs = set(re.findall(r"say: '([a-z]+)', k: '([a-zA-Z_0-9]+)'", src))
for a in sys.argv:
    if a.startswith('--keys='): only = set(a[7:].split(','))
    if a.startswith('--add='): who, ks = a[6:].split(':'); pairs |= {(who, k) for k in ks.split(',')}
if os.path.basename(page).startswith('agr03'):
    # Eng. Hala's answers come through say('h_A'); the player ('you') says the chosen action (a_*, without its "B." label),
    # its reason (r_*) and the guess / doubt (y_*)
    pairs |= {('hala', k) for k in re.findall(r"say\('([a-zA-Z_0-9]+)'\)", src)} | {('hala', 'h_B'), ('hala', 'h_B2'), ('hala', 'h_C'), ('hala', 'h_E')}
    pairs |= {('you', k) for k in txt if re.match(r'(a_|r_|y_)', k) and k in first and k not in ('r_card', 'r_disc')}   # r_card / r_disc (and the other r_ on their lines) are ending headings
SAY_AS = {'x_co2': 'سي أو تو.'}                                                  # how a line is said when its text would be read wrongly
def spoken(k, t): return SAY_AS[k] if k in SAY_AS else re.sub(r'^(?:[أبجد]|هـ)\.\s*', '', t) if k.startswith('a_') else t
os.makedirs(out, exist_ok=True)
mf_path = os.path.join(out, 'manifest.json'); mf = json.load(open(mf_path, encoding='utf-8')) if os.path.exists(mf_path) else {}
total = 0
for who, k in sorted(pairs):
    if who not in VO or (only and k not in only): continue
    if k not in txt: print('!! no text for', who, k); continue
    vid, model = VO[who]; text = spoken(k, txt[k].replace("\\'", "'"))
    mp3 = os.path.join(out, k + '.mp3')
    if os.path.exists(mp3) and not force and mf.get(k, {}).get('voice') == vid: continue
    if listing: print(f'{who:8s} {k:14s} {len(text):4d}  {text}'); total += len(text); continue
    r = el.call(f'/v1/text-to-speech/{vid}/with-timestamps?output_format=mp3_44100_128', {'text': text, 'model_id': model, 'voice_settings': {'stability': .5, 'similarity_boost': .75}})
    open(mp3, 'wb').write(base64.b64decode(r['audio_base64']))
    al = r.get('alignment') or {}
    json.dump({'chars': al.get('characters', []), 'start': al.get('character_start_times_seconds', []), 'end': al.get('character_end_times_seconds', [])}, open(os.path.join(out, k + '.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    dur = (al.get('character_end_times_seconds') or [0])[-1]
    mf[k] = {'who': who, 'dur': round(dur, 3), 'voice': vid, 'model': model}; total += len(text)
    print(f'{who:8s} {k:14s} {dur:5.1f}s  {len(text)} chars')
    json.dump(mf, open(mf_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('characters' + (' (would be) used' if listing else ' used this run') + ':', total)
