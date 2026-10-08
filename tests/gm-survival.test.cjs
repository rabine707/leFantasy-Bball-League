const {test}=require('node:test');
const assert=require('node:assert/strict');
const gm=require('../gm-survival');
function random(seed=77) { return ()=>{ seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; }; }
const pool=Array.from({length:200},(_,i)=>({id:String(i),name:'Player '+i,team:'NBA',pos:gm.SLOTS[i%5]+(i%3===0?'/'+gm.SLOTS[(i+1)%5]:''),rank:i+1,age:20+i%16}));
const deal=seed=>gm.create(pool,random(seed),2026);
test('deals ten unique players, five eligible starters and five compact reserves',()=>{
  for(let i=1;i<=50;i++) { const s=deal(i); assert.ok(gm.validate(s)); assert.equal(gm.bench(s).length,5); assert.equal(s.schedule.length,82); }
});
test('substitution displaces its prior starter and rejects duplicates, injury and wrong positions',()=>{
  const s=deal(5),p=gm.bench(s)[0],pos=gm.positions(p)[0],prior=s.lineup[pos];
  assert.ok(gm.substitute(s,pos,p.id)); assert.equal(s.lineup[pos],p.id); assert.ok(gm.bench(s).some(p=>p.id===prior));
  assert.equal(gm.substitute(s,pos,p.id),false);
  const b=gm.bench(s)[0]; b.out=2; assert.equal(gm.substitute(s,gm.positions(b)[0],b.id),false);
  b.out=0; assert.equal(gm.substitute(s,gm.SLOTS.find(x=>!gm.positions(b).includes(x)),b.id),false);
  assert.equal(gm.starters(s).length,5);
});
test('injured starters and reserves contribute zero; recovery counts unavailable games exactly',()=>{
  const s=deal(1),p=gm.starters(s)[0],before=gm.strength(s).total;
  p.out=3; assert.equal(gm.impact(p),0); assert.ok(before-gm.strength(s).total>12);
  const b=gm.bench(s)[0],benchBefore=gm.strength(s).bench; b.out=20;
  assert.equal(gm.impact(b),0); assert.ok(gm.strength(s).bench<benchBefore);
  gm.simulate(s,random(7)); assert.equal(p.out,0); assert.equal(p.missed,3); assert.equal(p.starts,5); assert.equal(b.out,12);
});
test('morale zones modify performance and opponents change win probability',()=>{
  const s=deal(4),p=gm.starters(s)[0]; p.morale=100; assert.equal(gm.impact(p),p.rating+2);
  p.morale=10; assert.equal(gm.impact(p),p.rating-9); assert.equal(gm.zone(p).color,'red');
  assert.ok(gm.winProbability(s,{rating:72,home:true})>gm.winProbability(s,{rating:94,home:true}));
  const before=gm.winProbability(s,{rating:85,home:true}); p.out=8;
  assert.ok(gm.winProbability(s,{rating:85,home:true})<before);
});
test('all motivation scenarios have a real cost and persisted future callbacks',()=>{
  for(const motivation of gm.MOTIVES) {
    const s=deal(3),p=gm.bench(s)[0]; p.motivation=motivation;
    s.pending={type:'morale',player:p.id};
    for(const option of gm.choices(s)) {
      const next=structuredClone(s), beforeOwner=next.owner,beforeChem=next.chem;
      assert.ok(gm.act(next,option.id,()=>.9));
      const changed=next.owner<beforeOwner||next.chem<beforeChem||next.roster.some((x,i)=>x.morale<s.roster[i].morale);
      assert.ok(changed, motivation+' / '+option.id+' must have a cost');
    }
  }
  const s=deal(9),p=gm.bench(s)[0]; gm.promise(s,p,'starts');
  const restored=JSON.parse(JSON.stringify(s)); restored.turn=3; gm.callbacks(restored);
  assert.equal(restored.promises[0].status,'broken'); assert.equal(restored.behavior.broken,1);
  gm.callbacks(restored); assert.equal(restored.behavior.broken,1);
  const win=deal(2),star=gm.starters(win)[0]; gm.promise(win,star,'starts'); star.starts=8; win.turn=3; gm.callbacks(win);
  assert.equal(win.promises[0].status,'kept');
});
test('real trades conserve players/assets, preserve eligibility and cannot repeat',()=>{
  let successful=0;
  for(let seed=1;seed<=50;seed++) {
    const s=deal(seed),q=gm.offer(s,random(seed)); if(!q) continue;
    const beforePlayers=[...s.roster,...s.cpu.flatMap(t=>t.roster)].map(p=>p.id).sort();
    const beforeAssets=[...s.assets,...s.cpu.flatMap(t=>t.assets)].map(p=>p.id).sort();
    const projection=gm.projected(s,q); assert.ok(Number.isFinite(projection.after.total));
    assert.ok(gm.trade(s,q)); assert.ok(gm.validate(s)); assert.equal(gm.trade(s,q),false);
    assert.deepEqual(gm.strength(s),projection.after,'projection includes loyalty morale cost');
    assert.deepEqual([...s.roster,...s.cpu.flatMap(t=>t.roster)].map(p=>p.id).sort(),beforePlayers);
    assert.deepEqual([...s.assets,...s.cpu.flatMap(t=>t.assets)].map(p=>p.id).sort(),beforeAssets);
    assert.equal(s.history.length,1); successful++;
  }
  assert.ok(successful>25);
});
test('counter rejection ends call; successful counter reserves a real pick',()=>{
  let s,q; for(let i=1;i<50;i++){ s=deal(i); q=gm.offer(s,random(i)); if(q) break; }
  s.pending=q; const next=structuredClone(s); assert.ok(gm.act(s,'counter',()=>.1)); assert.equal(s.pending,null);
  const n=next.pending.receivePicks.length; assert.ok(gm.act(next,'counter',()=>.9)); assert.equal(next.pending.countered,true);
  assert.equal(next.pending.receivePicks.length,n+1); assert.ok(gm.act(next,'accept')); assert.ok(gm.validate(next));
});
test('50 complete seasons finish exactly 82 games, resolve obligations and report actual behavior',()=>{
  for(let seed=1;seed<=50;seed++) {
    const s=deal(seed),rng=random(seed+500);
    while(s.log.length<82) {
      if(s.pending) {
        const options=gm.choices(s).filter(c=>c.id!=='start');
        assert.ok(gm.act(s,options[Math.floor(rng()*options.length)].id,rng));
      } else assert.ok(gm.simulate(s,rng));
      gm.validate(s);
    }
    assert.equal(s.turn,10); assert.equal(s.record.w+s.record.l,82); assert.equal(s.pending,null);
    assert.ok(s.promises.every(q=>q.status!=='open')); assert.equal(gm.simulate(s,rng),false);
    assert.equal(gm.report(s).behavior.trades,s.history.length);
    assert.equal(s.log.length,82); assert.ok(s.log.every(g=>g.ours!==g.theirs));
  }
});
test('Sam Presti Award requires A+ Future Assets and reflects owned first-round picks',()=>{
  const s=deal(8); assert.equal(gm.report(s).grades['Future Assets'],'B');
  s.assets.push({id:'extra1',round:1,owner:'You'},{id:'extra2',round:1,owner:'You'});
  const r=gm.report(s); assert.equal(r.grades['Future Assets'],'A+'); assert.equal(r.identity,'Sam Presti');
  assert.ok(r.achievements.some(a=>a.startsWith('Sam Presti Award')));
});
