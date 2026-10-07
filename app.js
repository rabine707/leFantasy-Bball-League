const LEAGUE_ID="1406415989997846528",API="https://api.sleeper.app/v1";const state={league:null,users:[],rosters:[],drafts:[],draft:null,picks:[],history:[]};const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));async function get(path){const r=await fetch(API+path);if(!r.ok)throw Error("Sleeper "+r.status);return r.json()}function route(n){$$(".page").forEach(x=>x.classList.toggle("active",x.dataset.page===n));$$("[data-route]").forEach(x=>x.classList.toggle("active",x.dataset.route===n));scrollTo({top:0,behavior:"smooth"})}$$("[data-route]").forEach(b=>b.addEventListener("click",()=>route(b.dataset.route)));function avatar(u){return u&&u.avatar?"https://sleepercdn.com/avatars/thumbs/"+u.avatar:""}function rosterFor(id){return state.rosters.find(r=>r.owner_id===id)}function status(ok,label){const e=$("#apiStatus");e.classList.toggle("online",ok);e.classList.toggle("offline",!ok);e.querySelector("span").textContent=label}function renderLeague(){const l=state.league||{},name=l.name||"LeFantasy Basketball";$("#leagueSubtitle").textContent=name+" · Live league data from Sleeper";$("#teamCount").textContent=l.total_rosters||state.users.length||"—";$("#rosterCount").textContent=state.rosters.length||"—";const filled=state.rosters.filter(r=>r.owner_id).length;const cards=[["LEAGUE",name,(l.season||"2026")+" season · "+(l.status||"preseason")],["MANAGERS",state.users.length+" connected",filled+" occupied rosters"],["DRAFT",state.draft?String(state.draft.status||"configured").toUpperCase():"NOT FOUND",state.draft?String(state.draft.settings?.teams||l.total_rosters||"—")+" teams · "+(state.draft.type||"draft"):"No draft returned yet"]];$("#pulse").innerHTML=cards.map(x=>'<article class="card"><small>'+esc(x[0])+'</small><strong>'+esc(x[1])+'</strong><p>'+esc(x[2])+'</p></article>').join("");$("#managerGrid").innerHTML=state.users.map(u=>{const r=rosterFor(u.user_id),display=u.metadata?.team_name||u.display_name||u.username||"Manager",img=avatar(u);return '<article class="manager">'+(img?'<img src="'+img+'" alt="">':"")+'<h3>'+esc(display)+'</h3><p>@'+esc(u.username||u.display_name||"sleeper")+'</p><div class="roster">Roster '+esc(r?.roster_id||"—")+' · '+(r?.players?.length||0)+' players</div></article>'}).join("")||'<div class="empty">No managers returned.</div>';$("#lastSync").textContent="Synced "+new Date().toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}function renderDraft(){const d=state.draft;if(!d){$("#draftStatus").textContent="NOT FOUND";$("#draftMeta").textContent="Sleeper has not returned a draft for this league.";$("#warStatus").textContent="WAITING";$("#warCopy").textContent="No draft configuration is available yet.";return}const teams=d.settings?.teams||state.league?.total_rosters||10;$("#draftStatus").textContent=String(d.status||"configured").toUpperCase();$("#draftMeta").textContent=teams+" teams · "+(d.type||"draft")+" · "+(d.settings?.rounds||"—")+" rounds";$("#warStatus").textContent=String(d.status||"configured").toUpperCase();$("#warCopy").textContent=d.draft_id?"Draft "+d.draft_id:"Draft connected";$("#pickCount").textContent=state.picks.length+" picks";if(!state.picks.length){$("#draftBoard").innerHTML='<div class="empty">Draft connected. Picks will populate here when Sleeper reports them.</div>';return}const sorted=[...state.picks].sort((a,b)=>a.pick_no-b.pick_no);$("#draftBoard").innerHTML='<div class="draft-grid" style="--teams:'+teams+'">'+sorted.map(p=>'<div class="pick"><div class="num">#'+esc(p.pick_no)+' · R'+esc(p.round)+'</div><b>'+esc(p.metadata?.first_name||"")+' '+esc(p.metadata?.last_name||p.player_id||"Player")+'</b><small>'+esc(p.metadata?.position||"")+(p.metadata?.team?" · "+esc(p.metadata.team):"")+'</small></div>').join("")+"</div>"}async function sync(){status(false,"SYNCING");try{const data=await Promise.all([get("/league/"+LEAGUE_ID),get("/league/"+LEAGUE_ID+"/users"),get("/league/"+LEAGUE_ID+"/rosters"),get("/league/"+LEAGUE_ID+"/drafts")]);state.league=data[0];state.users=data[1]||[];state.rosters=data[2]||[];state.drafts=data[3]||[];state.draft=state.drafts[0]||null;state.picks=state.draft?.draft_id?await get("/draft/"+state.draft.draft_id+"/picks").catch(()=>[]):[];renderLeague();renderDraft();status(true,"SLEEPER LIVE")}catch(e){console.error(e);status(false,"OFFLINE");$("#leagueSubtitle").textContent="Could not reach Sleeper. Retry when the public API is available."}}$("#refresh").addEventListener("click",sync);sync();setInterval(sync,60000);

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
   const drafts=await get("/league/"+id+"/drafts").catch(()=>[]);seasons.push({league,users:users||[],rosters:rosters||[],drafts:drafts||[],matchups:[]});
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
 const rows=[...all.values()].map(x=>({...x,pct:(x.w+x.l+x.t)?(x.w+.5*x.t)/(x.w+x.l+x.t):0})).sort((a,b)=>b.pct-a.pct||b.w-a.w||b.pf-a.pf);
 $("#recordBody").innerHTML=rows.map(x=>"<tr><td>"+esc(x.name)+"</td><td>"+x.seasons+"</td><td>"+x.w+"</td><td>"+x.l+"</td><td>"+x.t+"</td><td>"+(x.pct*100).toFixed(1)+"%</td><td>"+x.pf.toFixed(1)+"</td><td>"+x.pa.toFixed(1)+"</td></tr>").join("");
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
 renderDeepHistory(weekly);renderAnalytics();renderRivalries();
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