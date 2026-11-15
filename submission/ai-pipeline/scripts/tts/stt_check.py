# python -I stt_check.py <mp3> <expected arabic text>
# Transcribes the clip with ElevenLabs Scribe and reports how close it is to the script (letter error rate,
# diacritics and punctuation ignored) - a rough check that the Arabic is pronounced clearly.
import sys, os, re, json, uuid, urllib.request, urllib.error; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import el
mp3, want = sys.argv[1], sys.argv[2]
b = uuid.uuid4().hex
body = (f'--{b}\r\nContent-Disposition: form-data; name="model_id"\r\n\r\nscribe_v1\r\n'
        f'--{b}\r\nContent-Disposition: form-data; name="language_code"\r\n\r\nara\r\n'
        f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="a.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n').encode() + open(mp3, 'rb').read() + f'\r\n--{b}--\r\n'.encode()
req = urllib.request.Request('https://api.elevenlabs.io/v1/speech-to-text', data=body, method='POST',
                             headers={'xi-api-key': el.key(), 'Content-Type': f'multipart/form-data; boundary={b}'})
try:
    with urllib.request.urlopen(req, timeout=120) as r: res = json.loads(r.read())
except urllib.error.HTTPError as e: sys.exit(f'HTTP {e.code}: {e.read().decode(errors="replace")[:300]}')
def norm(s):
    s = re.sub(r'[ً-ْـ]', '', s)            # harakat, tatweel
    s = re.sub(r'[أإآ]', 'ا', s).replace('ة', 'ه').replace('ى', 'ي')
    return re.sub(r'[^ء-ي]', '', s)
def lev(a, b):
    p = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        c = [i]
        for j, y in enumerate(b, 1): c.append(min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (x != y)))
        p = c
    return p[-1]
got = res.get('text', ''); a, g = norm(want), norm(got)
print(json.dumps({'file': os.path.basename(mp3), 'heard': got, 'letter_error': round(lev(a, g) / max(1, len(a)), 3)}, ensure_ascii=False))
