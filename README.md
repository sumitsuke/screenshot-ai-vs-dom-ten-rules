# screenshot-ai-vs-dom-ten-rules

**Can a multimodal LLM tell from screenshots alone whether a page breaks a numeric UI rule (15px, 38em, 44px) or a visual one (mixed H2 sizes, a 5-line h1)? Gold labels come from the DOM; the model only sees the pixels.**
Reproduction kit for the Sumitsuke Lab article (2026-09-19): 12 pages of one site at commit `7bec67f` ("before" the fixes), 10 frozen rules, 132 gold judgments measured with headless Chrome (CDP), 164 1:1 crops taken from the same render, and the verbatim answers of two judges (GPT via the ChatGPT UI, Gemini 2.5 Flash via API).

Article: [画像レビューはどこまで測れるか——対照のある 60 組で GPT 90%、外れは 15px の 1.5px 差・44px は対照が無く測れなかった](https://sumitsuke.jp/lab/screenshot-ai-vs-dom-ten-rules/) (Lab, Japanese) / part 1 (the DOM measurer): [見やすさをスクショで判断せず、DOM の数で直した](https://sumitsuke.jp/lab/readability-dom-eight-items/)

## In one paragraph

Ten rules were frozen from the site's own style rules (R1 body text < 15px, R2 two H2 sizes on one page, R3 line length > 38em, R4 h1 ≥ 5 lines at 375px, R5 a 4-option radio group taller than 100px, R6–R10 tap targets < 44px for five kinds of links). `shoot_cdp.mjs` measured every rule with `getComputedStyle` / `getBoundingClientRect` in headless Chrome and, from the **same render**, clipped 1:1 crops of the elements in question (164 PNG, sha256 in `shots/manifest.json`). Each judge got, per page, the frozen instruction (`judge_instructions.md`) plus that page's crops, and answered YES / NO / unknown / not-applicable per rule. Scoring is mechanical (`t35_score.py`, regex on the four verbatim values). **Main metric — the 60 pairs of rules R1–R4, the only rules whose gold contains both violations and non-violations**: GPT 54/60 (visual rules 36/36; numeric rules R1 15px and R3 38em 18/24 — all six misses on R1, where the difference is 1.5px), Gemini 41/57 with 3 "unknown". The five 44px rules (R5–R10, 36 pairs) contain only violations or only non-violations in the "before" version (breadcrumbs 40px on every page, footer links 45px on every page), so a judge that answers "small links violate, the footer does not" scores 36/36 without measuring anything; those pairs are reported but **not** counted as evidence of threshold discrimination. Pre-registered hypotheses: H1 "visual rules are caught by both models" — GPT yes, Gemini no (FN 44%); H2 "numeric rules are unknown/wrong in more than half" — on hold (only 24 contrastive numeric pairs); H3 "free-text remarks are mostly outside the rules" — supported for Gemini only. Two caveats: the two judges did not run under the same conditions (UI upload vs. API, temperature 0 only for Gemini; the GPT model version was not captured — the UI showed "GPT5.6SOL"), and GPT's R1 answer for the top page flipped YES→NO between two submissions of the same images.

## Quick start

Re-judge with your own model (offline gold, no site needed):

```bash
# 1. read judge_instructions.md (the part between the two '---' lines is the verbatim prompt)
# 2. for each folder in shots/<page>/ send the prompt + all PNGs of that folder, save the answer as responses/<Model>_<page>.txt
python t35_judge_gemini.py [model]   # does exactly that for Gemini via REST (GEMINI_API_KEY in env), temperature 0
python t35_score.py                  # → score_<Model>.csv and summary_t35.md for every responses/<Model>_*.txt
```

Re-measure and re-shoot (needs the site source at `7bec67f`, which is private — the script is published as the method; `BASE` points at a local `astro preview`):

```bash
node shoot_cdp.mjs   # headless Chrome via CDP on port 9333 → shots/, gold_v2.json, manifest.json
```

## What is measured and what is not

- **Measured**: per page × rule (R2 per width, so 12 × 11 = 132 judgments; 36 "not applicable" excluded → 96 pairs; 60 of them contrastive), TP/FP/FN/TN, "unknown", "mistaken as not-applicable", answered-a-missing-element. Judgeable rate, accuracy among judged, unknown rate, FP rate, FN rate, per rule group.
- **Not measured**: whether the pages look good (gold is the distance to a rule, nothing else); model capability in general (n = 1 per cell, two different delivery paths); the 44px rules (no contrast in the gold — the "after" version was not shot); scaled-down full-page screenshots (only 1:1 crops were sent).

## Data

- `gold_v2_labels.json` — 132 gold judgments with the rule text and the DOM value behind each label; `gold_v2_measurements.json` — the raw measurements.
- `shots/<page>/*.png` + `shots/manifest.json` — the 164 crops exactly as sent (commit, Chrome version, viewport, device scale factor, sha256 per file).
- `judge_instructions.md` — the frozen instruction (Japanese) and the scoring note.
- `responses/GPT_<page>.txt` (12, pasted verbatim from the ChatGPT UI by the operator; `_pilot_GPT_top_1回目.txt` is the first submission of the top page, whose R1 differed), `responses/Gemini_<page>.txt/.json` (12 + full API responses with `modelVersion` and usage).
- `score_GPT.csv`, `score_Gemini.csv` — one row per pair with bucket and group; `summary_t35.md` — all groups; `results_summary.md` — the write-up including the correction made after external review (Japanese).
- `SHA256SUMS` — `sha256sum -c SHA256SUMS`.

## License

Code: MIT (`LICENSE`). Data, images, tables: CC BY 4.0 (`DATA_LICENSE`) — please credit **Sumitsuke Lab** (https://sumitsuke.jp/lab/). The crops show pages of https://sumitsuke.jp/ as they were on 2026-09-19.
