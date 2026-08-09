/* 가중치 민감도 분석
   질문: 45/30/25라는 값이 결과를 얼마나 좌우하는가?
   방법: 가중치를 흔들어 TOP10/TOP20 순위가 얼마나 유지되는지 측정 */
const fs=require('fs'), path=require('path');
const DIR=path.join(__dirname,"..")+path.sep;
const html=fs.readFileSync(DIR+'index.html','utf8');
const js=html.split('<script>')[1].split('</script>')[0].replace(/fetch\("dummy[\s\S]*$/,'');
const csv=fs.readFileSync(DIR+'dummy_creators.csv','utf8');
const M={};
new Function('csvText','X', js+`
DATA=parseCSV(csvText); buildCatMedians(); buildPlatVr();
Object.assign(X,{DATA,pctRank,reachOf,median,unitCost});
`)(csv,M);
const {DATA,pctRank,reachOf,median,unitCost}=M;

/* 임의 가중치로 점수 재계산 — 프로토타입과 동일하게 플랫폼별 분리 정규화 */
function scoreW(pool,W,wCost){
  wCost=wCost||0; const rest=1-wCost;
  const g={}; pool.forEach(c=>{(g[c.platform]=g[c.platform]||[]).push(c)});
  let out=[];
  Object.values(g).forEach(gr=>{
    const rS=gr.map(reachOf).sort((a,b)=>a-b);
    const tS=gr.filter(c=>c.rating!==null).map(c=>c.rating).sort((a,b)=>a-b);
    const eS=gr.map(c=>c.campaigns).sort((a,b)=>a-b);
    const cS=gr.map(c=>unitCost(c).v).sort((a,b)=>a-b);
    const mR=median(tS);
    out=out.concat(gr.map(c=>{
      const sR=pctRank(rS,reachOf(c));
      const sT=tS.length?(c.rating!==null?pctRank(tS,c.rating):pctRank(tS,mR)):0.5;
      const sE=pctRank(eS,c.campaigns);
      const sC=1-pctRank(cS,unitCost(c).v);          // 단가는 낮을수록 가점
      return {...c,score:(rest*(W[0]*sR+W[1]*sT+W[2]*sE)+wCost*sC)*100};
    }));
  });
  return out.sort((a,b)=>b.score-a.score);
}
const pool=DATA.filter(c=>c.followers>=10000&&c.followers<100000&&c.verified);
const base=scoreW(pool,[.45,.30,.25]);
const baseN=base.map(c=>c.name);
const ov=(s,n)=>baseN.slice(0,n).filter(x=>s.slice(0,n).includes(x)).length;

console.log(`대상: 마이크로 밴드 검증 후보 ${pool.length}명\n`);
console.log("=== 1. 가중치를 흔들면 ===");
[[.45,.30,.25,"45/30/25 (채택)"],[.40,.35,.25,"40/35/25"],[.50,.30,.20,"50/30/20"],
 [.33,.34,.33,"33/34/33 균등"],[.60,.20,.20,"60/20/20"],[.25,.30,.45,"25/30/45"]].forEach(([a,b,c,l])=>{
  const s=scoreW(pool,[a,b,c]).map(x=>x.name);
  console.log(`  ${l.padEnd(16)} TOP10 ${ov(s,10)}/10 · TOP20 ${ov(s,20)}/20 · 1위 ${s[0]===baseN[0]?"동일":"바뀜 → "+s[0]}`);
});
console.log("\n→ ±5 범위에서는 순위가 거의 유지된다. 비율의 정밀도는 이 데이터에서 중요하지 않다.");

console.log("\n=== 2. 축을 통째로 빼면 ===");
[[0,.55,.45,"도달 제거"],[.60,0,.40,"평점 제거"],[.60,.40,0,"경험 제거"]].forEach(([a,b,c,l])=>{
  console.log(`  ${l.padEnd(10)} TOP10 ${ov(scoreW(pool,[a,b,c]).map(x=>x.name),10)}/10`);
});
console.log("\n→ 결과가 무너진다. 중요한 결정은 '비율'이 아니라 '어떤 축을 쓸까'였다.");
console.log("   특히 평점 제거의 영향이 가장 크다 — 다른 지표와 무상관인 독립 신호이기 때문(sim_all2.js 참조).");

console.log("\n=== 3. 단가를 4번째 축으로 넣으면 ===");
const baseReach=base.slice(0,10).reduce((a,c)=>a+reachOf(c),0)/10;
[0.1,0.2,0.3].forEach(w=>{
  const s=scoreW(pool,[.45,.30,.25],w);
  const r=s.slice(0,10).reduce((a,c)=>a+reachOf(c),0)/10;
  console.log(`  단가 ${String(w*100).padStart(2)}% 반영 → TOP10 ${ov(s.map(x=>x.name),10)}/10 · TOP10 평균 실질도달 ${Math.round(r)} (기준 ${Math.round(baseReach)}, ${((r/baseReach-1)*100).toFixed(0)}%)`);
});
console.log("\n→ 순위는 흔들리는데 도달은 떨어진다. 넣어서 얻는 것이 없어 채택하지 않았다.");
