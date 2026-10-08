/* Season-mode presentation. The original ten-day mode remains in app.js. */
(() => {
  'use strict';
  const rules=GMSurvival, KEY='lefantasy-gm-survival-v2';
  const host=document.querySelector('#gm2Game'), start=document.querySelector('#gm2Start');
  let season=null, selected=null, storageNote='', starting=false;
  const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>Number(v).toFixed(1);
  const button=(action,label,extra='')=>`<button type="button" data-gm2-action="${action}" ${extra}>${label}</button>`;
  function save() {
    try { localStorage.setItem(KEY,JSON.stringify(season)); storageNote=''; }
    catch { storageNote='Browser storage is unavailable. Keep this tab open to retain your run.'; }
  }
  function player(p) {
    const z=rules.zone(p);
    return `<b>${e(p.name)}</b><small>${e(p.pos)} · ${e(p.team)}${p.age?' · age '+p.age:''}</small>
      <strong>${rules.impact(p)} <small>IMPACT / ${p.rating} BASE</small></strong>
      <span class="gm2-mood ${z.color}">${z.name} · ${Math.round(p.morale)}</span>
      <small>${e(p.motivation)}${p.out?` · OUT ${p.out} G`:''}</small>`;
  }
  function rotation() {
    const court=rules.SLOTS.map(pos=>{
      const p=season.roster.find(p=>p.id===season.lineup[pos]);
      return `<button type="button" class="gm2-tile gm2-slot-${pos.toLowerCase()} ${p.out?'unavailable':''}" data-gm2-slot="${pos}" ${season.log.length===82?'disabled':''} aria-label="Change ${pos} starter, ${e(p.name)}">
        <span class="gm2-position">${pos}</span>${player(p)}<small>Change starter →</small></button>`;
    }).join('');
    return `<div class="kicker">FIVE SLOTS · ONE ROTATION</div><h3>Your Starting Five</h3><div class="gm2-court">${court}</div>
      <p class="gm2-help">Tap a position to choose an eligible bench player. Every change displaces its starter. Out players contribute zero.</p>
      <div id="gm2Substitution">${substitution()}</div><h4 class="gm2-bench-heading">BENCH · FIVE PLAYERS</h4>
      <div class="gm2-bench">${rules.bench(season).map(p=>`<div class="gm2-reserve ${p.out?'unavailable':''}">${player(p)}</div>`).join('')}</div>`;
  }
  function substitution() {
    if(!selected) return '';
    const current=season.roster.find(p=>p.id===season.lineup[selected]);
    const candidates=rules.bench(season).filter(p=>rules.positions(p).includes(selected));
    return `<section class="gm2-picker" aria-label="${selected} substitution"><h4>Replace ${e(current.name)} at ${selected}</h4>
      <p>Change costs chemistry −2. Role-focused players react to gaining or losing starts.</p>
      ${candidates.length?candidates.map(p=>`<button type="button" data-gm2-sub="${e(p.id)}" ${p.out?'disabled':''}>${e(p.name)} · ${e(p.pos)} · ${rules.impact(p)} impact${p.out?' · OUT '+p.out+' G':''}</button>`).join(''):'<p>No eligible bench player. Try a trade or wait for recovery.</p>'}
      ${button('cancel','Close rotation picker')}</section>`;
  }
  const asset=a=>`${a.year} ${a.round===1?'1st':'2nd'} · ${e(a.origin)}`;
  function tradeCard(q) {
    const t=season.cpu.find(t=>t.name===q.team), preview=rules.projected(season,q);
    const list=(roster,ids,assets,picks)=>`<ul>${roster.filter(p=>ids.includes(p.id)).map(p=>`<li>${e(p.name)} · ${e(p.pos)} · ${p.rating} base / ${rules.impact(p)} impact${p.age?' · age '+p.age:''}<small>${e(p.motivation)} · morale ${Math.round(p.morale)}${p.out?' · OUT '+p.out+' G':''}</small></li>`).join('')}${assets.filter(a=>picks.includes(a.id)).map(a=>`<li>${asset(a)}</li>`).join('')}</ul>`;
    return `<div class="gm2-trade-sides"><section><h5>YOU SEND</h5>${list(season.roster,q.send,season.assets,q.sendPicks)}</section>
      <section><h5>YOU RECEIVE</h5>${list(t.roster,q.receive,t.assets,q.receivePicks)}</section></div>
      <p><b>${e(t.archetype.toUpperCase())}</b> · ${e(q.reason)}</p>
      <p>Your record: ${season.record.w}–${season.record.l} · ${e(season.goal)}. ${q.countered?'Counter accepted.':''}</p>
      <div class="gm2-projection"><b>PROJECTED · BEST ELIGIBLE ROTATION</b>
        <span>Starting five ${n(preview.before.five)} → ${n(preview.after.five)}</span><span>Bench ${n(preview.before.bench)} → ${n(preview.after.bench)}</span>
        <span>Team strength ${n(preview.before.total)} → ${n(preview.after.total)}</span>
        <span>Future picks ${preview.picks>=0?'+':''}${preview.picks} · chemistry −5 · loyalty morale −12</span></div>
      <details class="gm2-journal"><summary>Projected starting five</summary>${preview.rotation.map(p=>`<p><b>${p.pos}</b> · ${e(p.before)} → ${e(p.after)}</p>`).join('')}</details>
      <p class="gm2-help">Accepted trades reset to the best eligible rotation. Injuries and morale travel with players.</p>`;
  }
  function report() {
    const r=rules.report(season),b=r.behavior;
    return `<div class="gm2-card final"><small>82 GAMES · GM REPORT CARD</small><h4>${r.playoffs?'PLAYOFFS CLINCHED':'LOTTERY BOUND'}</h4>
      <p>${season.record.w}–${season.record.l} · owner approval ${Math.round(season.owner)}. ${r.playoffs?'You delivered the playoff goal.':'Ownership wanted 43 wins.'}</p>
      <dl class="gm2-grades">${Object.entries(r.grades).map(([label,grade])=>`<div><dt>${label}</dt><dd>${grade}</dd></div>`).join('')}</dl>
      <h4 class="gm2-identity">${e(r.identity)}</h4><p>Your identity reflects this run's decisions and results.</p>
      <p>${b.trades} trades · ${b.picksIn} picks acquired / ${b.picksOut} spent · ${b.kept} promises kept / ${b.broken} broken · ${b.development} training investments.</p>
      <p>${r.firsts} future firsts · ${r.seconds} future seconds · bench ${n(r.depth)} · ${r.stars} stars${r.age?' · average known age '+n(r.age):''}.</p>
      ${r.achievements.length?`<ul class="gm2-achievements">${r.achievements.map(a=>`<li>🏆 ${e(a)}</li>`).join('')}</ul>`:'<p>Keep experimenting to unlock achievements.</p>'}
      ${button('restart','Deal a new franchise →')}</div>`;
  }
  function decision() {
    if(season.log.length===82) return report();
    if(season.pending) {
      const q=season.pending;
      return `<div class="gm2-card"><small>${e(q.type.toUpperCase())} · TURN ${season.turn}/10</small><h4>${e(q.heading)}</h4>
        ${q.type==='trade'?tradeCard(q):`<p>${e(q.detail)}</p>`}
        ${rules.choices(season).map(c=>button(c.id,e(c.label))).join('')}</div>`;
    }
    const upcoming=season.schedule.slice(season.log.length,season.log.length+(season.turn===9?10:8));
    return `<div class="gm2-card"><small>NEXT STRETCH · ${season.turn+1}/10</small><h4>Make your next move.</h4>
      <p>Five starters carry 90% of strength; five reserves carry 10%. Morale affects impact. Chemistry and home court also affect each matchup.</p>
      <p>All OVRs, opponent strengths, scenarios and results are game estimates, separate from league standings.</p>
      <div class="gm2-upcoming">${upcoming.map(o=>`<span>${o.home?'vs':'at'} ${e(o.name)} · ${o.rating} OVR</span>`).join('')}</div>
      ${button('sim',`Simulate ${upcoming.length} games →`)}</div>`;
  }
  function render(focus=false) {
    if(!season) return;
    host.hidden=false; const rating=rules.strength(season);
    host.innerHTML=`<div class="gm2-score"><div><small>RECORD / 82 GAMES</small><strong>${season.record.w}–${season.record.l}</strong></div>
      <div><small>TEAM STRENGTH</small><strong>${n(rating.total)}</strong></div><div><small>CHEMISTRY</small><strong>${Math.round(season.chem)}</strong></div>
      <div><small>OWNER</small><strong>${Math.round(season.owner)}</strong></div><div><small>GOAL</small><strong>43 wins</strong></div></div>
      <p class="gm2-save-note">Season saved in this browser. ${e(storageNote)} Base OVR uses a game estimate from Sleeper search rank; missing ranks use 77. Eligibility comes from Sleeper.</p>
      <div class="gm2-notices" role="status">${season.notices.map(x=>`<p>${e(x)}</p>`).join('')}</div>
      <div class="gm2-layout"><section>${rotation()}</section><aside><div class="kicker">FRONT OFFICE DESK</div><h3>Decision Time</h3><div id="gm2Decision" tabindex="-1">${decision()}</div></aside></div>
      <div class="gm2-ledger"><section><h3>Future Assets</h3><p>Every owned pick. Spent picks stay spent.</p><ul>${season.assets.map(a=>`<li>${asset(a)}</li>`).join('')||'<li>No future picks left.</li>'}</ul></section>
      <section><h3>Your Word</h3><ul>${season.promises.map(q=>`<li>${e(q.name)} · ${q.kind==='upgrade'?'Starting five +1 impact':'Eight starts'} · due turn ${q.due} · <b>${q.status}</b></li>`).join('')||'<li>No promises yet.</li>'}${Object.values(season.flags).map(f=>`<li>${e(f.name)} · offensive freedom review · turn ${f.due} · ${f.resolved?'resolved':'pending'}</li>`).join('')}</ul></section></div>
      <details class="gm2-journal" ${season.log.length?'open':''}><summary>Game log · ${season.log.length}/82</summary><div class="gm2-results">${season.log.slice(-10).map(g=>`<div><b class="${g.won?'win':'loss'}">${g.won?'W':'L'}</b><span>${g.home?'vs':'at'} ${e(g.name)} · ${g.rating} OVR<small>Game ${g.game} · your strength ${n(g.strength)}</small></span><strong>${g.ours}–${g.theirs}</strong></div>`).join('')||'<p>Tip-off is waiting for your rotation.</p>'}</div>
      ${season.log.length>10?`<details><summary>Earlier ${season.log.length-10} results</summary>${season.log.slice(0,-10).map(g=>`<p>Game ${g.game}: ${g.won?'W':'L'} ${g.ours}–${g.theirs} · ${e(g.name)} · ${g.rating} OVR · team ${n(g.strength)}</p>`).join('')}</details>`:''}</details>
      <details class="gm2-journal"><summary>Trade ledger · ${season.history.length}</summary>${season.history.map(t=>`<p>Turn ${t.turn} · ${e(t.team)}: sent ${e(t.sent.join(', '))}; received ${e(t.received.join(', '))}. Picks in ${t.picksIn.length}; out ${t.picksOut.length}.</p>`).join('')||'<p>No deals made.</p>'}</details>`;
    start.textContent='DEAL A NEW TEAM →';
    if(focus) document.querySelector('#gm2Decision').focus({preventScroll:true});
  }
  async function deal() {
    if(starting) return;
    starting=true; start.disabled=true;
    host.hidden=false; host.innerHTML='<div class="empty">Scouting position-eligible Sleeper players…</div>';
    try {
      const players=await loadSleeperPlayers();
      // Use the existing Sleeper path and retain age/eligibility metadata for season mode.
      const pool=arcadePlayerPool(players).map(p=>({...p,age:players[p.id]?.age,fantasy_positions:players[p.id]?.fantasy_positions}));
      season=rules.create(pool); selected=null; save(); render(); host.scrollIntoView({behavior:'smooth',block:'start'});
    } catch(error) {
      host.innerHTML=`<div class="empty">${e(error.message)} ${button('retry','Try dealing again')}</div>`;
    } finally { starting=false; start.disabled=false; }
  }
  host.addEventListener('click',event=>{
    const target=event.target.closest('button'); if(!target || !host.contains(target)) return;
    if(target.dataset.gm2Action==='retry') { deal(); return; }
    if(!season) return;
    if(target.dataset.gm2Slot) {
      if(season.log.length===82) return;
      selected=target.dataset.gm2Slot; render();
      const picker=host.querySelector('.gm2-picker'); picker?.scrollIntoView({block:'nearest'}); picker?.querySelector('button:not(:disabled)')?.focus({preventScroll:true}); return;
    }
    if(target.dataset.gm2Sub) {
      if(rules.substitute(season,selected,target.dataset.gm2Sub)) { selected=null; save(); render(); } return;
    }
    const action=target.dataset.gm2Action;
    if(action==='cancel') { selected=null; render(); return; }
    if(action==='restart') { deal(); return; }
    if(action==='sim') rules.simulate(season); else rules.act(season,action);
    selected=null; save(); render(true);
  });
  start?.addEventListener('click',deal);
  try {
    const stored=localStorage.getItem(KEY);
    if(stored) { const candidate=JSON.parse(stored); rules.validate(candidate); season=candidate; render(); }
  } catch { storageNote='The saved season could not be restored. Deal a new team.'; }
})();
