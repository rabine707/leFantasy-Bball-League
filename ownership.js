(()=>{"use strict";
const API="https://api.sleeper.app/v1",ROOT="1406415989997846528",$=s=>document.querySelector(s);
const safe=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const records=new Map(),audit=[],identities=new Map();let incomplete=0,seasonCount=0,eventCount=0;const flag=(type,season,uid,pid,detail,txid)=>audit.push({type,season,uid,pid,detail,txid:txid||""});
async function get(p){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const r=await fetch(API+p,{signal:controller.signal});if(!r.ok)throw Error("Sleeper "+r.status);return await r.json()}finally{clearTimeout(timer)}}
const stamp=v=>{const n=Number(v);return Number.isFinite(n)&&n>0?(n<1e11?n*1000:n):null};
function record(uid,pid,name,season){const key=uid+"|"+pid;if(!records.has(key))records.set(key,{uid,pid,name,player:pid,longest:0,total:0,stints:0,seasons:new Set(),closed:0,open:0,activeDays:0});const x=records.get(key);x.name=name;x.seasons.add(season);return x}
function calculate(league,users,rosters,drafts,transactions,isCurrent){
 const season=String(league.season||"Unknown"),names=new Map(users.map(u=>[String(u.user_id),u.metadata?.team_name||u.display_name||u.username||"Manager"]));
 for(const u of users){const uid=String(u.user_id),previous=identities.get(uid);identities.set(uid,{username:u.username||previous?.username||"",display:u.display_name||previous?.display||"",team:previous?.team||"",latest:previous?.latest||""})}for(const r of rosters){if(!r.owner_id)continue;const uid=String(r.owner_id),v=identities.get(uid)||{};const u=users.find(x=>String(x.user_id)===uid);const team=u?.metadata?.team_name||u?.display_name||u?.username||v.team||"Manager";identities.set(uid,{...v,team:v.latest?v.team:team,latest:v.latest||season})}
 const rosterOwner=new Map(rosters.filter(r=>r.owner_id).map(r=>[String(r.roster_id),String(r.owner_id)]));
 const events=[],active=new Map();const now=Date.now();
 // Provisional season window: 24 weeks from the earliest available draft start.
 // Never treat frozen offseason rosters as ongoing ownership.
 const draftStarts=drafts.map(d=>stamp(d.start_time)||stamp(d.created)).filter(Boolean);
 const seasonStart=draftStarts.length?Math.min(...draftStarts):null;
 const seasonEnd=seasonStart?seasonStart+24*7*86400000:null;
 const cutoff=seasonEnd?Math.min(now,seasonEnd):null;
 const duration=(start,end)=>cutoff===null?null:Math.max(0,(Math.min(end,cutoff)-start)/86400000);
 for(const d of drafts){for(const p of d.picks||[]){const uid=rosterOwner.get(String(p.roster_id))||String(p.picked_by||""),pid=String(p.player_id||"");if(!uid||!pid)continue;const t=stamp(p.metadata?.drafted_at)||stamp(p.metadata?.picked_at)||stamp(d.start_time)||stamp(d.created);if(!t){incomplete++;flag("Missing draft time",season,uid,pid,"Draft pick has no usable timestamp");continue}events.push({t,uid,pid,kind:"add",draft:true,source:"draft "+d.draft_id})}}
 for(const t of transactions){if(t.status!=="complete")continue;const when=stamp(t.status_updated)||stamp(t.created);if(!when){incomplete++;flag("Missing transaction time",season,"","","Transaction "+(t.transaction_id||"unknown"),t.transaction_id);continue}
  for(const [pid,rid] of Object.entries(t.drops||{})){const uid=rosterOwner.get(String(rid));if(uid)events.push({t:when,uid,pid,kind:"drop",source:t.type||"transaction",txid:t.transaction_id});else{incomplete++;flag("Unknown roster owner",season,"",pid,"Departure roster "+rid,t.transaction_id)}}
  for(const [pid,rid] of Object.entries(t.adds||{})){const uid=rosterOwner.get(String(rid));if(uid)events.push({t:when,uid,pid,kind:"add",source:t.type||"transaction",txid:t.transaction_id});else{incomplete++;flag("Unknown roster owner",season,"",pid,"Arrival roster "+rid,t.transaction_id)}}
 }
 events.sort((a,b)=>a.t-b.t||(a.kind==="drop"?-1:1));eventCount+=events.length;
 for(const e of events){const key=e.uid+"|"+e.pid,existing=active.get(key),name=names.get(e.uid)||"Manager";
  if(e.kind==="drop"){if(!existing){incomplete++;flag("Unmatched departure",season,e.uid,e.pid,"Drop/trade without recorded acquisition",e.txid);continue}const x=record(e.uid,e.pid,name,season);const days=duration(existing,e.t);if(days!==null){x.longest=Math.max(x.longest,days);x.total+=days;x.closed++}else flag("Unknown season window",season,e.uid,e.pid,"Cannot calculate hold without a draft start date",e.txid);active.delete(key)}
  else if(!existing){active.set(key,e.t);const x=record(e.uid,e.pid,name,season);x.stints++}else if(!e.draft){incomplete++;flag("Duplicate acquisition",season,e.uid,e.pid,"Acquired while already held",e.txid)}
 }
 for(const [key,t] of active){const [uid,pid]=key.split("|");const x=record(uid,pid,names.get(uid)||"Manager",season);x.open++;if(isCurrent){const roster=rosters.find(r=>String(r.owner_id)===uid&&(r.players||[]).map(String).includes(pid));if(!roster){flag("Roster mismatch",season,uid,pid,"Recorded as held, but absent from current roster")}if(roster&&t<=now){const days=duration(t,now);if(days!==null){x.activeDays=Math.max(x.activeDays,days);x.longest=Math.max(x.longest,days)}}}}
}
function renderAudit(){const root=$("#audit-rows");if(!root)return;const q=$("#audit-search").value.trim().toLowerCase(),filter=$("#audit-filter").value;const rows=audit.filter(x=>(filter==="all"||x.type===filter)&&(x.type+" "+x.season+" "+x.uid+" "+x.pid+" "+x.detail).toLowerCase().includes(q));$("#audit-summary").textContent=audit.length+" flagged events · "+rows.length+" shown. Flags are potential inconsistencies, not confirmed errors.";root.innerHTML=rows.slice(0,500).map(x=>"<tr><td>"+safe(x.season)+"</td><td>"+safe(x.type)+"</td><td>"+safe(x.uid)+"</td><td>"+safe(x.pid)+"</td><td>"+safe(x.detail)+"</td><td>"+safe(x.txid)+"</td></tr>").join("")||'<tr><td colspan="6">No matching flags.</td></tr>'}
const managerLabel=x=>{const i=identities.get(x.uid)||{},team=i.team||x.name,username=i.username||i.display||"";return {team,username}};
function render(){const q=$("#search").value.trim().toLowerCase(),sort=$("#sort").value;
 const value=x=>sort==="seasons"?x.seasons.size:sort==="total"?x.total+x.activeDays:x[sort];const a=[...records.values()].filter(x=>(x.name+" "+x.player+" "+managerLabel(x).team+" "+managerLabel(x).username).toLowerCase().includes(q)).sort((x,y)=>value(y)-value(x)||y.total+y.activeDays-x.total-x.activeDays);
 const fmt=x=>x.closed||x.activeDays?x.longest.toFixed(1)+"d"+(x.activeDays?" †":""):"—",total=x=>x.closed||x.activeDays?(x.total+x.activeDays).toFixed(1)+"d"+(x.activeDays?" †":""):"—";
 const manager=x=>{const i=managerLabel(x);return '<span class="team-name">'+safe(i.team)+'</span>'+(i.username?'<span class="sleeper-handle">@'+safe(i.username)+'</span>':"")};
 $("#rows").innerHTML=a.slice(0,500).map(x=>'<tr><td data-label="Manager">'+manager(x)+'</td><td data-label="Player" class="player-cell">'+safe(x.player)+'</td><td data-label="Longest hold">'+fmt(x)+'</td><td data-label="Total days">'+total(x)+'</td><td data-label="Acquisitions">'+x.stints+'</td><td data-label="Seasons">'+x.seasons.size+'</td></tr>').join("")||'<tr><td colspan="6">No matching records.</td></tr>';
}
async function run(){try{let league=await get("/league/"+ROOT),seasons=[];const seen=new Set();
 while(league&&seasons.length<20&&!seen.has(String(league.league_id))){seasons.push(league);seen.add(String(league.league_id));const prev=league.previous_league_id;if(!prev||prev==="0")break;try{league=await get("/league/"+prev)}catch{incomplete++;break}}
 for(const s of seasons){$("#status").textContent="Scanning "+s.season+" ("+(seasonCount+1)+"/"+seasons.length+")…";const id=s.league_id;
  const [users,rosters,drafts]=await Promise.all([get("/league/"+id+"/users"),get("/league/"+id+"/rosters"),get("/league/"+id+"/drafts")]);
  const pickResults=await Promise.allSettled(drafts.map(d=>get("/draft/"+d.draft_id+"/picks")));
  drafts.forEach((d,i)=>{d.picks=pickResults[i].status==="fulfilled"?pickResults[i].value:[];if(pickResults[i].status!=="fulfilled")incomplete++});
  const weeks=Math.min(30,Math.max(19,Number(s.settings?.playoff_week_start||19)+5));
  const results=[];for(let offset=0;offset<=weeks;offset+=6){const batch=await Promise.allSettled(Array.from({length:Math.min(6,weeks+1-offset)},(_,i)=>get("/league/"+id+"/transactions/"+(offset+i))));results.push(...batch);$("#status").textContent="Scanning "+s.season+" · transaction weeks "+Math.min(offset+6,weeks+1)+"/"+(weeks+1)+"…"}
  const tx=[],txIds=new Set();results.forEach(r=>{if(r.status==="fulfilled"&&Array.isArray(r.value)){for(const t of r.value){const key=String(t.transaction_id||JSON.stringify(t));if(!txIds.has(key)){txIds.add(key);tx.push(t)}}}else incomplete++});
  calculate(s,users,rosters,drafts,tx,String(id)===ROOT);seasonCount++;$("#status").textContent=seasonCount+" of "+seasons.length+" seasons processed · "+records.size+" records (loading player names…)";render();renderAudit();
 }
 try{const players=await get("/players/nba");for(const x of records.values()){const p=players[x.pid];if(p)x.player=[p.first_name,p.last_name].filter(Boolean).join(" ")||x.pid}}catch{incomplete++}
 $("#status").textContent=seasonCount+" linked seasons · "+eventCount+" ownership events · "+(incomplete?incomplete+" unresolved events/requests · ":"")+"† Active streaks stop at the estimated season end (24 weeks after draft start); historical open streaks excluded.";
 $("#stats").innerHTML=[["Manager-player pairs",records.size],["Seasons",seasonCount],["Recorded acquisitions",[...records.values()].reduce((n,x)=>n+x.stints,0)]].map(([k,v])=>'<div class="stat"><small>'+k+'</small><strong>'+v+"</strong></div>").join("");render();renderAudit();
 }catch(e){$("#status").textContent="History unavailable: "+e.message}}
 $("#audit-search").addEventListener("input",renderAudit);$("#audit-filter").addEventListener("change",renderAudit);$("#search").addEventListener("input",render);$("#sort").addEventListener("change",render);run();
})();