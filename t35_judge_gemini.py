# -*- coding: utf-8 -*-
"""T35 判定者＝Gemini（API・無料枠）。頁ごとに指示（逐語・凍結）＋そのフォルダの画像全部（12〜15 枚）を 1 回で送り、応答を原文のまま保存する。
   python t35_judge_gemini.py [model]   （既定 gemini-2.5-flash・鍵は HKCU 環境変数 GEMINI_API_KEY・印字しない）
   出力: responses/Gemini_<slug>.txt（本文）・responses/Gemini_<slug>.json（応答全体＝modelVersion・usage）"""
import io, os, sys, json, base64, time, re, winreg, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = sys.argv[1] if len(sys.argv) > 1 else 'gemini-2.5-flash'
def key():
    v = os.environ.get('GEMINI_API_KEY')
    if not v:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, 'Environment') as k: v = winreg.QueryValueEx(k, 'GEMINI_API_KEY')[0]
    return v
inst = io.open(os.path.join(HERE, 'judge_instructions.md'), encoding='utf-8').read()
prompt = inst.split('---')[1].strip()   # 「---」で挟んだ判定者向けの本文だけ
SHOTS = os.path.join(HERE, 'shots'); OUT = os.path.join(HERE, 'responses'); os.makedirs(OUT, exist_ok=True)
for slug in sorted(os.listdir(SHOTS)):
    d = os.path.join(SHOTS, slug)
    if not os.path.isdir(d): continue
    out_txt = os.path.join(OUT, f'Gemini_{slug}.txt')
    if os.path.exists(out_txt): print('skip', slug); continue
    files = sorted(f for f in os.listdir(d) if f.endswith('.png'))
    parts = [{'text': prompt + '\n\n添付した画像のファイル名（順に）: ' + '、'.join(files)}]
    for f in files:
        parts.append({'text': f'[画像: {f}]'})
        parts.append({'inline_data': {'mime_type': 'image/png', 'data': base64.b64encode(open(os.path.join(d, f), 'rb').read()).decode()}})
    body = json.dumps({'contents': [{'role': 'user', 'parts': parts}], 'generationConfig': {'temperature': 0}}).encode()
    req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={key()}', data=body, headers={'content-type': 'application/json'})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=300) as r: res = json.load(r)
            break
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8', 'replace')[:200]; print('  HTTP', e.code, msg); time.sleep(20 * (attempt + 1))
            if e.code != 429 and e.code < 500: raise
    text = ''.join(p.get('text', '') for p in res['candidates'][0]['content']['parts'])
    io.open(out_txt, 'w', encoding='utf-8', newline='\n').write(text + '\n')
    io.open(os.path.join(OUT, f'Gemini_{slug}.json'), 'w', encoding='utf-8').write(json.dumps({'model': MODEL, 'modelVersion': res.get('modelVersion'), 'usage': res.get('usageMetadata'), 'files': files, 'at': time.strftime('%Y-%m-%dT%H:%M:%S'), 'response': res}, ensure_ascii=False, indent=1))
    print(slug, len(files), '枚 →', len(text), '字', res.get('modelVersion'))
    time.sleep(7)  # 無料枠の RPM
print('done')
