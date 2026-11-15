# Small ElevenLabs helper. The key is read from C:\book\.env (ELEVENLABS_API_KEY=...) or the environment; it is never printed.
import os, re, sys, json, urllib.request, urllib.error
def key():
    k = os.environ.get('ELEVENLABS_API_KEY')
    if not k and os.path.exists(r'C:\book\.env'):
        for line in open(r'C:\book\.env', encoding='utf-8-sig'):
            m = re.match(r'\s*(?:ELEVENLABS_API_KEY|ELEVEN_API_KEY|API_KEY)?\s*=?\s*["\']?(sk_[A-Za-z0-9]+)', line)
            if m: k = m.group(1); break
    if not k: sys.exit('no key found in C:\book\.env (expected a line with sk_...)')
    return k
def call(path, body=None, method=None, raw=False):
    req = urllib.request.Request('https://api.elevenlabs.io' + path, data=json.dumps(body).encode() if body is not None else None,
                                 method=method or ('POST' if body is not None else 'GET'), headers={'xi-api-key': key(), 'Content-Type': 'application/json', 'Accept': '*/*'})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: data = r.read(); return data if raw else json.loads(data)
    except urllib.error.HTTPError as e:
        sys.exit(f'HTTP {e.code}: {e.read().decode(errors="replace")[:400]}')
if __name__ == '__main__':
    u = call('/v1/user/subscription')
    print(json.dumps({k: u.get(k) for k in ['tier', 'character_count', 'character_limit', 'can_use_instant_voice_cloning', 'next_character_count_reset_unix', 'status']}, ensure_ascii=False))
