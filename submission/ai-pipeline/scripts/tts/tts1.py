import sys, os, json, base64; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import el
voice, model, text, out = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
r = el.call(f'/v1/text-to-speech/{voice}/with-timestamps?output_format=mp3_44100_128', {'text': text, 'model_id': model, 'voice_settings': {'stability': .5, 'similarity_boost': .75}})
open(out, 'wb').write(base64.b64decode(r['audio_base64']))
al = r.get('alignment') or {}
json.dump(al, open(out.replace('.mp3', '.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print('ok', os.path.getsize(out), 'bytes; chars timed:', len(al.get('characters', [])), 'end:', (al.get('character_end_times_seconds') or [0])[-1], 's')
