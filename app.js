const LEAGUE_ID="1406415989997846528",API="https://api.sleeper.app/v1";const state={league:null,users:[],rosters:[],drafts:[],draft:null,picks:[],history:[]};const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));async function get(path){const r=await fetch(API+path);if(!r.ok)throw Error("Sleeper "+r.status);return r.json()}function route(n){$$(".page").forEach(x=>x.classList.toggle("active",x.dataset.page===n));$$("[data-route]").forEach(x=>x.classList.toggle("active",x.dataset.route===n));scrollTo({top:0,behavior:"smooth"})}$$("[data-route]").forEach(b=>b.addEventListener("click",()=>route(b.dataset.route)));function avatar(u){return u&&u.avatar?"https://sleepercdn.com/avatars/thumbs/"+u.avatar:""}function rosterFor(id){return state.rosters.find(r=>r.owner_id===id)}function status(ok,label){const e=$("#apiStatus");e.classList.toggle("online",ok);e.classList.toggle("offline",!ok);e.querySelector("span").textContent=label}function renderLeague(){const l=state.league||{},name=l.name||"LeFantasy Basketball";$("#leagueSubtitle").textContent=name+" · Live league data from Sleeper";$("#teamCount").textContent=l.total_rosters||state.users.length||"—";$("#rosterCount").textContent=state.rosters.length||"—";const filled=state.rosters.filter(r=>r.owner_id).length;const cards=[["LEAGUE",name,(l.season||"2026")+" season · "+(l.status||"preseason")],["MANAGERS",state.users.length+" connected",filled+" occupied rosters"],["DRAFT",state.draft?String(state.draft.status||"configured").toUpperCase():"NOT FOUND",state.draft?String(state.draft.settings?.teams||l.total_rosters||"—")+" teams · "+(state.draft.type||"draft"):"No draft returned yet"]];$("#pulse").innerHTML=cards.map(x=>'<article class="card"><small>'+esc(x[0])+'</small><strong>'+esc(x[1])+'</strong><p>'+esc(x[2])+'</p></article>').join("");$("#managerGrid").innerHTML=state.users.map(u=>{const r=rosterFor(u.user_id),display=u.metadata?.team_name||u.display_name||u.username||"Manager",img=avatar(u);return '<article class="manager" data-manager="'+esc(u.user_id)+'">'+(img?'<img src="'+img+'" alt="">':"")+'<h3>'+esc(display)+'</h3><p>@'+esc(u.username||u.display_name||"sleeper")+'</p><div class="roster">Roster '+esc(r?.roster_id||"—")+' · '+(r?.players?.length||0)+' players</div></article>'}).join("")||'<div class="empty">No managers returned.</div>';$("#managerGrid").querySelectorAll("[data-manager]").forEach(el=>el.addEventListener("click",()=>openManager(el.dataset.manager)));$("#lastSync").textContent="Synced "+new Date().toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}function renderDraft(){const d=state.draft;if(!d){$("#draftStatus").textContent="NOT FOUND";$("#draftMeta").textContent="Sleeper has not returned a draft for this league.";$("#warStatus").textContent="WAITING";$("#warCopy").textContent="No draft configuration is available yet.";return}const teams=d.settings?.teams||state.league?.total_rosters||10;$("#draftStatus").textContent=String(d.status||"configured").toUpperCase();$("#draftMeta").textContent=teams+" teams · "+(d.type||"draft")+" · "+(d.settings?.rounds||"—")+" rounds";$("#warStatus").textContent=String(d.status||"configured").toUpperCase();$("#warCopy").textContent=d.draft_id?"Draft "+d.draft_id:"Draft connected";$("#pickCount").textContent=state.picks.length+" picks";if(!state.picks.length){$("#draftBoard").innerHTML='<div class="empty">Draft connected. Picks will populate here when Sleeper reports them.</div>';return}const sorted=[...state.picks].sort((a,b)=>a.pick_no-b.pick_no);$("#draftBoard").innerHTML='<div class="draft-grid" style="--teams:'+teams+'">'+sorted.map(p=>'<div class="pick"><div class="num">#'+esc(p.pick_no)+' · R'+esc(p.round)+'</div><b>'+esc(p.metadata?.first_name||"")+' '+esc(p.metadata?.last_name||p.player_id||"Player")+'</b><small>'+esc(p.metadata?.position||"")+(p.metadata?.team?" · "+esc(p.metadata.team):"")+'</small></div>').join("")+"</div>"}async function sync(){status(false,"SYNCING");try{const data=await Promise.all([get("/league/"+LEAGUE_ID),get("/league/"+LEAGUE_ID+"/users"),get("/league/"+LEAGUE_ID+"/rosters"),get("/league/"+LEAGUE_ID+"/drafts")]);state.league=data[0];state.users=data[1]||[];state.rosters=data[2]||[];state.drafts=data[3]||[];state.draft=state.drafts[0]||null;state.picks=state.draft?.draft_id?await get("/draft/"+state.draft.draft_id+"/picks").catch(()=>[]):[];renderLeague();renderDraft();status(true,"SLEEPER LIVE")}catch(e){console.error(e);status(false,"OFFLINE");$("#leagueSubtitle").textContent="Could not reach Sleeper. Retry when the public API is available."}}$("#refresh").addEventListener("click",sync);sync();setInterval(sync,60000);

