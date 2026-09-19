# -*- coding: utf-8 -*-
"""T35 採点: responses/<Model>_<slug>.txt を機械で読み（R<n>[（幅）]: YES／NO／不明／該当なし）、gold_v2_labels.json に当てる。
   評価単位＝頁 × ルール（R2 は幅ごと）＝12 × 11 ＝ 132 組。gold「該当なし」36 組は主指標から除外（答えが該当なし以外なら「無い要素に答えた」で別枠）＝評価 96 組。
   09-19 夜（外部精査 B-1）: R5〜R10 は同じルール内に違反・非違反が混在しない（R8 は非違反だけ・R9/R10 は違反だけ）＝閾値の判別を測れていない。
   ⟹ 群「対照あり（R1〜R4・60 組）」を主指標に足す。全体 96 組の値は参考（偏りで持ち上がる）。
   出力: score_<Model>.csv（1 行＝1 組）・summary_t35.md（5 指標 × モデル × ルール群）。人の裁定なし＝機械で当てる（当て方は凍結: 逐語の 4 値だけ）"""
import io, os, re, json, glob
from collections import Counter, defaultdict
HERE = os.path.dirname(os.path.abspath(__file__))
G = json.load(io.open(os.path.join(HERE, 'gold_v2_labels.json'), encoding='utf-8'))['gold']
SLUG = {p: (p.strip('/').replace('/', '_') or 'top') for p in G}
VISUAL = {'R2', 'R4', 'R5'}; METRIC = {'R1', 'R3', 'R6', 'R7', 'R8', 'R9', 'R10'}; CONTRAST = {'R1', 'R2', 'R3', 'R4'}   # 対照あり＝gold に違反と非違反の両方が在るルール
ANS = re.compile(r'R(\d+)(?:\s*[（(]\s*(375|1280)\s*[）)])?\s*[:：]\s*\**\s*(YES|NO|不明|該当なし)', re.I)
def parse(text):
    out = {}
    for m in ANS.finditer(text):
        r, w, a = 'R' + m.group(1), m.group(2), m.group(3).upper() if m.group(3).upper() in ('YES', 'NO') else m.group(3)
        out[(r, w)] = a
    return out
def gold_pairs(page):
    for r, x in G[page].items():
        if isinstance(x['label'], dict):
            for w, l in x['label'].items(): yield (r, w, l)
        else: yield (r, None, x['label'])
def bucket(gold, ans):
    if gold == '該当なし': return '除外' if ans == '該当なし' else ('無い要素に答えた' if ans in ('YES', 'NO') else '除外')
    if ans is None: return '未回答'
    if ans == '不明': return '不明'
    if ans == '該当なし': return '取り違え'
    if gold == '違反': return 'TP' if ans == 'YES' else 'FN'
    return 'FP' if ans == 'YES' else 'TN'
models = sorted({os.path.basename(f).split('_')[0] for f in glob.glob(os.path.join(HERE, 'responses', '*_*.txt')) if not os.path.basename(f).startswith('_') and not os.path.basename(f).startswith('pilot')})
lines = ['| モデル | 群 | 組 | 判定可能率 | 判定正解率 | 不明率 | FP 率 | FN 率 | 取り違え | 無い要素に答えた | 未回答 |', '|---|---|---|---|---|---|---|---|---|---|---|']
for model in models:
    rows = []
    for page, slug in SLUG.items():
        f = os.path.join(HERE, 'responses', f'{model}_{slug}.txt')
        if not os.path.exists(f): continue
        ans = parse(io.open(f, encoding='utf-8').read())
        for r, w, gold in gold_pairs(page):
            a = ans.get((r, w)) if w else ans.get((r, None))
            if a is None and w: a = ans.get((r, None))     # 幅を書かずに 1 つ答えた場合は両幅に当てる
            if a is None and not w: a = ans.get((r, '375')) or ans.get((r, '1280'))
            rows.append({'model': model, 'page': page, 'rule': r, 'width': w or '', 'gold': gold, 'answer': a or '', 'bucket': bucket(gold, a), 'group': '目視' if r in VISUAL else '計測'})
    with io.open(os.path.join(HERE, f'score_{model}.csv'), 'w', encoding='utf-8', newline='') as fh:
        fh.write('model,page,rule,width,gold,answer,bucket,group\n')
        for x in rows: fh.write(','.join(str(x[k]) for k in ('model', 'page', 'rule', 'width', 'gold', 'answer', 'bucket', 'group')) + '\n')
    for grp in ('全体', '目視', '計測', '対照あり R1〜R4', '対照あり・目視 R2 R4', '対照あり・計測 R1 R3', '対照なし R5〜R10'):
        if grp.startswith('対照あり'):
            rs = [x for x in rows if x['rule'] in CONTRAST and (grp == '対照あり R1〜R4' or x['group'] == grp.split('・')[1].split(' ')[0])]
        elif grp.startswith('対照なし'): rs = [x for x in rows if x['rule'] not in CONTRAST]
        else: rs = [x for x in rows if grp == '全体' or x['group'] == grp]
        c = Counter(x['bucket'] for x in rs); n = sum(c[k] for k in ('TP', 'FP', 'FN', 'TN', '不明', '取り違え', '未回答'))
        dec = c['TP'] + c['FP'] + c['FN'] + c['TN']
        f = lambda a, b: f'{a/b*100:.0f}%' if b else '—'
        lines.append(f"| {model} | {grp} | {n}（頁 {len({x['page'] for x in rs})}） | {f(dec, n)} | {f(c['TP']+c['TN'], dec)} | {f(c['不明'], n)} | {f(c['FP'], c['FP']+c['TN'])} | {f(c['FN'], c['TP']+c['FN'])} | {c['取り違え']} | {c['無い要素に答えた']} | {c['未回答']} |")
    per_rule = defaultdict(Counter)
    for x in rows: per_rule[x['rule']][x['bucket']] += 1
    lines.append(f"| {model} | ルール別 | " + ' / '.join(f"{r}: " + ','.join(f'{k}{v}' for k, v in sorted(per_rule[r].items())) for r in sorted(per_rule, key=lambda s: int(s[1:]))) + ' | | | | | | | | |')
io.open(os.path.join(HERE, 'summary_t35.md'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
print('\n'.join(lines))
