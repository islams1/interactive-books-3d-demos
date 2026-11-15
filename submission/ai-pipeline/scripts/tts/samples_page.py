# python -I samples_page.py <fp-extinguisher dir>  -> voice-samples.html: every recorded line of AGR-03 and SAF-01, by speaker
import sys, os, json, re, html
root = sys.argv[1]
SAY_AS = {'x_co2': 'سي أو تو.'}
NAMES = {'hala': 'م. هالة — Sarah', 'fathy': 'عم فتحي — George', 'you': 'أنت — Liam', 'book': 'الراوي (الدفتر) — Alice',
         'karim': 'م. كريم — Brian', 'mahmoud': 'محمود — Will', 'look': 'أنت (بتبص) — Liam'}
GAMES = [('agr03.html', 'agr03', 'AGR-03 — الطماطم الذابلة', ['hala', 'fathy', 'you', 'book']),
         ('saf01.html', 'saf01', 'SAF-01 — حريقة المخزن', ['karim', 'mahmoud', 'fathy', 'you', 'look'])]
body = ''
for page, d, title, order in GAMES:
    src = open(os.path.join(root, page), encoding='utf-8').read()
    txt = dict(re.findall(r"[{,\n]\s*([a-z_0-9A-Z]+): \['([^']*)',", src))
    mf = json.load(open(os.path.join(root, f'assets/audio/{d}/manifest.json'), encoding='utf-8'))
    spoken = lambda k: SAY_AS.get(k) or (re.sub(r'^(?:[أبجد]|هـ)\.\s*', '', txt[k]) if k.startswith('a_') else txt[k])
    body += f'<h1>{title} <span>{len(mf)} جملة</span></h1>\n'
    for who in order:
        keys = sorted(k for k, m in mf.items() if m['who'] == who)
        if not keys: continue
        body += f'<h2>{NAMES[who]} <span>{len(keys)}</span></h2>\n' + ''.join(
            f'<div class="s"><b>{k} · {mf[k]["dur"]:.1f} ث</b><p>{html.escape(spoken(k))}</p><audio controls preload="none" src="assets/audio/{d}/{k}.mp3"></audio></div>\n' for k in keys)
page = f'''<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Game voices</title>
<style>body{{font-family:system-ui,'Segoe UI',Tahoma;background:#15171a;color:#eee;padding:24px 16px;max-width:760px;margin:auto}}h1{{font-size:20px;margin-top:36px}}h2{{font-size:16px;margin-top:22px}}h1 span,h2 span{{color:#889;font-weight:400;font-size:13px}}.n{{color:#9aa;font-size:14px}}.s{{background:#22252a;border-radius:10px;padding:12px 16px;margin:10px 0}}.s b{{display:block;color:#889;font-weight:400;font-size:12px}}.s p{{color:#ddd;font-size:15px;margin:6px 0 10px}}audio{{width:100%}}</style></head>
<body><p class="n">ElevenLabs v3 · الأصوات المتاحة في الخطة المجانية. نفس الملفات اللي بتشتغل جوه المشاهد.</p>
{body}</body></html>'''
open(os.path.join(root, 'voice-samples.html'), 'w', encoding='utf-8', newline='\n').write(page)
print('ok')
