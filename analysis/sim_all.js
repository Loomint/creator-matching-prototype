/* 전수 시뮬레이션: 예산 × 팔로워규모 × 카테고리 × 모드 × 인원 */
const fs=require('fs');
const path=require("path");
const DIR=path.join(__dirname,"..")+path.sep;
const html=fs.readFileSync(DIR+'index.html','utf8');
const js=html.split('<script>')[1].split('</script>')[0].replace(/fetch\("dummy[\s\S]*$/,'');
const csv=fs.readFileSync(DIR+'dummy_creators.csv','utf8');

const tail = `
DATA=parseCSV(csvText); buildCatMedians();
module_exports.DATA=DATA; module_exports.recommend=recommend; module_exports.combos=combos;
module_exports.unitCost=unitCost; module_exports.reachOf=reachOf; module_exports.ko=ko;
module_exports.relaxOptions=relaxOptions; module_exports.TIERS=TIERS; module_exports.CATS=CATS;
module_exports.CAT_MEDIAN_BUDGET=CAT_MEDIAN_BUDGET;
`;
const M={};
new Function('csvText','module_exports', js+tail)(csv, M);
const {DATA,recommend,combos,unitCost,reachOf,ko,relaxOptions,TIERS,CATS}=M;

const BUDGETS=[100000,300000,500000,1000000,2000000,3000000,5000000,7000000,10000000,15000000,20000000,30000000,50000000];
const TIERS_K=["nano","micro","macro"];
const CATSETS=[[],...CATS.map(c=>[c]),["뷰티","패션"],["테크","게임"],["식품","여행","라이프스타일"]];
const NS=[0,2,3,4,5];

let rows=[], issues=[];
for(const b of BUDGETS) for(const t of TIERS_K) for(const cs of CATSETS){
  const inp={budget:b,cats:cs,tier:t};
  const r=recommend(inp);
  const single={budget:b,tier:t,cats:cs.join("+")||"전체",fit:r.fit.length,ver:r.verified.length,newb:r.newcomer.length,base:r.base.length};
  // 단독 모드 이상 탐지
  if(r.fit.length===0){
    const opts=relaxOptions(inp);
    if(opts.length===0) issues.push(`[완화안 없음] ${ko(b)}/${t}/${single.cats} — base ${r.base.length}명`);
  }
  for(const n of NS){
    const cb=combos(r,b,n);
    const sN=cb.stable.out.length, tN=cb.test?cb.test.out.length:0;
    const sUsed=cb.stable.out.reduce((s,c)=>s+unitCost(c).v,0);
    rows.push({...single,n,sN,tN,sUsed,short:cb.stable.short});
    // 인원 지정했는데 못 채운 경우 중, 실제로는 채울 수 있었는지 검증(저단가 n명 합계 ≤ 예산?)
    if(n>0 && sN<n){
      const costs=r.verified.map(c=>unitCost(c).v).filter(v=>v>0).sort((a,b)=>a-b);
      const need=costs.slice(0,n).reduce((s,v)=>s+v,0);
      if(costs.length>=n && need<=b) issues.push(`[채울수있는데못채움] ${ko(b)}/${t}/${single.cats} n=${n} → ${sN}명, 최소조합필요 ${ko(need)}`);
    }
    if(n>0 && sN>n) issues.push(`[인원초과] ${ko(b)}/${t}/${single.cats} n=${n} → ${sN}명`);
    if(sUsed>b) issues.push(`[예산초과] ${ko(b)}/${t}/${single.cats} n=${n} → ${ko(sUsed)}`);
  }
}
console.log(`총 조합 ${rows.length}건 시뮬레이션\n`);

// 1) 인원 지정이 실패하는 비율
const targeted=rows.filter(r=>r.n>0);
const fail=targeted.filter(r=>r.sN<r.n);
console.log(`인원 지정 ${targeted.length}건 중 미충족 ${fail.length}건 (${(fail.length/targeted.length*100).toFixed(0)}%)`);
const byN={}; targeted.forEach(r=>{ byN[r.n]=byN[r.n]||{t:0,f:0}; byN[r.n].t++; if(r.sN<r.n) byN[r.n].f++; });
Object.entries(byN).forEach(([n,v])=>console.log(`  ${n}명 지정: ${v.f}/${v.t} 미충족 (${(v.f/v.t*100).toFixed(0)}%)`));

// 2) 5명 조합이 가능한 최소 예산 (전체/tier별)
console.log(`\n=== tier별 n명 조합 가능 최소예산 (카테고리 전체) ===`);
for(const t of TIERS_K){
  const line=[];
  for(const n of [2,3,4,5]){
    const hit=BUDGETS.find(b=>{ const r=recommend({budget:b,cats:[],tier:t}); return combos(r,b,n).stable.out.length>=n; });
    line.push(`${n}명:${hit?ko(hit):"불가"}`);
  }
  console.log(`  ${TIERS[t].label}: ${line.join(" / ")}`);
}

// 3) 카테고리 단일 선택 시 최소 예산 (마이크로 기준)
console.log(`\n=== 카테고리별 3명 조합 최소예산 (마이크로) ===`);
CATS.forEach(c=>{
  const hit=BUDGETS.find(b=>{ const r=recommend({budget:b,cats:[c],tier:"micro"}); return combos(r,b,3).stable.out.length>=3; });
  console.log(`  ${c.padEnd(7)} ${hit?ko(hit):"50억 이내 불가"}`);
});

// 4) 이상 케이스
console.log(`\n=== 이상 케이스 ${issues.length}건 ===`);
[...new Set(issues)].slice(0,25).forEach(s=>console.log("  "+s));

// 5) 예산 대비 최대 가능 인원 (자동 모드)
console.log(`\n=== 자동 모드 구성 인원 (카테고리 전체) ===`);
for(const t of TIERS_K){
  const s=BUDGETS.map(b=>{ const r=recommend({budget:b,cats:[],tier:t}); return `${ko(b)}:${combos(r,b,0).stable.out.length}명`; });
  console.log(`  ${TIERS[t].label}: ${s.join(" ")}`);
}
