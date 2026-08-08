# -*- coding: utf-8 -*-
# 신인 27명 중립처리 시 실제 순위 시뮬레이션 + 참여율 곱셈안 비교
import csv, statistics as st
import os
P=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dummy_creators.csv")
rows=[]
with open(P, encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        for k in ["followers","avg_view_count","engagement_rate","total_campaign_count","avg_campaign_budget_krw"]:
            r[k]=float(r[k] or 0)
        rt=(r["advertiser_rating"] or "").strip()
        r["rating"]=float(rt) if rt else None
        rows.append(r)

def pct_rank(vals, v):  # 0~1 백분위
    s=sorted(vals); import bisect
    return bisect.bisect_left(s, v)/max(len(s)-1,1)

FO=[r["followers"] for r in rows]; VC=[r["avg_view_count"] for r in rows]
ER=[r["engagement_rate"] for r in rows]; RT=[r["rating"] for r in rows if r["rating"] is not None]
REACH=[r["avg_view_count"]*r["engagement_rate"]/100 for r in rows]  # 실참여자 근사
CC=[r["total_campaign_count"] for r in rows]

med_rating=st.median(RT)
print(f"평점 중앙값(중립값) = {med_rating}\n")

def score(r, mode):
    reach = r["avg_view_count"]*r["engagement_rate"]/100
    s_reach = pct_rank(REACH, reach)
    s_er    = pct_rank(ER, r["engagement_rate"])
    s_exp   = pct_rank(CC, r["total_campaign_count"])
    if r["rating"] is None:
        s_rt = pct_rank(RT, med_rating) if mode=="neutral" else 0.0
    else:
        s_rt = pct_rank(RT, r["rating"])
    if mode=="mult":   # 참여율을 곱셈(도달)으로만 반영
        return 0.45*s_reach + 0.30*s_rt + 0.25*s_exp
    return 0.30*s_reach + 0.20*s_er + 0.30*s_rt + 0.20*s_exp

for mode,label in [("neutral","중립처리(평점=중앙값 4.5)"),("zero","0점처리"),("mult","참여율 곱셈안(도달=조회수x참여율)")]:
    scored=sorted(rows, key=lambda r: -score(r,mode))
    ranks=[i+1 for i,r in enumerate(scored) if r["rating"] is None]
    top10=sum(1 for x in ranks if x<=10); top20=sum(1 for x in ranks if x<=20); top50=sum(1 for x in ranks if x<=50)
    print(f"[{label}] 신인 27명 순위: 최고 {min(ranks)}위 / 중앙 {int(st.median(ranks))}위 / 최저 {max(ranks)}위")
    print(f"   TOP10 내 {top10}명 · TOP20 내 {top20}명 · TOP50 내 {top50}명\n")

# 카테고리+예산 필터를 건 현실 시나리오
print("=== 시나리오: 뷰티, 예산 300만원, 마이크로(1만~10만) ===")
cand=[r for r in rows if r["category"]=="뷰티" and 10000<=r["followers"]<100000]
print(f"  1차 후보 {len(cand)}명 (그중 신인 {sum(1 for r in cand if r['rating'] is None)}명)")
def budget_ok(r, budget=3_000_000):
    b=r["avg_campaign_budget_krw"]
    return True if b==0 else b<=budget   # 0원(이력없음)은 통과시키되 별도 표시 필요
cand2=[r for r in cand if budget_ok(r)]
print(f"  예산 300만 이하 통과 {len(cand2)}명 (그중 단가 0원=이력없음 {sum(1 for r in cand2 if r['avg_campaign_budget_krw']==0)}명)")
for mode in ["neutral","mult"]:
    top=sorted(cand2, key=lambda r:-score(r,mode))[:5]
    print(f"  [{mode}] TOP5: " + ", ".join(f"{r['creator_name']}({'신인' if r['rating'] is None else r['rating']})" for r in top))
