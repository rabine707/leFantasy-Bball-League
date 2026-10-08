/* GM Survival 2.0: browser-independent rules, with injectable randomness for verification. */
(function (root) {
  'use strict';
  const SLOTS = ['PG', 'SG', 'SF', 'PF', 'C'];
  const MOTIVES = ['Winning', 'Role', 'Loyalty', 'Development', 'Spotlight'];
  const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, n));
  const copy = x => JSON.parse(JSON.stringify(x));
  const pick = (a, rng) => a[Math.floor(rng() * a.length)];
  function positions(p) {
    return (Array.isArray(p.fantasy_positions) ? p.fantasy_positions : String(p.pos || p.position || '').split('/'))
      .filter(x => SLOTS.includes(x));
  }
  function zone(p) {
    return p.morale >= 80 ? {name: 'Locked in', color: 'green', mod: 2} :
      p.morale >= 60 ? {name: 'Happy', color: 'green', mod: 0} :
      p.morale >= 40 ? {name: 'Frustrated', color: 'yellow', mod: -3} :
      p.morale >= 20 ? {name: 'Unhappy', color: 'orange', mod: -6} :
      {name: 'Disengaged', color: 'red', mod: -9};
  }
  function impact(p) { return !p || p.out > 0 ? 0 : clamp(p.rating + zone(p).mod, 0, 99); }
  function starters(s) { return SLOTS.map(pos => s.roster.find(p => p.id === s.lineup[pos])); }
  function bench(s) { const ids = Object.values(s.lineup); return s.roster.filter(p => !ids.includes(p.id)); }
  function strength(s) {
    const five = starters(s).reduce((n, p) => n + impact(p), 0) / 5;
    const reserves = bench(s).reduce((n, p) => n + impact(p), 0) / 5;
    return {five: +five.toFixed(1), bench: +reserves.toFixed(1), total: +(five * .9 + reserves * .1).toFixed(1)};
  }
  // Exact assignment search handles dual eligibility without manufacturing positions.
  function bestLineup(roster, preferAvailable = true) {
    let best = null, score = -Infinity;
    function visit(i, used, lineup, value) {
      if (i === 5) { if (value > score) { best = {...lineup}; score = value; } return; }
      const pos = SLOTS[i];
      for (const p of roster.filter(p => positions(p).includes(pos) && !used.has(p.id))) {
        used.add(p.id); lineup[pos] = p.id;
        visit(i + 1, used, lineup, value + (preferAvailable ? impact(p) : p.rating));
        used.delete(p.id);
      }
    }
    visit(0, new Set(), {}, 0);
    return best;
  }
  function validate(s) {
    if (s.version !== 2 || s.roster.length !== 10 || new Set(s.roster.map(p => p.id)).size !== 10) throw Error('A franchise needs ten unique players.');
    if (Object.keys(s.lineup).length !== 5 || new Set(Object.values(s.lineup)).size !== 5) throw Error('The rotation needs five unique starters.');
    for (const pos of SLOTS) {
      const p = s.roster.find(p => p.id === s.lineup[pos]);
      if (!p || !positions(p).includes(pos)) throw Error('Invalid ' + pos + ' assignment.');
    }
    if (s.assets.some(a => a.owner !== 'You') || new Set(s.assets.map(a => a.id)).size !== s.assets.length) throw Error('Invalid asset ownership.');
    const allPlayers = [...s.roster, ...s.cpu.flatMap(t => t.roster)];
    if (new Set(allPlayers.map(p => p.id)).size !== allPlayers.length) throw Error('A player cannot belong to two franchises.');
    const allAssets = [...s.assets, ...s.cpu.flatMap(t => t.assets)];
    if (new Set(allAssets.map(a => a.id)).size !== allAssets.length) throw Error('A pick cannot have two owners.');
    return true;
  }
  function makePlayer(p, rng) {
    const rating = clamp(97 - Math.floor((p.rank || 180) / 9), 70, 97);
    return {...p, id: String(p.id), pos: positions(p).join('/'), rating, morale: 70, out: 0,
      age: Number(p.age) > 0 ? Number(p.age) : null, motivation: pick(MOTIVES, rng), starts: 0, missed: 0};
  }
  function draft(pool, rng) {
    // Draft two complete position groups: five starters and five eligible backups.
    const chosen = [];
    for (let round = 0; round < 2; round++) {
      const shuffled = pool.filter(p => !chosen.some(q => q.id === p.id)).map(p => ({p, n: rng()})).sort((a,b) => a.n-b.n).map(x=>x.p);
      let group = null;
      function visit(i, selected) {
        if (i === 5) { group = selected; return true; }
        return shuffled.filter(p => positions(p).includes(SLOTS[i]) && !selected.includes(p))
          .some(p => visit(i + 1, [...selected, p]));
      }
      if (!visit(0, [])) throw Error('Sleeper did not return enough position-eligible players. Try again after refreshing.');
      chosen.push(...group);
    }
    return chosen;
  }
  function assets(team, year) {
    return [1,2,3].flatMap(offset => [1,2].map(round => ({id: team + '-' + (year+offset) + '-' + round, origin: team, owner: team, year: year+offset, round})));
  }
  function create(pool, rng = Math.random, year = new Date().getFullYear()) {
    const usable = [...new Map(pool.filter(p => positions(p).length && p.name && p.team).map(p=>[String(p.id), {...p,id:String(p.id)}])).values()];
    if (usable.length < 50) throw Error('At least 50 active position-eligible Sleeper players are needed.');
    const top = usable.filter(p => p.rank && p.rank <= 220);
    let remaining = top.length >= 60 ? top : usable;
    const take = () => { const selected = draft(remaining, rng); remaining = remaining.filter(p => !selected.includes(p)); return selected.map(p => makePlayer(p, rng)); };
    const roster = take();
    const archetypes = [
      ['Title Town', 'contender', 'We need a star for a championship run.'],
      ['Next Era', 'rebuilder', 'We want youth and picks; our veteran can help you now.'],
      ['Reset City', 'seller', 'We are selling veteran talent to recover draft capital.'],
      ['Cut Line', 'playoff push', 'We need an immediate upgrade to reach the playoffs.']
    ];
    const cpu = archetypes.map(([name, archetype, reason]) => ({name, archetype, reason, roster:take(), assets:assets(name,year)}));
    const s = {version:2, roster, lineup:bestLineup(roster), cpu, assets:assets('You',year),
      record:{w:0,l:0}, turn:0, chem:70, owner:65, goal:'Make playoffs · 43 wins',
      promises:[], flags:{}, history:[], notices:[], pending:null, log:[], schedule:[],
      behavior:{trades:0,picksIn:0,picksOut:0,kept:0,broken:0,injuryGames:0,development:0,starGames:0,strengthSum:0}};
    for (let i=0;i<82;i++) {
      const t = cpu[i%cpu.length];
      const base = {'contender':89,'rebuilder':75,'seller':78,'playoff push':84}[t.archetype];
      s.schedule.push({name:t.name, archetype:t.archetype, rating:clamp(base + Math.floor(rng()*7)-3,70,96), home:i%2===0});
    }
    validate(s); return s;
  }
  function substitute(s, pos, id) {
    const p = s.roster.find(p => p.id === id);
    if (!SLOTS.includes(pos) || !p || !positions(p).includes(pos) || p.out > 0 || Object.values(s.lineup).includes(id)) return false;
    const previous = s.roster.find(p => p.id === s.lineup[pos]);
    s.lineup[pos] = id; // One authoritative assignment always displaces the previous starter.
    p.morale = clamp(p.morale + (['Role','Development'].includes(p.motivation) ? 6 : 2));
    previous.morale = clamp(previous.morale - (previous.motivation === 'Role' ? 8 : 3));
    s.chem = clamp(s.chem-2); validate(s); return true;
  }
  function promise(s, p, kind) {
    s.promises.push({id:'promise-'+s.turn+'-'+s.promises.length, player:p.id, name:p.name, kind, due:s.turn+3,
      baseline:strength(s).five, starts:p.starts, status:'open'});
    p.morale = clamp(p.morale+18); s.owner = clamp(s.owner-5);
  }
  function callbacks(s, final = false) {
    for (const q of s.promises.filter(q => q.status === 'open' && (final || q.due <= s.turn))) {
      const p = s.roster.find(p=>p.id===q.player);
      if (!p) continue;
      const kept = q.kind === 'upgrade' ? strength(s).five >= q.baseline+1 : p.starts-q.starts >= 8;
      q.status = kept?'kept':'broken'; p.morale = clamp(p.morale+(kept?15:-30));
      s.chem = clamp(s.chem+(kept?4:-6)); s.owner = clamp(s.owner+(kept?3:-6));
      s.behavior[kept?'kept':'broken']++;
      s.notices.push((kept?'PROMISE KEPT: ':'PROMISE BROKEN: ')+q.name+' · '+(q.kind==='upgrade'?'Improve starting five':'Eight starts')+'.');
    }
    for (const flag of Object.values(s.flags).filter(f=>!f.resolved && (final || f.due<=s.turn))) {
      flag.resolved = true;
      const p = s.roster.find(p=>p.id===flag.player);
      const good = s.record.w-flag.wins >= 10;
      if (p) p.morale = clamp(p.morale+(good?8:-12));
      s.chem = clamp(s.chem+(good?2:-4));
      s.notices.push(flag.name+' offensive freedom review: '+(good?'wins justified the gamble.':'teammates resent the extra touches.'));
    }
  }
  function offer(s, rng) {
    const t = pick(s.cpu,rng), selling = ['rebuilder','seller'].includes(t.archetype);
    const sorted = [...s.roster].sort((a,b)=>b.rating-a.rating);
    const theirs = [...t.roster].sort((a,b)=>b.rating-a.rating);
    let send, receive;
    if (selling) { send=[...s.roster].sort((a,b)=>(a.age || 27)-(b.age || 27) || a.rating-b.rating)[0]; receive=theirs[0]; }
    else { send=sorted[0]; receive=theirs.find(p=>p.rating<send.rating) || theirs[theirs.length-1]; }
    const sendPicks = selling ? s.assets.filter(a=>a.round===1).slice(0,1).map(a=>a.id) : [];
    const receivePicks = selling ? [] : t.assets.filter(a=>a.round===1).slice(0,1).map(a=>a.id);
    if (selling && !sendPicks.length) return null;
    // Never propose a deal that destroys the positional rotation.
    const roster = s.roster.filter(p=>p.id!==send.id).concat(receive);
    const cpuRoster = t.roster.filter(p=>p.id!==receive.id).concat(send);
    if (!bestLineup(roster) || !bestLineup(cpuRoster)) return null;
    return {type:'trade', team:t.name, send:[send.id], receive:[receive.id], sendPicks, receivePicks,
      reason:t.reason, countered:false, heading:'Trade call · '+t.name};
  }
  function projected(s, q) {
    const t = s.cpu.find(t=>t.name===q.team);
    const next = copy(s);
    next.roster = next.roster.filter(p=>!q.send.includes(p.id)).concat(copy(t.roster.filter(p=>q.receive.includes(p.id))));
    for (const p of next.roster) if (p.motivation==='Loyalty') p.morale=clamp(p.morale-12);
    next.lineup = bestLineup(next.roster);
    return {before:strength(s), after:strength(next), picks:q.receivePicks.length-q.sendPicks.length, chem:-5,
      rotation:SLOTS.map(pos=>({pos,before:s.roster.find(p=>p.id===s.lineup[pos]).name,after:next.roster.find(p=>p.id===next.lineup[pos]).name}))};
  }
  function trade(s, q) {
    const t = s.cpu.find(t=>t.name===q.team);
    if (!t || !q.send.every(id=>s.roster.some(p=>p.id===id)) || !q.receive.every(id=>t.roster.some(p=>p.id===id)) ||
      !q.sendPicks.every(id=>s.assets.some(a=>a.id===id)) || !q.receivePicks.every(id=>t.assets.some(a=>a.id===id))) return false;
    const outgoing = s.roster.filter(p=>q.send.includes(p.id)), incoming = t.roster.filter(p=>q.receive.includes(p.id));
    const next = s.roster.filter(p=>!q.send.includes(p.id)).concat(incoming);
    const rival = t.roster.filter(p=>!q.receive.includes(p.id)).concat(outgoing);
    if (next.length!==10 || rival.length!==10 || !bestLineup(next) || !bestLineup(rival)) return false;
    const acquired=s.assets.filter(a=>q.sendPicks.includes(a.id)), returned=t.assets.filter(a=>q.receivePicks.includes(a.id));
    s.roster=next; t.roster=rival;
    s.assets=s.assets.filter(a=>!q.sendPicks.includes(a.id)).concat(returned.map(a=>({...a,owner:'You'})));
    t.assets=t.assets.filter(a=>!q.receivePicks.includes(a.id)).concat(acquired.map(a=>({...a,owner:t.name})));
    for (const p of s.roster) if (p.motivation==='Loyalty') p.morale=clamp(p.morale-12);
    s.lineup=bestLineup(next);
    for (const q of s.promises.filter(q=>q.status==='open' && outgoing.some(p=>p.id===q.player))) {
      q.status='broken'; s.behavior.broken++; s.owner=clamp(s.owner-6);
      s.notices.push('PROMISE BROKEN: '+q.name+' was traded before delivery.');
    }
    s.chem=clamp(s.chem-5); s.behavior.trades++; s.behavior.picksIn+=returned.length; s.behavior.picksOut+=acquired.length;
    s.history.push({turn:s.turn,team:t.name,sent:outgoing.map(p=>p.name),received:incoming.map(p=>p.name),picksIn:returned,picksOut:acquired});
    validate(s); return true;
  }
  function event(s, rng) {
    if (s.turn%3===0) { const q=offer(s,rng); if(q) return q; }
    if (s.turn%3===1) {
      const healthy=s.roster.filter(p=>!p.out);
      if (healthy.length) {
        const p=pick(healthy,rng); p.out=3+Math.floor(rng()*5);
        return {type:'injury',player:p.id,heading:p.name+' · OUT '+p.out+' games',
          detail:'Unavailable means zero impact. Choose a replacement now, or accept a vacant contribution until recovery.'};
      }
    }
    const p=[...s.roster].sort((a,b)=>a.morale-b.morale)[0];
    return {type:'morale',player:p.id,heading:p.name+' wants to talk',detail:p.motivation+' is his motivation. Current morale: '+p.morale+'.'};
  }
  function choices(s) {
    const q=s.pending; if(!q) return [];
    if(q.type==='trade') return [{id:'accept',label:'Accept · chemistry −5; loyalty morale −12'},
      {id:'decline',label:'Decline · retain roster; owner −2'},
      ...(!q.countered?[{id:'counter',label:'Counter for a 2nd · chemistry −2; 45% rejection risk'}]:[])];
    const p=s.roster.find(p=>p.id===q.player);
    if(q.type==='injury') return [{id:'replace',label:'Best available rotation · chemistry −3; injured player morale −4'},
      {id:'wait',label:'Keep assignments · owner −3; unavailable players give zero impact'}];
    const map={
      Winning:[{id:'promise',label:'Promise an upgrade in 3 turns · morale +18; owner −5; failure −30 morale'},
        {id:'freedom',label:'Offensive freedom · morale +12; chemistry −8; review in 2 turns'}],
      Role:[{id:'start',label:'Start him if eligible · morale +14; chemistry −5; prior starter morale −10'},
        {id:'promise',label:'Promise 8 starts in 3 turns · morale +18; owner −5; failure −30 morale'}],
      Loyalty:[{id:'bond',label:'Team retreat · morale +14; chemistry +4; owner −8'}],
      Development:[{id:'develop',label:'Training focus · base OVR +1; morale +10; chemistry −5; owner −4'},
        {id:'promise',label:'Promise 8 starts in 3 turns · morale +18; owner −5; failure −30 morale'}],
      Spotlight:[{id:'freedom',label:'Give him the spotlight · morale +12; chemistry −8; review in 2 turns'}]
    };
    const hasPromise=s.promises.some(x=>x.player===p.id && x.status==='open');
    return [...map[p.motivation].filter(x=>(x.id!=='promise'||!hasPromise) && (x.id!=='start'||(!p.out && !Object.values(s.lineup).includes(p.id)))),
      {id:'meeting',label:'Players-only meeting · 55% morale +10; otherwise chemistry −12; owner −3'},
      {id:'firm',label:'Hold the line · owner +4; morale −12; chemistry −3'}];
  }
  function act(s, id, rng=Math.random) {
    if (!s.pending || !choices(s).some(c=>c.id===id)) return false;
    const q=s.pending, p=s.roster.find(p=>p.id===q.player);
    if(q.type==='trade') {
      if(id==='accept' && !trade(s,q)) return false;
      if(id==='decline') s.owner=clamp(s.owner-2);
      if(id==='counter') {
        s.chem=clamp(s.chem-2); const t=s.cpu.find(t=>t.name===q.team), extra=t.assets.find(a=>a.round===2 && !q.receivePicks.includes(a.id));
        if(extra && rng()>=.45) { q.receivePicks.push(extra.id); q.countered=true; s.notices.push(t.name+' accepted your counter. Review the revised package.'); return true; }
        s.notices.push(t.name+' rejected the counter and ended the call.');
      }
    } else if(q.type==='injury') {
      if(id==='replace') { s.lineup=bestLineup(s.roster); s.chem=clamp(s.chem-3); p.morale=clamp(p.morale-4); }
      else s.owner=clamp(s.owner-3);
    } else {
      if(id==='promise') promise(s,p,p.motivation==='Winning'?'upgrade':'starts');
      if(id==='freedom') { p.morale=clamp(p.morale+12); s.chem=clamp(s.chem-8);
        s.flags['freedom-'+s.turn+'-'+p.id]={player:p.id,name:p.name,due:s.turn+2,wins:s.record.w,resolved:false}; }
      if(id==='start') {
        const pos=positions(p).find(pos=>!Object.values(s.lineup).includes(p.id) && !p.out);
        if(!pos) { s.notices.push(p.name+' cannot take another slot while starting or unavailable.'); return false; }
        const previous=s.roster.find(x=>x.id===s.lineup[pos]); s.lineup[pos]=p.id; previous.morale=clamp(previous.morale-10);
        p.morale=clamp(p.morale+14); s.chem=clamp(s.chem-5);
      }
      if(id==='bond') { p.morale=clamp(p.morale+14); s.chem=clamp(s.chem+4); s.owner=clamp(s.owner-8); }
      if(id==='develop') { p.rating=clamp(p.rating+1,0,97); p.morale=clamp(p.morale+10); s.chem=clamp(s.chem-5); s.owner=clamp(s.owner-4); s.behavior.development++; }
      if(id==='meeting') { s.owner=clamp(s.owner-3); if(rng()<.55) s.roster.forEach(x=>x.morale=clamp(x.morale+10)); else s.chem=clamp(s.chem-12); }
      if(id==='firm') { s.owner=clamp(s.owner+4); p.morale=clamp(p.morale-12); s.chem=clamp(s.chem-3); }
    }
    s.pending=null; validate(s); return true;
  }
  function winProbability(s, opponent) {
    const rating=strength(s).total;
    const delta=rating-opponent.rating+(s.chem-60)*.08+(opponent.home?2:-2);
    return clamp(1/(1+Math.exp(-delta/7)),.03,.97);
  }
  function simulate(s, rng=Math.random) {
    if(s.pending || s.log.length>=82) return false;
    s.notices=[];
    const count=Math.min(s.turn===9?10:8,82-s.log.length);
    for(let i=0;i<count;i++) {
      const opponent=s.schedule[s.log.length], rating=strength(s).total, probability=winProbability(s,opponent), won=rng()<probability;
      const opponentScore=96+Math.floor(rng()*23), margin=1+Math.floor(rng()*14);
      s.record[won?'w':'l']++;
      s.log.push({...opponent,game:s.log.length+1,won,ours:opponentScore+(won?margin:-margin),theirs:opponentScore,strength:rating,probability});
      s.behavior.strengthSum+=rating;
      const ids=Object.values(s.lineup);
      s.behavior.starGames+=starters(s).filter(p=>p.rating>=90 && !p.out).length;
      for(const p of s.roster) {
        const starting=ids.includes(p.id), unavailable=p.out>0;
        if(unavailable) { p.out--; p.missed++; s.behavior.injuryGames++; }
        else if(starting) p.starts++;
        let change=p.motivation==='Winning'?(won?2:-3):p.motivation==='Role'?(starting&&!unavailable?1:-1):
          p.motivation==='Development'?(starting&&!unavailable?1.5:-.5):p.motivation==='Spotlight'?(starting&&!unavailable?1:-1):0;
        p.morale=clamp(p.morale+change);
      }
      s.owner=clamp(s.owner+(won?1:-1.3)); s.chem=clamp(s.chem+(won?.4:-.6));
    }
    s.turn++; callbacks(s,s.log.length===82);
    if(s.log.length<82) s.pending=event(s,rng);
    validate(s); return true;
  }
  function report(s) {
    const firsts=s.assets.filter(a=>a.round===1).length, seconds=s.assets.filter(a=>a.round===2).length;
    const grade=n=>n>=90?'A+':n>=80?'A':n>=70?'B':n>=60?'C':n>=45?'D':'F';
    const grades={Results:grade(s.record.w/82*130),Ownership:grade(s.owner),
      'Locker room':grade(s.roster.reduce((n,p)=>n+p.morale,0)/10),
      'Future Assets':firsts>=5?'A+':firsts>=4?'A':firsts>=3?'B':firsts>=2?'C':firsts>=1?'D':'F',
      'Promise keeping':s.behavior.broken?'D':s.behavior.kept?'A':'B'};
    const ages=s.roster.filter(p=>p.age), age=ages.length?ages.reduce((n,p)=>n+p.age,0)/ages.length:null;
    const b=s.behavior, depth=strength(s).bench, stars=s.roster.filter(p=>p.rating>=90).length;
    const identity=grades['Future Assets']==='A+'?'Sam Presti':b.trades>=3?'Daryl Morey':b.development>=2?'Player Developer':
      s.record.w>=50 && age>=29?'Pat Riley':stars>=3&&depth<76?'Rob Pelinka':b.kept>=2?'Promise Keeper':s.record.w>=50?'Title Architect':'Steady Hand';
    const achievements=[];
    if(grades['Future Assets']==='A+') achievements.push('Sam Presti Award · At some point you do have to draft somebody.');
    if(b.trades>=3) achievements.push('Trade Addict · Made '+b.trades+' trades.');
    if(b.picksOut>=2) achievements.push('All-In · Spent '+b.picksOut+' future picks.');
    if(b.injuryGames>=30) achievements.push('Hospital Ward · '+b.injuryGames+' player-games unavailable.');
    if(b.kept>=2) achievements.push('Your Word Is Gold · Kept '+b.kept+' promises.');
    if(s.record.w>=55) achievements.push('Contender · Won at least 55 games.');
    return {grades,identity,achievements,firsts,seconds,age,depth,stars,behavior:b,playoffs:s.record.w>=43};
  }
  const api={SLOTS,MOTIVES,positions,zone,impact,starters,bench,strength,bestLineup,validate,create,substitute,promise,callbacks,offer,projected,trade,event,choices,act,winProbability,simulate,report};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  else root.GMSurvival=api;
})(typeof globalThis!=='undefined'?globalThis:this);