$(".archive-tab").forEach(b=>b.addEventListener("click",()=>{$(".archive-tab").forEach(x=>x.classList.toggle("active",x===b));const map={record:"recordView",seasons:"seasonsView",highlights:"highlightsView",drafts:"draftsView",rivalries:"rivalriesView"};$(".archive-view").forEach(x=>x.classList.toggle("active",x.id===map[b.dataset.archiveView]))}));
function pts(r,key){return Number(r?.settings?.[key]||0)+Number(r?.settings?.[key+"_decimal"]||0)/100}
function managerName(users,id){const u=users.find(x=>x.user_id===id);return u?.metadata?.team_name||u?.display_name||u?.username||"Unknown Manager"}
async function loadHistory(){
 $("#historyStatus").textContent="Loading linked league history…";
 try{
  const seasons=[];let league=state.league,guard=0;
  while(league&&guard<20){
   const id=league.league_id||LEAGUE_ID;
   const [users,rosters]=await Promise.all([get("/league/"+id+"/users"),get("/league/"+id+"/rosters")]);
   const [drafts,winners]=await Promise.all([get("/league/"+id+"/drafts").catch(()=>[]),get("/league/"+id+"/winners_bracket").catch(()=>[])]);seasons.push({league,users:users||[],rosters:rosters||[],drafts:drafts||[],winners:winners||[],matchups:[]});
   const prev=league.previous_league_id;
   if(!prev||prev==="0")break;
   league=await get("/league/"+prev);guard++;
  }
  state.history=seasons;renderHistory();await loadDeepHistory();
 }catch(e){console.error(e);$("#historyStatus").textContent="History could not be fully loaded from Sleeper."}
}
function renderHistory(){
 const seasons=state.history;
 if(!seasons.length){$("#historyStatus").textContent="No linked seasons found.";return}
 $("#historyStatus").textContent=seasons.length+" linked season"+(seasons.length===1?"":"s")+" verified through Sleeper.";
 const years=seasons.map(s=>s.league.season).filter(Boolean);
 $("#historySpan").textContent=years.length?(years[years.length-1]+"–"+years[0]):"Linked seasons";
 const all=new Map();
 seasons.forEach(s=>s.rosters.forEach(r=>{if(!r.owner_id)return;const key=r.owner_id,name=managerName(s.users,key),x=all.get(key)||{name,seasons:0,w:0,l:0,t:0,pf:0,pa:0};x.name=name;x.seasons++;x.w+=Number(r.settings?.wins||0);x.l+=Number(r.settings?.losses||0);x.t+=Number(r.settings?.ties||0);x.pf+=pts(r,"fpts");x.pa+=pts(r,"fpts_against");all.set(key,x)}));
 const rows=[...all.entries()].map(([id,x])=>{const p=state.postseason?.get(id);return {...x,id,titles:p?.titles||0,finals:p?.finals||0,playoffs:p?.playoffs||0,pct:(x.w+x.l+x.t)?(x.w+.5*x.t)/(x.w+x.l+x.t):0}}).sort((a,b)=>b.titles-a.titles||b.pct-a.pct||b.w-a.w||b.pf-a.pf);
 $("#recordBody").innerHTML=rows.map(x=>"<tr><td>"+esc(x.name)+(x.titles?" · 🏆"+x.titles:"")+"</td><td>"+x.seasons+"</td><td>"+x.w+"</td><td>"+x.l+"</td><td>"+x.t+"</td><td>"+(x.pct*100).toFixed(1)+"%</td><td>"+x.pf.toFixed(1)+"</td><td>"+x.pa.toFixed(1)+"</td></tr>").join("");
 $("#seasonArchive").innerHTML=seasons.map(s=>{const standings=s.rosters.filter(r=>r.owner_id).map(r=>({name:managerName(s.users,r.owner_id),w:Number(r.settings?.wins||0),l:Number(r.settings?.losses||0),t:Number(r.settings?.ties||0),pf:pts(r,"fpts")})).sort((a,b)=>(b.w-a.w)||(a.l-b.l)||(b.pf-a.pf));return '<article class="season-sheet"><div class="season-title"><h2>'+esc(s.league.season||"Season")+'</h2><span>'+esc(s.league.name||"LeFantasy Basketball")+'</span></div><div class="season-standings">'+standings.map((x,i)=>'<div class="standing-row"><span class="standing-rank">'+(i+1)+'</span><div class="standing-name"><b>'+esc(x.name)+'</b><small>FINAL / STORED RECORD</small></div><span class="standing-record">'+x.w+"–"+x.l+(x.t?"–"+x.t:"")+'</span><span class="standing-pf">'+x.pf.toFixed(1)+" PF</span></div>").join("")+"</div></article>"}).join("");
}
loadHistory();
async function loadDeepHistory(){
 const weekly=[];
 for(const s of state.history){
  const weeks=Math.min(Number(s.league.settings?.playoff_week_start||19)-1,30);
  const calls=[];
  for(let w=1;w<=weeks;w++)calls.push(get("/league/"+s.league.league_id+"/matchups/"+w).then(rows=>({w,rows})).catch(()=>({w,rows:[]})));
  const data=await Promise.all(calls);
  s.matchups=data;
  data.forEach(({w,rows})=>{const groups=new Map();rows.forEach(r=>{if(!r.matchup_id)return;const a=groups.get(r.matchup_id)||[];a.push(r);groups.set(r.matchup_id,a)});groups.forEach(pair=>{if(pair.length!==2)return;pair.forEach((r,i)=>{const roster=s.rosters.find(x=>x.roster_id===r.roster_id);if(!roster?.owner_id)return;weekly.push({season:s.league.season,week:w,name:managerName(s.users,roster.owner_id),points:Number(r.points||0),opp:Number(pair[1-i].points||0)})})})});
  for(const d of s.drafts||[])d.picks=await get("/draft/"+d.draft_id+"/picks").catch(()=>[]);
 }
 renderDeepHistory(weekly);renderAnalytics();renderRivalries();renderPostseason();renderSeasonHQ();
}
function renderDeepHistory(weekly){
 const completed=weekly.filter(x=>Number.isFinite(x.points)&&Number.isFinite(x.opp)&&(x.points>0||x.opp>0));
 const hi=[...completed].sort((a,b)=>b.points-a.points)[0],lo=[...completed].filter(x=>x.points>0).sort((a,b)=>a.points-b.points)[0];
 const margins=completed.map(x=>({...x,margin:x.points-x.opp})).filter(x=>x.margin>=0);
 const blow=[...margins].sort((a,b)=>b.margin-a.margin)[0],close=[...margins].filter(x=>x.margin>0).sort((a,b)=>a.margin-b.margin)[0];
 const cards=[
  ["HIGHEST WEEK",hi?hi.points.toFixed(1):"—",hi?.name,hi?hi.season+" · Week "+hi.week:"No verified matchup"],
  ["LOWEST WEEK",lo?lo.points.toFixed(1):"—",lo?.name,lo?lo.season+" · Week "+lo.week:"No verified matchup"],
  ["BIGGEST WIN",blow?blow.margin.toFixed(1)+" pts":"—",blow?.name,blow?blow.season+" · Week "+blow.week:"No verified matchup"],
  ["CLOSEST WIN",close?close.margin.toFixed(1)+" pts":"—",close?.name,close?close.season+" · Week "+close.week:"No verified matchup"]
 ];
 $("#recordCards").innerHTML=cards.map(x=>'<article class="record-card"><small>'+x[0]+'</small><strong>'+esc(x[1])+'</strong><b>'+esc(x[2]||"Not available")+'</b><span>'+esc(x[3])+'</span></article>').join("");
 const draftSeasons=state.history.filter(s=>(s.drafts||[]).some(d=>(d.picks||[]).length));
 $("#draftArchive").innerHTML=draftSeasons.length?draftSeasons.map(s=>{const ds=s.drafts.filter(d=>(d.picks||[]).length);return ds.map(d=>'<article class="draft-season"><div class="draft-season-head"><h3>'+esc(s.league.season||"Season")+' Draft</h3><span>'+d.picks.length+' verified picks · '+esc(d.type||"draft")+'</span></div><div class="draft-picks">'+[...d.picks].sort((a,b)=>a.pick_no-b.pick_no).map(p=>{const who=p.picked_by?managerName(s.users,p.picked_by):"Unknown";return '<div class="historic-pick"><small>#'+esc(p.pick_no)+' · ROUND '+esc(p.round)+'</small><b>'+esc((p.metadata?.first_name||"")+" "+(p.metadata?.last_name||p.player_id||"Player"))+'</b><span>'+esc(who)+(p.metadata?.position?" · "+esc(p.metadata.position):"")+'</span></div>'}).join("")+'</div></article>').join("")}).join(""):'<div class="empty">No historical Sleeper draft picks were returned for the linked seasons.</div>';
}
function renderAnalytics(){
 const current=state.history.find(s=>String(s.league.league_id)===String(LEAGUE_ID))||state.history[0];
 if(!current||!current.matchups?.length)return;
 const teams=new Map();
 current.rosters.filter(r=>r.owner_id).forEach(r=>teams.set(r.roster_id,{id:r.roster_id,name:managerName(current.users,r.owner_id),aw:0,al:0,at:0,tw:0,tl:0,tt:0,pf:0,weeks:0}));
 let latest=0,latestRows=[];
 current.matchups.forEach(({w,rows})=>{
  const valid=rows.filter(r=>teams.has(r.roster_id)&&Number(r.points)>0);
  if(valid.length<2)return;
  latest=Math.max(latest,w);if(w===latest)latestRows=valid;
  const scores=valid.map(r=>Number(r.points));
  valid.forEach(r=>{const t=teams.get(r.roster_id),p=Number(r.points);t.pf+=p;t.weeks++;scores.forEach((q,i)=>{if(valid[i].roster_id===r.roster_id)return;if(p>q)t.tw++;else if(p<q)t.tl++;else t.tt++})});
  const groups=new Map();valid.forEach(r=>{if(!r.matchup_id)return;const a=groups.get(r.matchup_id)||[];a.push(r);groups.set(r.matchup_id,a)});groups.forEach(pair=>{if(pair.length!==2)return;const a=teams.get(pair[0].roster_id),b=teams.get(pair[1].roster_id),pa=Number(pair[0].points),pb=Number(pair[1].points);if(pa>pb){a.aw++;b.al++}else if(pb>pa){b.aw++;a.al++}else{a.at++;b.at++}});
 });
 const arr=[...teams.values()].map(t=>{const actualGames=t.aw+t.al+t.at,trueGames=t.tw+t.tl+t.tt,truePct=trueGames?(t.tw+.5*t.tt)/trueGames:0,expected=actualGames*truePct,luck=t.aw+.5*t.at-expected;return {...t,truePct,luck}}).sort((a,b)=>b.truePct-a.truePct||b.pf-a.pf);
 $("#trueWeekLabel").textContent=latest?"Through Week "+latest:"Waiting for completed matchups";
 $("#trueBody").innerHTML=arr.length?arr.map(t=>'<tr><td>'+esc(t.name)+'</td><td>'+t.aw+"–"+t.al+(t.at?"–"+t.at:"")+'</td><td>'+t.tw+"–"+t.tl+(t.tt?"–"+t.tt:"")+'</td><td>'+(t.truePct*100).toFixed(1)+'%</td><td class="'+(t.luck>0.05?"luck-pos":t.luck<-.05?"luck-neg":"")+'">'+(t.luck>=0?"+":"")+t.luck.toFixed(1)+'</td><td>'+t.pf.toFixed(1)+'</td></tr>').join(""):'<tr><td colspan="6">No completed matchup weeks yet.</td></tr>';
 if(!latestRows.length){$("#weeklyAwards").innerHTML='<div class="empty">Awards begin after the first completed matchup week.</div>';return}
 $("#awardWeek").textContent="Week "+latest;
 const ranked=[...latestRows].sort((a,b)=>Number(b.points)-Number(a.points)),high=ranked[0],low=ranked[ranked.length-1];
 const nm=r=>{const ro=current.rosters.find(x=>x.roster_id===r.roster_id);return ro?managerName(current.users,ro.owner_id):"Unknown"};
 const groups=new Map();latestRows.forEach(r=>{if(!r.matchup_id)return;const a=groups.get(r.matchup_id)||[];a.push(r);groups.set(r.matchup_id,a)});
 const games=[...groups.values()].filter(x=>x.length===2).map(pair=>({pair,margin:Math.abs(Number(pair[0].points)-Number(pair[1].points))})).sort((a,b)=>a.margin-b.margin);
 const close=games[0],blow=games[games.length-1];
 const winner=g=>g?g.pair.slice().sort((a,b)=>Number(b.points)-Number(a.points))[0]:null;
 const awards=[
  ["TEAM OF THE WEEK","The Headliner",nm(high),Number(high.points).toFixed(1)+" pts","Highest score of the week."],
  ["THE GARBAGE FIRE","Rough Edition",nm(low),Number(low.points).toFixed(1)+" pts","Lowest score of the completed week."],
  ["THE HEARTBREAKER","Photo Finish",close?nm(winner(close)):"—",close?close.margin.toFixed(1)+" pts":"—","Narrowest winning margin."],
  ["THE STATEMENT","No Doubt About It",blow?nm(winner(blow)):"—",blow?blow.margin.toFixed(1)+" pts":"—","Largest winning margin."]
 ];
 $("#weeklyAwards").innerHTML=awards.map(a=>'<article class="award"><small>'+a[0]+'</small><h3>'+a[1]+'</h3><b>'+esc(a[2])+'</b><div class="award-stat">'+esc(a[3])+'</div><p>'+a[4]+'</p></article>').join("");
}
function renderRivalries(){
 const ledger=new Map();
 state.history.forEach(s=>(s.matchups||[]).forEach(({w,rows})=>{
  const groups=new Map();rows.filter(r=>Number(r.points)>0).forEach(r=>{if(!r.matchup_id)return;const a=groups.get(r.matchup_id)||[];a.push(r);groups.set(r.matchup_id,a)});
  groups.forEach(pair=>{
   if(pair.length!==2)return;
   const ra=s.rosters.find(r=>r.roster_id===pair[0].roster_id),rb=s.rosters.find(r=>r.roster_id===pair[1].roster_id);
   if(!ra?.owner_id||!rb?.owner_id||ra.owner_id===rb.owner_id)return;
   const ids=[ra.owner_id,rb.owner_id].sort(),key=ids.join("|"),x=ledger.get(key)||{ids,games:[],wins:{},ties:0,pf:{}};
   const pa=Number(pair[0].points),pb=Number(pair[1].points),oa=ra.owner_id,ob=rb.owner_id;
   x.pf[oa]=(x.pf[oa]||0)+pa;x.pf[ob]=(x.pf[ob]||0)+pb;
   if(pa>pb)x.wins[oa]=(x.wins[oa]||0)+1;else if(pb>pa)x.wins[ob]=(x.wins[ob]||0)+1;else x.ties++;
   x.games.push({season:s.league.season,week:w,a:oa,b:ob,pa,pb,margin:Math.abs(pa-pb)});
   ledger.set(key,x);
  });
 }));
 const currentNames=new Map();state.history.forEach(s=>s.users.forEach(u=>{if(!currentNames.has(u.user_id)||String(s.league.league_id)===String(LEAGUE_ID))currentNames.set(u.user_id,u.metadata?.team_name||u.display_name||u.username||"Manager")}));
 const cards=[...ledger.values()].filter(x=>x.games.length).sort((a,b)=>b.games.length-a.games.length||Math.abs((b.wins[b.ids[0]]||0)-(b.wins[b.ids[1]]||0))-Math.abs((a.wins[a.ids[0]]||0)-(a.wins[a.ids[1]]||0)));
 $("#rivalryGrid").innerHTML=cards.length?cards.map(x=>{
  const [a,b]=x.ids,an=currentNames.get(a)||"Manager",bn=currentNames.get(b)||"Manager",aw=x.wins[a]||0,bw=x.wins[b]||0;
  const closest=[...x.games].sort((p,q)=>p.margin-q.margin)[0],biggest=[...x.games].sort((p,q)=>q.margin-p.margin)[0],latest=[...x.games].sort((p,q)=>Number(q.season)-Number(p.season)||q.week-p.week)[0];
  const latestWinner=latest.pa===latest.pb?"Tie":(latest.pa>latest.pb?(latest.a===a?an:bn):(latest.b===a?an:bn));
  return '<article class="rivalry-card"><small>'+x.games.length+' VERIFIED MEETINGS</small><div class="rivalry-title"><b>'+esc(an)+'</b><span>vs.</span><b>'+esc(bn)+'</b></div><div class="rivalry-score"><strong>'+aw+'</strong><span>H2H'+(x.ties?" · "+x.ties+" TIE"+(x.ties===1?"":"S"):"")+'</span><strong>'+bw+'</strong></div><div class="rivalry-meta"><div><small>TOTAL POINTS</small><b>'+Number(x.pf[a]||0).toFixed(1)+'–'+Number(x.pf[b]||0).toFixed(1)+'</b></div><div><small>CLOSEST GAME</small><b>'+closest.margin.toFixed(1)+' pts</b></div><div><small>BIGGEST WIN</small><b>'+biggest.margin.toFixed(1)+' pts</b></div><div><small>LATEST</small><b>'+esc(latest.season)+' · Wk '+latest.week+'</b></div><div><small>LATEST WINNER</small><b>'+esc(latestWinner)+'</b></div><div><small>AVG MARGIN</small><b>'+(x.games.reduce((n,g)=>n+g.margin,0)/x.games.length).toFixed(1)+' pts</b></div></div></article>';
 }).join(""):'<div class="empty">No verified historical head-to-head matchups were returned yet.</div>';
}
$("#managerBack").addEventListener("click",()=>route("league"));
function openManager(id){
 const currentUser=state.users.find(u=>u.user_id===id),currentRoster=state.rosters.find(r=>r.owner_id===id);
 const appearances=[];
 state.history.forEach(s=>{const r=s.rosters.find(x=>x.owner_id===id);if(r)appearances.push({s,r})});
 if(!currentUser&&!appearances.length)return;
 const fallback=appearances[0]?.s.users.find(u=>u.user_id===id),u=currentUser||fallback||{},name=u.metadata?.team_name||u.display_name||u.username||managerName(appearances[0]?.s.users||[],id),img=avatar(u);
 const career=appearances.reduce((a,x)=>{a.w+=Number(x.r.settings?.wins||0);a.l+=Number(x.r.settings?.losses||0);a.t+=Number(x.r.settings?.ties||0);a.pf+=pts(x.r,"fpts");a.pa+=pts(x.r,"fpts_against");return a},{w:0,l:0,t:0,pf:0,pa:0});
 const weeks=[],rivals=new Map();
 appearances.forEach(({s,r})=>(s.matchups||[]).forEach(({w,rows})=>{const me=rows.find(x=>x.roster_id===r.roster_id);if(!me||Number(me.points)<=0||!me.matchup_id)return;const opp=rows.find(x=>x.matchup_id===me.matchup_id&&x.roster_id!==me.roster_id);if(!opp)return;const or=s.rosters.find(x=>x.roster_id===opp.roster_id);if(!or?.owner_id)return;const mp=Number(me.points),op=Number(opp.points);weeks.push({season:s.league.season,week:w,points:mp,opp:op,oppId:or.owner_id,oppName:managerName(s.users,or.owner_id)});const z=rivals.get(or.owner_id)||{name:managerName(s.users,or.owner_id),w:0,l:0,t:0,pf:0,pa:0,g:0};z.g++;z.pf+=mp;z.pa+=op;if(mp>op)z.w++;else if(mp<op)z.l++;else z.t++;z.name=managerName(s.users,or.owner_id);rivals.set(or.owner_id,z)}));
 const pct=career.w+career.l+career.t?(career.w+.5*career.t)/(career.w+career.l+career.t):0,best=[...weeks].sort((a,b)=>b.points-a.points)[0],worst=[...weeks].filter(x=>x.points>0).sort((a,b)=>a.points-b.points)[0],big=[...weeks].filter(x=>x.points>x.opp).sort((a,b)=>(b.points-b.opp)-(a.points-a.opp))[0],heart=[...weeks].filter(x=>x.points<x.opp).sort((a,b)=>(a.opp-a.points)-(b.opp-b.points))[0];
 const seasons=appearances.sort((a,b)=>Number(b.s.league.season)-Number(a.s.league.season));const post=appearances.map(({s,r})=>({season:s.league.season,result:playoffResult(s,r.roster_id)})).filter(x=>x.result),titles=post.filter(x=>x.result==="Champion").length,finals=post.filter(x=>x.result==="Champion"||x.result==="Runner-up").length;
 const rivalryRows=[...rivals.values()].sort((a,b)=>b.g-a.g);
 $("#managerProfile").innerHTML='<div class="profile-hero"><div class="profile-id">'+(img?'<img src="'+img+'" alt="">':'')+'<div><div class="eyebrow">MANAGER FILE · LEFANTASY ARCHIVES</div><h1>'+esc(name)+'</h1><p>@'+esc(u.username||u.display_name||"sleeper")+' · '+appearances.length+' verified season'+(appearances.length===1?"":"s")+'</p></div></div><aside class="profile-current"><small>CURRENT ROSTER</small><strong>ROSTER '+esc(currentRoster?.roster_id||"—")+'</strong><span>'+(currentRoster?.players?.length||0)+' players currently listed by Sleeper</span></aside></div><div class="profile-stats">'+[
 ["CAREER RECORD",career.w+"–"+career.l+(career.t?"–"+career.t:"")],["WIN RATE",(pct*100).toFixed(1)+"%"],["CAREER PF",career.pf.toFixed(1)],["BEST WEEK",best?best.points.toFixed(1):"—"],["SEASONS",appearances.length],["TITLES",titles],["FINALS",finals]
 ].map(x=>'<div class="profile-stat"><small>'+x[0]+'</small><strong>'+x[1]+'</strong></div>').join("")+'</div><div class="profile-columns"><div><section class="profile-section"><div class="kicker">YEAR BY YEAR</div><h2>Season Résumé</h2>'+seasons.map(({s,r})=>'<div class="resume-row"><span>'+esc(s.league.season)+'</span><div><b>'+Number(r.settings?.wins||0)+'–'+Number(r.settings?.losses||0)+(Number(r.settings?.ties||0)?"–"+Number(r.settings.ties):"")+'</b><small>'+pts(r,"fpts").toFixed(1)+' PF · '+pts(r,"fpts_against").toFixed(1)+' PA</small></div><small>'+esc(playoffResult(s,r.roster_id)||s.league.name||"LeFantasy")+'</small></div>').join("")+'</section><section class="profile-section"><div class="kicker">PERSONAL RECORDS</div><h2>Highs & Lows</h2><div class="profile-week-grid">'+[
 ["BEST WEEK",best,best?.points],["LOWEST WEEK",worst,worst?.points],["BIGGEST WIN",big,big?(big.points-big.opp):null],["TOUGHEST LOSS",heart,heart?(heart.opp-heart.points):null]
 ].map(([label,x,val])=>'<div class="profile-week"><small>'+label+'</small><strong>'+(val==null?"—":Number(val).toFixed(1)+(label.includes("WIN")||label.includes("LOSS")?" pts":""))+'</strong><span>'+(x?esc(x.season)+" · Week "+x.week+" · vs "+esc(x.oppName):"No verified result")+'</span></div>').join("")+'</div></section></div><section class="profile-section"><div class="kicker">HEAD TO HEAD</div><h2>Rivalry Ledger</h2>'+(rivalryRows.length?rivalryRows.map(x=>'<div class="profile-rival"><div><b>'+esc(x.name)+'</b><small>'+x.g+' meeting'+(x.g===1?"":"s")+' · '+x.pf.toFixed(1)+' PF</small></div><span>'+x.w+'–'+x.l+(x.t?"–"+x.t:"")+'</span></div>').join(""):'<div class="empty">No verified rivalries yet.</div>')+'</section></div>';
 route("manager");
}
function playoffResult(s,rosterId){
 const b=s.winners||[];if(!b.length)return null;
 const involved=b.filter(g=>g.t1===rosterId||g.t2===rosterId);
 if(!involved.length)return null;
 const finals=b.filter(g=>g.p===1||g.p===2).sort((a,b)=>(b.r||0)-(a.r||0));
 const title=finals.find(g=>g.p===1);
 if(title&&(title.t1===rosterId||title.t2===rosterId)){if(title.w===rosterId)return "Champion";if(title.l===rosterId)return "Runner-up"}
 const place=b.filter(g=>g.p&&g.w===rosterId).sort((a,b)=>a.p-b.p)[0];
 return place?"Finished "+place.p+(place.p===3?"rd":place.p===2?"nd":"th"):"Playoffs";
}
function renderPostseason(){
 const totals=new Map();
 state.history.forEach(s=>s.rosters.filter(r=>r.owner_id).forEach(r=>{const res=playoffResult(s,r.roster_id);if(!res)return;const x=totals.get(r.owner_id)||{name:managerName(s.users,r.owner_id),titles:0,finals:0,playoffs:0};x.name=managerName(s.users,r.owner_id);x.playoffs++;if(res==="Champion"){x.titles++;x.finals++}else if(res==="Runner-up")x.finals++;totals.set(r.owner_id,x)}));
 state.postseason=totals;
 renderHistory();
}
function renderSeasonHQ(){
 const s=state.history.find(x=>String(x.league.league_id)===String(LEAGUE_ID))||state.history[0];if(!s)return;
 const standings=s.rosters.filter(r=>r.owner_id).map(r=>({r,name:managerName(s.users,r.owner_id),w:Number(r.settings?.wins||0),l:Number(r.settings?.losses||0),t:Number(r.settings?.ties||0),pf:pts(r,"fpts"),pa:pts(r,"fpts_against")})).sort((a,b)=>b.w-a.w||a.l-b.l||b.pf-a.pf);
 $("#liveStandings").innerHTML=standings.map((x,i)=>'<div class="live-row"><span class="seed">'+(i+1)+'</span><div><b>'+esc(x.name)+'</b><small>'+x.pf.toFixed(1)+' PF · '+x.pa.toFixed(1)+' PA</small></div><span>'+x.w+"–"+x.l+(x.t?"–"+x.t:"")+'</span><span>'+((x.w+x.l+x.t)?((x.w+.5*x.t)/(x.w+x.l+x.t)*100).toFixed(0):"0")+'%</span></div>').join("")||'<div class="empty">Standings will appear when rosters are active.</div>';
 const playoffTeams=Number(s.league.settings?.playoff_teams||s.league.settings?.playoff_team_count||0);
 $("#playoffMeta").textContent=playoffTeams?playoffTeams+" playoff spots":"Playoff field not exposed yet";
 $("#playoffRace").innerHTML=standings.map((x,i)=>'<div class="race-row '+(playoffTeams&&i<playoffTeams?"in ":"")+(playoffTeams&&i===playoffTeams?"cut":"")+'"><span class="seed">'+(i+1)+'</span><div><b>'+esc(x.name)+'</b><small>'+x.pf.toFixed(1)+' points scored</small></div><span>'+x.w+"–"+x.l+'</span><span class="race-tag">'+(playoffTeams?(i<playoffTeams?"IN":i===playoffTeams?"CUT LINE":"OUT"):"—")+'</span></div>').join("");
 const scored=(s.matchups||[]).filter(x=>x.rows.some(r=>Number(r.points)>0));let week=scored.length?Math.max(...scored.map(x=>x.w)):0;
 if(!week){$("#seasonWeek").textContent=String(s.league.status||"preseason").toUpperCase();$("#matchupGrid").innerHTML='<div class="empty">No scored matchup week has been returned by Sleeper yet. Season HQ is ready for opening week.</div>';return}
 const entry=s.matchups.find(x=>x.w===week),groups=new Map();(entry?.rows||[]).forEach(r=>{if(!r.matchup_id)return;const a=groups.get(r.matchup_id)||[];a.push(r);groups.set(r.matchup_id,a)});
 $("#seasonWeek").textContent="Week "+week;$("#matchupHeading").textContent="Week "+week+" Matchup Desk";
 const games=[...groups.values()].filter(x=>x.length===2);
 $("#matchupGrid").innerHTML=games.length?games.map((pair,i)=>{const sides=pair.map(r=>{const ro=s.rosters.find(x=>x.roster_id===r.roster_id);return {name:ro?managerName(s.users,ro.owner_id):"Unknown",points:Number(r.points||0)}}).sort((a,b)=>b.points-a.points);return '<article class="matchup-card"><small>GAME '+String(i+1).padStart(2,"0")+'</small>'+sides.map((x,j)=>'<div class="matchup-side"><b>'+esc(x.name)+(j===0&&x.points!==sides[1].points?" · LEADS":"")+'</b><span>'+x.points.toFixed(1)+'</span></div>').join("")+'</article>'}).join(""):'<div class="empty">Sleeper returned Week '+week+' scores but no paired matchups yet.</div>';
}