import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import el
try:
    v = el.call('/v1/voices')
    print('my voices:', len(v.get('voices', [])))
    for x in v['voices'][:40]: print(' ', x['voice_id'], x['name'], (x.get('labels') or {}).get('gender'), (x.get('labels') or {}).get('accent'), x.get('category'))
except SystemExit as e: print('voices:', e)
