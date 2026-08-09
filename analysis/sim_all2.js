/* 전수 재검증 v2: 예산×플랫폼×팔로워×카테고리×모드×인원 + 잠재 지표 탐색 */
const fs=require('fs');
const path=require("path");
const DIR=path.join(__dirname,"..")+path.sep;
const html=fs.readFileSync(DIR+'index.html','utf8');
const js=html.split('<script>')[1].split('</script>')[0].replace(/fetch\("dummy[\s\S]*$/,'');
const csv=fs.readFileSync(DIR+'dummy_creators.csv','utf8');
const M={};
new Function('csvText','X', js+`
DATA=parseCSV(csvText); buildCatMedians(); buildPlatVr();
Object.assign(X,{DATA,recommend,combos,unitCost,reachOf,ko,fmt,relaxOptions,TIERS,CATS,minBudgetFor,maxCountFor,scoreAll,median,cprOf,lowReachRate,viewRatio});
`)(csv, M);
const {DATA,recommend,combos,unitCost,reachOf,ko,fmt,relaxOptions,TIERS,CATS,minBudgetFor,maxCountFor,median}=M;

const BUDGETS=[50000,100000,300000,500000,1000000,2000000,3000000,5000000,10000000,20000000,50000000];
const TIERK=["nano","micro","macro"], PLATS=["all","유튜브","인스타그램"];
const CATSETS=[[],...CATS.map(c=>[c]),["뷰티","패션"],["테크","게임","교육"]];
const NS=[0,2,3,4,5];

let n=0, issues=[], emptyNoRelax=0, cases=[];
for(const b of BUDGETS) for(const t of TIERK) for(const p of PLATS) for(const cs of CATSETS){
  const inp={budget:b,cats:cs,tier:t,plat:p};
  const r=recommend(inp); n++;
  cases.push({b,t,p,cs:cs.join("+")||"전체",fit:r.fit.length,ver:r.verified.length,nb:r.newcomer.length});
  if(r.fit.length===0 && relaxOptions(inp).length===0) emptyNoRelax++;
  // 점수 무결성
  r.verified.concat(r.newcomer).forEach(c=>{
    if(!(c.score>=0 && c.score<=100)) issues.push(`점수범위 ${c.name} ${c.score}`);
    if(Number.isNaN(c.score)) issues.push(`NaN ${c.name}`);
  });
  for(const k of NS){
    for(const alt of [0,1,2]){
      const cb=combos(r,b,k,alt);
      const used=cb.stable.out.reduce((s,c)=>s+unitCost(c).v,0);
      if(used>b) issues.push(`예산초과 ${ko(b)}/${t}/${p}/${cs} n=${k} alt=${alt} → ${ko(used)}`);
      if(k>0 && cb.stable.out.length>k) issues.push(`인원초과 ${ko(b)} n=${k} → ${cb.stable.out.length}`);
      if(new Set(cb.stable.out.map(c=>c.id)).size!==cb.stable.out.length) issues.push(`중복포함 ${ko(b)} n=${k}`);
      if(cb.test){
        const u2=cb.test.out.reduce((s,c)=>s+unitCost(c).v,0);
        if(u2>b) issues.push(`테스트형 예산초과 ${ko(b)} n=${k}`);
        if(new Set(cb.test.out.map(c=>c.id)).size!==cb.test.out.length) issues.push(`테스트형 중복 ${ko(b)} n=${k}`);
        if(cb.test.out.filter(c=>!c.verified).length>1) issues.push(`테스트형 신인2명+ ${ko(b)} n=${k}`);
      }
      if(k>0 && cb.stable.short>0){
        const need=minBudgetFor(r.verified,k);
        if(need!==null && need<=b) issues.push(`채울수있는데못채움 ${ko(b)}/${t}/${p}/${cs} n=${k} need=${ko(need)}`);
      }
    }
  }
}
console.log(`조건 조합 ${n}건 × 인원 5 × 대안 3 = ${n*15}회 검증`);
console.log(`이상 케이스: ${issues.length}건`);
[...new Set(issues)].slice(0,10).forEach(s=>console.log("  ! "+s));
console.log(`후보 0명인데 완화안도 없는 케이스: ${emptyNoRelax}건 (${(emptyNoRelax/n*100).toFixed(1)}%)`);
const zero=cases.filter(c=>c.fit===0).length;
console.log(`후보 0명 발생: ${zero}/${n} (${(zero/n*100).toFixed(0)}%)`);

/* ---------- 데이터에서 더 뽑을 수 있는 신호 탐색 ---------- */
console.log(`\n===== 미사용 신호 탐색 =====`);
const num=v=>parseFloat(v)||0;
const rows=DATA;

// 1) 조회수/팔로워 = 실질 시청 전환율 (채널 건강도)
const vr = rows.map(c=>({...c, vr: c.followers? c.view/c.followers : 0}));
const vrByPlat={};
vr.forEach(c=>{(vrByPlat[c.platform]=vrByPlat[c.platform]||[]).push(c.vr)});
Object.entries(vrByPlat).forEach(([p,a])=>{
  const s=[...a].sort((x,y)=>x-y);
  console.log(`1) 조회수/팔로워 ${p}: 중앙 ${(median(s)*100).toFixed(1)}% · p10 ${(s[Math.floor(s.length*0.1)]*100).toFixed(1)}% · p90 ${(s[Math.floor(s.length*0.9)]*100).toFixed(1)}%`);
});
const lowVr = vr.filter(c=>c.vr < 0.10);
console.log(`   → 조회수/팔로워 10% 미만(유령팔로워 의심): ${lowVr.length}명 [${lowVr.slice(0,3).map(c=>c.name+' '+(c.vr*100).toFixed(1)+'%').join(', ')}]`);

// 2) 단가 효율 = 단가 / 실질도달 (CPM 유사)
const eff = rows.filter(c=>unitCost(c).v>0 && reachOf(c)>0).map(c=>({...c, cpr: unitCost(c).v/reachOf(c)}));
const cprs=eff.map(c=>c.cpr).sort((a,b)=>a-b);
console.log(`2) 도달 1인당 비용: 중앙 ${fmt(median(cprs))}원 · 최저 ${fmt(cprs[0])}원 · 최고 ${fmt(cprs[cprs.length-1])}원 (${(cprs[cprs.length-1]/cprs[0]).toFixed(0)}배 차이)`);
const best=[...eff].sort((a,b)=>a.cpr-b.cpr).slice(0,5);
console.log(`   → 효율 TOP5: ${best.map(c=>c.name+'('+fmt(c.cpr)+'원)').join(', ')}`);

// 3) 광고 노출 빈도 근사 = 총 집행건수 (팬 피로도 대리지표)
const heavy = rows.filter(c=>c.campaigns>=25);
console.log(`3) 집행 25건 이상(광고 과다 노출 우려): ${heavy.length}명 · 이들의 평균 평점 ${(heavy.filter(c=>c.rating).reduce((s,c)=>s+c.rating,0)/heavy.filter(c=>c.rating).length).toFixed(2)} vs 전체 ${(rows.filter(c=>c.rating).reduce((s,c)=>s+c.rating,0)/rows.filter(c=>c.rating).length).toFixed(2)}`);

// 4) 평점과 다른 지표의 상관 (평점이 무엇을 대변하는가)
function corr(a,b){const n=a.length,ma=a.reduce((x,y)=>x+y,0)/n,mb=b.reduce((x,y)=>x+y,0)/n;
  let num=0,da=0,db=0; for(let i=0;i<n;i++){const x=a[i]-ma,y=b[i]-mb;num+=x*y;da+=x*x;db+=y*y;} return num/Math.sqrt(da*db);}
const rated=rows.filter(c=>c.rating!==null);
console.log(`4) 평점 상관: 참여율 ${corr(rated.map(c=>c.rating),rated.map(c=>c.er)).toFixed(2)} · 집행건수 ${corr(rated.map(c=>c.rating),rated.map(c=>c.campaigns)).toFixed(2)} · 실질도달 ${corr(rated.map(c=>c.rating),rated.map(c=>reachOf(c))).toFixed(2)} · 단가 ${corr(rated.map(c=>c.rating),rated.map(c=>unitCost(c).v)).toFixed(2)}`);

// 5) 단가와 성과의 관계 (비싼 게 좋은가)
const paid=rows.filter(c=>unitCost(c).v>0 && !unitCost(c).est);
console.log(`5) 단가 상관: 실질도달 ${corr(paid.map(c=>unitCost(c).v),paid.map(c=>reachOf(c))).toFixed(2)} · 팔로워 ${corr(paid.map(c=>unitCost(c).v),paid.map(c=>c.followers)).toFixed(2)} · 참여율 ${corr(paid.map(c=>unitCost(c).v),paid.map(c=>c.er)).toFixed(2)}`);

// 6) 카테고리별 효율 편차
console.log(`6) 카테고리별 도달 1인당 비용 중앙값`);
const byCat={}; eff.forEach(c=>(byCat[c.category]=byCat[c.category]||[]).push(c.cpr));
Object.entries(byCat).sort((a,b)=>median(a[1])-median(b[1])).forEach(([k,v])=>console.log(`   ${k.padEnd(7)} ${fmt(median(v)).padStart(8)}원`));
