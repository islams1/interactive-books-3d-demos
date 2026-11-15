import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import el
for g in ['female', 'male']:
    try:
        r = el.call(f'/v1/shared-voices?page_size=12&language=ar&gender={g}&sort=usage_character_count_1y')
        print('==', g, len(r.get('voices', [])))
        for v in r.get('voices', []): print(' ', v.get('voice_id'), '|', v.get('public_owner_id'), '|', v.get('name'), '|', v.get('accent'), '|', v.get('age'), '|', v.get('use_case'), '|', (v.get('description') or '')[:70].replace('\n', ' '))
    except SystemExit as e: print(g, e)
