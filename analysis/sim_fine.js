/* 2차 전수 검증 — 실사용 예산 구간을 10만원 단위로 촘촘히
   목적: 예산 간격이 넓으면 드러나지 않는 문제, 특히 '예산 역전'을 잡는다.
        예산을 10만원 올렸는데 후보 수나 구성 인원이 오히려 줄어드는 경우는
        사용자가 가장 납득하기 어려운 오작동이다. */
const fs=require('fs'), path=require('path');
const DIR=path.join(__dirname,"..")+path.sep;
const html=fs.readFileSync(DIR+'index.html','utf8');
const js=html.split('<script>')[1].split('</script>')[0].replace(/fetch\("dummy[\s\S]*$/,'');
const M={};
new Function('csvText','X', js+`
DATA=parseCSV(csvText); buildCatMedians(); buildPlatVr();
Object.assign(X,{DATA,recommend,combos,unitCost,minBudgetFor,relaxOptions,CATS,TIERS,ko});
`)(fs.readFileSync(DIR+'dummy_creators.csv','utf8'),M);
const {DATA,recommend,combos,unitCost,minBudgetFor,relaxOptions,CATS,TIERS,ko}=M;

const BUDGETS=[]; for(let b=500000;b<=20000000;b+=100000) BUDGETS.push(b);
const TK=["nano","micro","macro"], PLATS=["all","유튜브","인스타그램"];
const CATSETS=[[],...CATS.map(c=>[c])], NS=[0,2,3,4,5];

let n=0, runs=0, issues=[], mono=[], zeroNoRelax=[];
const prev={};
for(const b of BUDGETS) for(const t of TK) for(const p of PLATS) for(const cs of CATSETS){
  const key=`${TIERS[t].label}|${p}|${cs.join("+")||"전체"}`;
  const inp={budget:b,cats:cs,tier:t,plat:p};
  const r=recommend(inp); n++;
  if(r.fit.length===0 && relaxOptions(inp).length===0) zeroNoRelax.push(`${ko(b)} ${key}`);
  r.verified.concat(r.newcomer).forEach(c=>{
    if(!(c.score>=0&&c.score<=100)||Number.isNaN(c.score)) issues.push(`점수범위 ${c.name}`);
  });
  const auto=combos(r,b,0,0).stable.out.length;
  if(prev[key]){                                     // ── 단조성 검사
    if(r.fit.length<prev[key].fit) mono.push(`후보감소 ${key} ${ko(prev[key].b)}→${ko(b)}`);
    if(auto<prev[key].auto)        mono.push(`자동인원감소 ${key} ${ko(prev[key].b)}→${ko(b)}`);
  }
  prev[key]={fit:r.fit.length, auto, b};
  for(const k of NS) for(const alt of [0,1,2]){
    runs++;
    const cb=combos(r,b,k,alt);
    const used=cb.stable.out.reduce((s,c)=>s+unitCost(c).v,0);
    if(used>b) issues.push(`예산초과 ${key} ${ko(b)} n=${k}`);
    if(k>0 && cb.stable.out.length>k) issues.push(`인원초과 ${key} ${ko(b)} n=${k}`);
    if(new Set(cb.stable.out.map(c=>c.id)).size!==cb.stable.out.length) issues.push(`중복 ${key}`);
    if(cb.test){
      if(cb.test.out.reduce((s,c)=>s+unitCost(c).v,0)>b) issues.push(`테스트형 예산초과 ${key}`);
      if(cb.test.out.filter(c=>!c.verified).length>1) issues.push(`테스트형 신인2명+ ${key}`);
    }
    if(k>0 && cb.stable.short>0){
      const need=minBudgetFor(r.verified,k);
      if(need!==null && need<=b) issues.push(`채울수있는데못채움 ${key} ${ko(b)} n=${k}`);
    }
  }
}
console.log(`예산 ${BUDGETS.length}종(50만~2,000만, 10만 단위) x 팔로워 3 x 플랫폼 3 x 카테고리 ${CATSETS.length}`);
console.log(`= 조건 ${n.toLocaleString()}건 · 조합 계산 ${runs.toLocaleString()}회\n`);
console.log(`로직 오류        ${issues.length}건`);
[...new Set(issues)].slice(0,10).forEach(s=>console.log("   ! "+s));
console.log(`예산 역전        ${mono.length}건`);
[...new Set(mono)].slice(0,10).forEach(s=>console.log("   ! "+s));
console.log(`0명+완화안없음   ${zeroNoRelax.length}건 (${(zeroNoRelax.length/n*100).toFixed(2)}%)`);
zeroNoRelax.slice(0,5).forEach(s=>console.log("   · "+s));

console.log(`\n[참고] 밴드 x 플랫폼 x 카테고리 60조합 중 크리에이터 0명인 칸`);
let z=0;
for(const t of TK) for(const p of ["유튜브","인스타그램"]) for(const c of CATS){
  const cnt=DATA.filter(d=>d.followers>=TIERS[t].min&&d.followers<TIERS[t].max&&d.category===c&&d.platform===p).length;
  if(cnt===0){ console.log(`   ${TIERS[t].label} · ${p} · ${c}`); z++; }
}
console.log(`   → ${z}/60개. 200명 표본으로 60칸을 채우면 칸당 평균 3.3명이라 빈 칸이 생긴다.`);
console.log(`     구간 정의의 결함이 아니라 데이터 규모의 문제이며, 완화안 제시로 대응한다.`);
