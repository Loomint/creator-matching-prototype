# -*- coding: utf-8 -*-
# 모비데이즈 과제 — dummy_creators.csv 분포 프로파일링
import csv, statistics as st
from collections import Counter, defaultdict

import os
P=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dummy_creators.csv")
rows=[]
with open(P, encoding="utf-8-sig") as f:
    for r in csv.DictReader(f): rows.append(r)
print(f"총 {len(rows)}행\n")

def nums(key):
    out=[]
    for r in rows:
        v=(r.get(key) or "").strip()
        if v=="": continue
        try: out.append(float(v))
        except: pass
    return out

def q(vals, p):
    vals=sorted(vals); i=(len(vals)-1)*p
    lo,hi=int(i), min(int(i)+1, len(vals)-1)
    return vals[lo]+(vals[hi]-vals[lo])*(i-lo)

# 1) 결측/이상 스캔
print("=== 필드별 결측·비정상 ===")
for k in rows[0].keys():
    blank=sum(1 for r in rows if (r.get(k) or "").strip()=="")
    print(f"  {k:26s} 공란 {blank:3d} ({blank/len(rows)*100:.1f}%)")
# 숫자 필드 비정상값
for k in ["followers","avg_view_count","engagement_rate","total_campaign_count","total_campaign_budget_krw","avg_campaign_budget_krw","advertiser_rating"]:
    bad=[]
    for r in rows:
        v=(r.get(k) or "").strip()
        if v=="": continue
        try:
            x=float(v)
            if x<0: bad.append(("음수",r["creator_id"],v))
        except: bad.append(("타입",r["creator_id"],v))
    if bad: print(f"  ! {k}: 비정상 {len(bad)}건 예시 {bad[:4]}")

# 2) 팔로워 분포 (구간 정의 근거)
fo=nums("followers")
print(f"\n=== followers (n={len(fo)}) ===")
print(f"  min {min(fo):,.0f} / p10 {q(fo,.1):,.0f} / p25 {q(fo,.25):,.0f} / median {q(fo,.5):,.0f} / p75 {q(fo,.75):,.0f} / p90 {q(fo,.9):,.0f} / max {max(fo):,.0f}")
for lo,hi,label in [(0,10000,"~1만"),(10000,100000,"1만~10만"),(100000,500000,"10만~50만"),(500000,10**9,"50만~")]:
    c=sum(1 for v in fo if lo<=v<hi); print(f"  {label:10s} {c:3d}명 ({c/len(fo)*100:.0f}%)")

# 3) 나머지 지표 분포
for k in ["avg_view_count","engagement_rate","total_campaign_count","avg_campaign_budget_krw","total_campaign_budget_krw","advertiser_rating"]:
    v=nums(k)
    if not v: continue
    print(f"\n=== {k} (n={len(v)}) ===")
    print(f"  min {min(v):,.2f} / p25 {q(v,.25):,.2f} / median {q(v,.5):,.2f} / p75 {q(v,.75):,.2f} / p90 {q(v,.9):,.2f} / max {max(v):,.2f}")

# 4) 카테고리·플랫폼
print("\n=== 카테고리 ===")
for k,c in Counter(r["category"] for r in rows).most_common(): print(f"  {k:10s} {c}")
print("\n=== 플랫폼 ===")
for k,c in Counter(r["platform"] for r in rows).most_common(): print(f"  {k:10s} {c}")

# 5) 캠페인 이력 없음(=rating 공란) 프로파일
no_hist=[r for r in rows if (r.get("advertiser_rating") or "").strip()==""]
print(f"\n=== 캠페인 이력 없는(평점 공란) {len(no_hist)}명 프로파일 ===")
if no_hist:
    for k in ["followers","engagement_rate","avg_view_count","total_campaign_count"]:
        vs=[]
        for r in no_hist:
            v=(r.get(k) or "").strip()
            if v:
                try: vs.append(float(v))
                except: pass
        if vs: print(f"  {k:24s} median {st.median(vs):,.1f}  (전체 median {st.median(nums(k)):,.1f})")
    print(f"  총캠페인수 0인 사람: {sum(1 for r in no_hist if (r.get('total_campaign_count') or '0').strip() in ('0',''))}명")

# 6) 예산 관련: 카테고리별 avg_campaign_budget 중앙값 (예산 조건 설계용)
print("\n=== 카테고리별 avg_campaign_budget_krw 중앙값 ===")
d=defaultdict(list)
for r in rows:
    v=(r.get("avg_campaign_budget_krw") or "").strip()
    if v:
        try: d[r["category"]].append(float(v))
        except: pass
for k in sorted(d, key=lambda x: -st.median(d[x])):
    print(f"  {k:10s} {st.median(d[k]):>12,.0f}원  (n={len(d[k])})")
