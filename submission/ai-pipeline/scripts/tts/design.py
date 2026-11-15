# python -I design.py <name> <model> <out dir> <description> <text>
# ElevenLabs Voice Design: makes 3 preview voices from a description and saves each preview as <name>_<i>.mp3,
# plus <name>_previews.json with the generated_voice_id of each (needed to save the chosen one as a real voice).
import sys, os, json, base64; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import el
name, model, out, desc, text = sys.argv[1:6]
os.makedirs(out, exist_ok=True)
r = el.call('/v1/text-to-voice/design', {'voice_description': desc, 'model_id': model, 'text': text, 'auto_generate_text': False})
info = []
for i, p in enumerate(r.get('previews', [])):
    f = os.path.join(out, f'{name}_{i}.mp3')
    open(f, 'wb').write(base64.b64decode(p['audio_base_64']))
    info.append({'file': os.path.basename(f), 'generated_voice_id': p.get('generated_voice_id'), 'dur': p.get('duration_secs'), 'lang': p.get('language')})
json.dump({'description': desc, 'model': model, 'text': text, 'previews': info}, open(os.path.join(out, f'{name}_previews.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(info, ensure_ascii=False))
