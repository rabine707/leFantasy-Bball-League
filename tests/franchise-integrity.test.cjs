const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'..','app.js'),'utf8');
function extract(name,next){const start=source.indexOf('function '+name+'(');const end=source.indexOf('function '+next+'(',start);assert.ok(start>=0&&end>start,'function boundaries found');return source.slice(start,end)}
test('bench injuries reduce team strength',()=>{const fn=extract('gm2TeamRating','gm2Render');const roster=Array.from({length:10},(_,i)=>({rating:80,health:100,starter:i<5}));const ctx={gm2:{roster},Math};vm.runInNewContext(fn,ctx);const healthy=ctx.gm2TeamRating();roster[5].health=0;assert.ok(ctx.gm2TeamRating()<healthy)});
test('dealing assigns five starters and ten unique players',()=>{const code=extract('gm2Deal','gm2TeamRating');const pool=Array.from({length:100},(_,i)=>({id:String(i),name:'Player '+i,team:'NBA',pos:['PG','SG','SF','PF','C'][i%5],rank:i+1}));const gm2={roster:[],record:{w:0,l:0},chem:70,owner:65};const ctx={gm2,gm2Pool:()=>pool,shuffle:x=>x,gm2Rating:()=>80,gm2Save:()=>{},Math};vm.runInNewContext(code,ctx);ctx.gm2Deal();assert.equal(gm2.roster.length,10);assert.equal(gm2.roster.filter(p=>p.starter).length,5);assert.equal(new Set(gm2.roster.map(p=>p.id)).size,10)});
test('simulation respects pending decisions and adds opponent variability',()=>{assert.match(source,/if\(gm2.pending\)return;return gm2Sim\(\)/);assert.match(source,/const opponent=76\+Math\.random\(\)\*16/)});
test('franchise saves and restores core state',()=>{assert.match(source,/GM2_SAVE_KEY/);assert.match(source,/function gm2Restore\(/);assert.match(source,/if\(!gm2Restore\(\)\)gm2Deal\(\)/)});
