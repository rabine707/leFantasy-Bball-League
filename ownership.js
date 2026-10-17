(()=>{"use strict";
const API="https://api.sleeper.app/v1",ROOT="1406415989997846528",$=s=>document.querySelector(s);
const safe=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const records=new Map();let incomplete=0,seasonCount=0,eventCount=0;
async function get(p){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const r=await fetch(API+p,{signal:controller.signal});if(!r.ok)throw Error("Sleeper "+r.status);return await r.json()}finally{clearTimeout(timer)}}
const stamp=v=>{const n=Number(v);return Number.isFinite(n)&&n>0?(n<1e11?n*1000:n):null};
function record(uid,pid,name,season){const key=uid+"|"+pid;if(!records.has(key))records.set(key,{uid,pid,name,player:pid,longest:0,total:0,stints:0,seasons:new Set(),closed:0,open:0});const x=records.get(key);x.name=name;x.seasons.add(season);return x}
function calculate(league,users,rosters,drafts,transactions){
 const season=String(league.season||"Unknown"),names=new Map(users.map(u=>[String(u.user_id),u.metadata?.team_name||u.display_name||u.username||"Manager"]));
 const rosterOwner=new Map(rosters.filter(r=>r.owner_id).map(r=>[String(r.roster_id),String(r.owner_id)]));
 const events=[],active=new Map();
 for(const d of drafts){for(const p of d.picks||[]){const uid=String(p.picked_by||""),pid=String(p.player_id||"");if(!uid||!pid)continue;const t=stamp(p.metadata?.drafted_at)||stamp(p.metadata?.picked_at)||stamp(d.start_time)||stamp(d.created);if(!t){incomplete++;continue}events.push({t,uid,pid,kind:"add",draft:true})}}
 for(const t of transactions){if(t.status!=="complete")continue;const when=stamp(t.status_updated)||stamp(t.created);if(!when){incomplete++;continue}
  for(const [pid,rid] of Object.entries(t.drops||{})){const uid=rosterOwner.get(String(rid));if(uid)events.push({t:when,uid,pid,kind:"drop"})}
  for(const [pid,rid] of Object.entries(t.adds||{})){const uid=rosterOwner.get(String(rid));if(uid)events.push({t:when,uid,pid,kind:"add"})}
 }
 events.sort((a,b)=>a.t-b.t||(a.kind==="drop"?-1:1));eventCount+=events.length;
 for(const e of events){const key=e.uid+"|"+e.pid,existing=active.get(key),name=names.get(e.uid)||"Manager";
  if(e.kind==="drop"){if(!existing){incomplete++;continue}const x=record(e.uid,e.pid,name,season);const days=Math.max(0,(e.t-existing)/86400000);x.longest=Math.max(x.longest,days);x.total+=days;x.closed++;active.delete(key)}
  else if(!existing){active.set(key,e.t);const x=record(e.uid,e.pid,name,season);x.stints++}
 }
 for(const [key] of active){const [uid,pid]=key.split("|");record(uid,pid,names.get(uid)||"Manager",season).open++}
}
function render(){const q=$("#search").value.trim().toLowerCase(),sort=$("#sort").value;
 const a=[...records.values()].filter(x=>(x.name+" "+x.player).toLowerCase().includes(q)).sort((x,y)=>(sort==="seasons"?y.seasons.size-x.seasons.size:y[sort]-x[sort])||y.total-x.total);
 $("#rows").innerHTML=a.slice(0,500).map(x=>"<tr><td>"+safe(x.name)+"</td><td>"+safe(x.player)+"</td><td>"+(x.closed?x.longest.toFixed(1)+"d":"—")+"</td><td>"+(x.closed?x.total.toFixed(1)+"d":"—")+"</td><td>"+x.stints+"</td><td>"+x.seasons.size+"</td></tr>").join("")||'<tr><td colspan="6">No matching records.</td></tr>';
}
async function run(){try{let league=await get("/league/"+ROOT),seasons=[];const seen=new Set();
 while(league&&seasons.length<20&&!seen.has(String(league.league_id))){seasons.push(league);seen.add(String(league.league_id));const prev=league.previous_league_id;if(!prev||prev==="0")break;league=await get("/league/"+prev)}
 for(const s of seasons){$("#status").textContent="Scanning "+s.season+" ("+(seasonCount+1)+"/"+seasons.length+")…";const id=s.league_id;
  const [users,rosters,drafts]=await Promise.all([get("/league/"+id+"/users"),get("/league/"+id+"/rosters"),get("/league/"+id+"/drafts")]);
  const pickResults=await Promise.allSettled(drafts.map(d=>get("/draft/"+d.draft_id+"/picks")));
  drafts.forEach((d,i)=>{d.picks=pickResults[i].status==="fulfilled"?pickResults[i].value:[];if(pickResults[i].status!=="fulfilled")incomplete++});
  const weeks=Math.min(30,Math.max(19,Number(s.settings?.playoff_week_start||19)+5));
  const results=await Promise.allSettled(Array.from({length:weeks},(_,i)=>get("/league/"+id+"/transactions/"+(i+1))));
  const tx=[];results.forEach(r=>{if(r.status==="fulfilled"&&Array.isArray(r.value))tx.push(...r.value);else incomplete++});
  calculate(s,users,rosters,drafts,tx);seasonCount++;
 }
 try{const players=await get("/players/nba");for(const x of records.values()){const p=players[x.pid];if(p)x.player=[p.first_name,p.last_name].filter(Boolean).join(" ")||x.pid}}catch{incomplete++}
 $("#status").textContent=seasonCount+" linked seasons · "+eventCount+" ownership events · "+(incomplete?incomplete+" unresolved events/requests · ":"")+"Closed holding periods only; active holds excluded from days.";
 $("#stats").innerHTML=[["Manager-player pairs",records.size],["Seasons",seasonCount],["Recorded acquisitions",[...records.values()].reduce((n,x)=>n+x.stints,0)]].map(([k,v])=>'<div class="stat"><small>'+k+'</small><strong>'+v+"</strong></div>").join("");render();
 }catch(e){$("#status").textContent="History unavailable: "+e.message}}
 $("#search").addEventListener("input",render);$("#sort").addEventListener("change",render);run();
})();