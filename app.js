import { PLAYERS, PRE, LIVE, CHALLENGES, SOUNDS } from './data.js?v=11';

/* ============ config ============ */
const SB_URL = 'https://idqayrdcgxcumoerxxvf.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkcWF5cmRjZ3hjdW1vZXJ4eHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwMDY3NzYsImV4cCI6MjEwNjU4Mjc3Nn0.nA0Uw-pn1nCeCt7NRNJgKrDDkvZNyTK9MZPKmXGSaHg';
const GAME_CODE = 'HELDEN';
const ADMINS = ['niels'];                                   // de quizmaster
const DEADLINE = Date.parse('2026-11-06T17:00:00+01:00');   // voorspellingen sluiten bij aankomst
const BONUS = 2;
const params = new URLSearchParams(location.search);
const MOCK = params.has('mock');
const NOWOFF = MOCK && params.get('now') ? Date.parse(params.get('now')) - Date.now() : 0;
const now = () => Date.now() + NOWOFF;
const predOpen = () => now() < DEADLINE;

/* ============ opslag ============ */
const ls = {
  get(k){ try{ return localStorage.getItem(k) }catch{ return null } },
  set(k,v){ try{ localStorage.setItem(k,v) }catch{} },
  del(k){ try{ localStorage.removeItem(k) }catch{} },
};
const iso = s => new Date(s + ':00+01:00').toISOString();

function seedQuestions(){
  let id = 0; const qs = [];
  for(const [nr,title,secret,mode,at] of PRE)
    qs.push({id:++id, kind:'pre', nr, cat:null, title, secret, mode, push_at:iso(at), status:'closed', ranker_id:null, truth:null, ts:null, sort:nr});
  let s = 100;
  for(const [cat,list] of Object.entries(LIVE)) for(const title of list)
    qs.push({id:++id, kind:'live', nr:null, cat, title, secret:null, mode:'ranker', push_at:null, status:'closed', ranker_id:null, truth:null, ts:null, sort:++s});
  CHALLENGES.forEach((title,i)=>qs.push({id:++id, kind:'challenge', nr:i+1, cat:null, title, secret:null, mode:'challenge', push_at:null, status:'closed', ranker_id:null, truth:null, ts:null, sort:200+i}));
  return qs;
}

function mockDb(){
  const KEY = 'helden_mock_v3', bc = 'BroadcastChannel' in window ? new BroadcastChannel('helden2') : null;
  let d; try{ d = JSON.parse(ls.get(KEY)) }catch{}
  if(!d) d = { players: PLAYERS.map(([id,name],i)=>({id,name,sort:i+1})), questions: seedQuestions(), answers: [], seq: 1000 };
  const subs = [];
  const save = () => { ls.set(KEY, JSON.stringify(d)); bc && bc.postMessage(1); subs.forEach(f=>f()) };
  bc && (bc.onmessage = () => { try{ d = JSON.parse(ls.get(KEY)) || d }catch{}; subs.forEach(f=>f()) });
  return {
    async load(){ return structuredClone({players:d.players, questions:d.questions, answers:d.answers}) },
    async setAnswer(a){ d.answers = d.answers.filter(x=>!(x.question_id===a.question_id && x.player_id===a.player_id && x.kind===a.kind)); d.answers.push(a); save() },
    async delAnswers(qid, kind){ d.answers = d.answers.filter(x=>!(x.question_id===qid && (!kind || x.kind===kind))); save() },
    async updateQ(id, p){ Object.assign(d.questions.find(q=>q.id===id), p); save() },
    async addQ(q){ d.questions.push({id:++d.seq, nr:null, secret:null, push_at:null, status:'closed', ranker_id:null, truth:null, ts:null, sort:999, ...q}); save() },
    subscribe(f){ subs.push(f) },
  };
}

async function supaDb(){
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
  const sb = createClient(SB_URL, SB_KEY, { auth:{ persistSession:false } });
  const chk = ({error}) => { if(error) throw new Error(error.message) };
  return {
    async load(){
      const [p,q,a] = await Promise.all([
        sb.from('helden_players').select('*').order('sort'),
        sb.from('helden_questions').select('*').order('sort').order('id'),
        sb.from('helden_answers').select('*'),
      ]);
      [p,q,a].forEach(chk);
      return {players:p.data, questions:q.data, answers:a.data};
    },
    async setAnswer(a){ chk(await sb.from('helden_answers').upsert(a)) },
    async delAnswers(qid, kind){ let r = sb.from('helden_answers').delete().eq('question_id', qid); if(kind) r = r.eq('kind', kind); chk(await r) },
    async updateQ(id, p){ chk(await sb.from('helden_questions').update(p).eq('id', id)) },
    async addQ(q){ chk(await sb.from('helden_questions').insert({sort:999, ...q})) },
    subscribe(f){
      sb.channel('helden')
        .on('postgres_changes', {event:'*', schema:'public', table:'helden_questions'}, f)
        .on('postgres_changes', {event:'*', schema:'public', table:'helden_answers'}, f)
        .subscribe();
    },
  };
}

/* ============ state ============ */
let db, S = null, loadErr = null, lastSig = '';
const ui = { tab:null, atab:null, openPlayer:null, picks:{}, editing:{}, openQ:null, truthFor:null, newLive:null, newRanker:null, customTitle:'', arm:null, busy:false, codeErr:false };
const AS = MOCK ? params.get('as') : null;   // alleen voor testen
if(AS) ls.set('helden_code', GAME_CODE);
const me = () => AS || ls.get('helden_me');
const isAdmin = () => ADMINS.includes(me());
const P = id => S.players.find(p=>p.id===id) || {id, name:id};
const Q = id => S.questions.find(q=>q.id===id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const route = () => location.hash.replace('#','') || 'speler';
const stamp = () => new Date(now()).toISOString();

async function refresh(){
  try{ S = await db.load(); loadErr = null }
  catch(e){ loadErr = e.message || String(e) }
  render();
}
let rt; const soonRefresh = () => { clearTimeout(rt); rt = setTimeout(refresh, 150) };
async function act(fn){
  if(ui.busy) return; ui.busy = true;
  try{ await fn(); await refresh() }
  catch(e){ loadErr = 'Opslaan mislukt: ' + (e.message||e); render(true) }
  finally{ ui.busy = false }
}

/* ============ spelregels ============ */
const pre = () => S.questions.filter(q=>q.kind==='pre').sort((a,b)=>a.nr-b.nr);
const live = () => S.questions.filter(q=>q.kind==='live');
const answers = (q, kind) => S.answers.filter(a=>a.question_id===q.id && a.kind===kind);
const myAnswer = (q, kind) => answers(q,kind).find(a=>a.player_id===me());
const active = () => S.questions.find(q=>q.kind!=='challenge' && (q.status==='voting' || q.status==='open'));
const challenges = () => S.questions.filter(q=>q.kind==='challenge').sort((a,b)=>a.sort-b.sort);
const CH_PTS = [3,2,1];
const lastRevealed = () => S.questions.filter(q=>q.status==='revealed').sort((a,b)=>(b.ts||'').localeCompare(a.ts||''))[0];
const progress = pid => pre().filter(q=>S.answers.some(a=>a.question_id===q.id && a.kind==='pred' && a.player_id===pid)).length;

// groepsuitslag: gemiddelde positie over alle stemmen
function groupTruth(q){
  const votes = answers(q,'vote'); if(!votes.length) return null;
  const sum = Object.fromEntries(S.players.map(p=>[p.id,0]));
  for(const v of votes) v.picks.forEach((id,i)=>{ if(id in sum) sum[id] += i });
  return S.players.slice().sort((a,b)=>sum[a.id]-sum[b.id] || a.sort-b.sort).map(p=>p.id);
}
function scoreQ(q){
  const out = {};
  if(q.status!=='revealed' || !q.truth) return out;
  if(q.kind==='challenge'){ q.truth.slice(0,3).forEach((pid,i)=>{ out[pid] = {exact:0, bonus:0, total:CH_PTS[i]} }); return out }
  for(const a of answers(q,'pred')){
    if(a.player_id === q.ranker_id) continue;
    out[a.player_id] = { exact: a.picks.filter((p,i)=>q.truth[i]===p).length, bonus:0 };
  }
  const max = Math.max(0, ...Object.values(out).map(o=>o.exact));
  if(max > 0) for(const o of Object.values(out)) if(o.exact === max) o.bonus = BONUS;
  for(const o of Object.values(out)) o.total = o.exact + o.bonus;
  return out;
}
function standings(){
  const tot = Object.fromEntries(S.players.map(p=>[p.id,0]));
  for(const q of S.questions) for(const [pid,o] of Object.entries(scoreQ(q))) if(pid in tot) tot[pid] += o.total;
  return S.players.map(p=>({p, pts:tot[p.id]})).sort((a,b)=>b.pts-a.pts || a.p.sort-b.p.sort);
}

/* ============ tijd ============ */
const fmtAt = s => { if(!s) return ''; const d = new Date(s);
  return d.toLocaleDateString('nl-NL',{weekday:'short', timeZone:'Europe/Amsterdam'}) + ' ' + d.toLocaleTimeString('nl-NL',{hour:'2-digit', minute:'2-digit', timeZone:'Europe/Amsterdam'}) };
function countdown(){
  let s = Math.max(0, Math.floor((DEADLINE - now())/1000));
  const d = Math.floor(s/86400); s %= 86400; const h = Math.floor(s/3600); s %= 3600; const m = Math.floor(s/60);
  return (d ? d+'d ' : '') + String(h).padStart(2,'0') + 'u ' + String(m).padStart(2,'0') + 'm';
}

/* ============ bouwstenen ============ */
function picker(key, prompt){
  const picks = ui.picks[key] || [];
  return `<p class="muted" style="margin:4px 0 12px">${prompt}</p>
    <div class="stack">${S.players.map(p=>{ const i = picks.indexOf(p.id);
      return `<button class="btn pick ${i>=0?'on':''}" data-pick="${esc(key)}" data-id="${p.id}">${esc(p.name)}<span class="badge">${i>=0?i+1:''}</span></button>` }).join('')}</div>
    <div class="row" style="margin-top:10px"><button class="btn ghost small" data-clear="${esc(key)}" ${picks.length?'':'disabled'}>Opnieuw</button></div>`;
}
const full = key => (ui.picks[key]||[]).length === S.players.length;
function order(list, cls='', delayStep=0){
  return `<ol class="order ${cls}">${list.map((id,i)=>`<li style="animation-delay:${((list.length-1-i)*delayStep + (delayStep?1.6:0)).toFixed(2)}s"><span class="n">${i+1}</span>${esc(P(id).name)}</li>`).join('')}</ol>`;
}
function myOrderVsTruth(picks, truth){
  return `<ol class="order">${picks.map((id,i)=>`<li><span class="n">${i+1}</span>${esc(P(id).name)}${truth?(truth[i]===id?'<span class="hit">✓</span>':'<span class="miss">✗</span>'):''}</li>`).join('')}</ol>`;
}
const scoreboard = () => standings().map((s,i)=>`<div class="score"><span class="pos">${i+1}</span><span>${esc(s.p.name)}</span><span class="pts">${s.pts}</span></div>`).join('');
const dnr = q => pre().indexOf(q) + 1;   // doorlopende nummering (13 bestaat niet meer)
const qLabel = q => q.kind==='pre' ? `Vraag ${dnr(q)}` : q.kind==='challenge' ? 'Challenge' : 'Live-ronde';

function podium(q, cls='', step=0){
  return `<ol class="order ${cls}">${q.truth.slice(0,3).map((id,i)=>`<li style="animation-delay:${((2-i)*step).toFixed(2)}s"><span class="n">${i+1}</span>${esc(P(id).name)}<span class="hit">+${CH_PTS[i]}</span></li>`).join('')}</ol>`;
}
function resultCard(q){
  if(q.kind==='challenge') return `<div class="kicker">Challenge · uitslag</div><h2>${esc(q.title)}</h2>${podium(q)}
    <p class="muted" style="margin:10px 0 0">${CH_PTS.length+1 <= S.players.length ? 'De rest: 0 punten.' : ''}${scoreQ(q)[me()] ? ` Jij: +${scoreQ(q)[me()].total}.` : ''}</p>`;
  const sc = scoreQ(q);
  const rows = Object.entries(sc).sort((a,b)=>b[1].total-a[1].total).map(([pid,o])=>
    `<div class="score"><span>${esc(P(pid).name)}${o.bonus?'<span class="tag">beste gok</span>':''}</span><span class="pts">+${o.total}</span></div>`).join('')
    || '<p class="muted">Niemand had een voorspelling.</p>';
  const mine = answers(q,'pred').find(a=>a.player_id===me());
  return `<div class="kicker">${qLabel(q)} · onthuld${q.ranker_id?` · volgens ${esc(P(q.ranker_id).name)}`:''}</div>
    <h2>${esc(q.title)}</h2>${q.secret?`<div class="secret">${esc(q.secret)}</div>`:''}
    <div class="kicker" style="margin:8px 0 4px">De uitslag</div>${order(q.truth)}
    ${mine ? `<div class="kicker" style="margin:18px 0 4px">Jouw voorspelling · ${sc[me()]?.total ?? 0} punten</div>${myOrderVsTruth(mine.picks, q.truth)}` : ''}
    <div class="kicker" style="margin:18px 0 4px">Punten</div>${rows}`;
}

/* ============ schermen: speler ============ */
function viewLogin(){
  if(ls.get('helden_code') !== GAME_CODE){
    return `<div style="margin-top:4vh" class="center">
      <img class="logo" src="de_held.jpg" alt="De Held">
      <div class="kicker">Het Heldenweekend 2026</div><h1>Ranking de Helden</h1>
      <p class="muted" style="margin-top:18px">Vul de code in.</p>
      <div class="stack" style="margin-top:20px">
        <input type="text" id="code" autocomplete="off" autocapitalize="characters" placeholder="Code">
        ${ui.codeErr?'<div class="err">Dat is niet de code.</div>':''}
        <button class="btn gold" data-act="code">Verder</button>
      </div></div>`;
  }
  return `<div style="margin-top:2vh" class="center"><img class="logo small" src="de_held.jpg" alt="De Held"><div class="kicker">Wie ben jij?</div><h1>Kies je naam</h1></div>
    <div class="stack" style="margin-top:20px">${S.players.map(p=>`<button class="btn" data-me="${p.id}">${esc(p.name)}</button>`).join('')}</div>`;
}
const header = () => `<div class="toplinks"><span class="me">${esc(P(me()).name)}</span>
  <span>${isAdmin() ? (route()==='admin' ? '<a href="#">Speler</a> · ' : '<a href="#admin">Quizmaster</a> · ') : ''}<a href="#" data-act="logout">Wissel</a></span></div>`;

function activeCard(q){
  if(q.status === 'voting'){
    const key = q.id+':vote', mine = myAnswer(q,'vote');
    const head = `<div class="kicker">${qLabel(q)} · stemming</div><h2>${esc(q.title)}</h2><div class="secret">${esc(q.secret)}</div>`;
    if(mine && !ui.editing[key]) return `<div class="card">${head}<p class="muted">Je stem staat erin. Wachten op de rest…</p>${order(mine.picks)}
      <button class="btn ghost" style="margin-top:10px" data-edit="${key}">Aanpassen</button></div>`;
    return `<div class="card">${head}${picker(key,'Wat is <b>volgens jou</b> de echte volgorde? 1 = het meest. Het gemiddelde van alle stemmen wordt de uitslag.')}
      <button class="btn gold" style="margin-top:12px" data-submit="${key}" ${full(key)?'':'disabled'}>Stem insturen</button></div>`;
  }
  // live-ronde
  const iRank = q.ranker_id === me();
  const kind = iRank ? 'vote' : 'pred', key = q.id+':'+kind, mine = myAnswer(q,kind), r = P(q.ranker_id);
  const head = `<div class="kicker">${iRank?'Live-ronde · jij rangschikt':`Live-ronde · ${esc(r.name)} rangschikt`}</div><h2>${esc(q.title)}</h2>`;
  if(mine && !ui.editing[key]) return `<div class="card">${head}<p class="muted">${iRank?'Je rangschikking staat erin.':'Je gok staat erin.'} Wachten op de onthulling…</p>${order(mine.picks)}
    <button class="btn ghost" style="margin-top:10px" data-edit="${key}">Aanpassen</button></div>`;
  const prompt = iRank ? 'Zet de groep op volgorde, jezelf ook. 1 = past het meest.' : `Hoe zet <b>${esc(r.name)}</b> de groep op volgorde? 1 = past het meest.`;
  return `<div class="card">${head}${picker(key,prompt)}
    <button class="btn gold" style="margin-top:12px" data-submit="${key}" ${full(key)?'':'disabled'}>${iRank?'Vastzetten':'Gok insturen'}</button></div>`;
}

function preEditor(q){
  const key = q.id+':pred', mine = myAnswer(q,'pred');
  const list = pre(), idx = list.indexOf(q);
  const nav = `<div class="qnav">
    <button class="qn prev" data-open="${list[idx-1]?.id ?? ''}" ${idx>0?'':'disabled'}><span class="ar">‹</span>Vorige</button>
    <button class="qn mid" data-open="">Overzicht</button>
    <button class="qn next" data-open="${list[idx+1]?.id ?? ''}" ${idx<list.length-1?'':'disabled'}>Volgende<span class="ar">›</span></button></div>`;
  if(mine && !ui.editing[key]) return `<div class="card"><div class="kicker">Vraag ${dnr(q)} van ${list.length} · ingevuld</div><h2>${esc(q.title)}</h2>
    ${order(mine.picks)}<button class="btn ghost" style="margin-top:10px" data-edit="${key}">Aanpassen</button>${nav}</div>`;
  return `<div class="card"><div class="kicker">Vraag ${dnr(q)} van ${list.length}</div><h2>${esc(q.title)}</h2>
    ${picker(key,'Zet de groep op volgorde, jezelf ook. 1 = past het meest.')}
    <button class="btn gold" style="margin-top:12px" data-submit="${key}" ${full(key)?'':'disabled'}>Vastleggen</button>${nav}</div>`;
}

function preList(){
  const open = predOpen();
  return pre().map(q=>{
    const done = !!myAnswer(q,'pred'), rev = q.status==='revealed';
    const st = rev ? `+${scoreQ(q)[me()]?.total ?? 0}` : open ? (done?'✓':'open') : 'geheim';
    const sub = rev ? `<small>${esc(q.secret)}</small>` : '';
    return `<button class="qrow ${done&&open?'done':''} ${rev?'rev':''}" data-open="${q.id}"><span class="nr">${dnr(q)}</span><span class="t">${esc(q.title)}${sub}</span><span class="st">${st}</span></button>`;
  }).join('');
}

/* ---------- tabbladen ---------- */
const ICON = {
  event: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="1"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M12 13.2v2.6M12 18.2h.01"/></svg>',
  ranking: '<svg viewBox="0 0 24 24"><path d="M5 20V12M12 20V5M19 20v-5"/><path d="M3 20h18"/></svg>',
  stand: '<svg viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/></svg>',
  challenges: '<svg viewBox="0 0 24 24"><path d="M13 3L5 13h6l-1 8 8-10h-6l1-8z"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M4 10v4h4l5 4V6L8 10H4z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
};
const TABS = [['event','Events'],['ranking','Ranking'],['stand','Stand'],['challenges','Challenges'],['sound','Soundboard']];

function needsMe(){
  const a = active(), out = {};
  if(predOpen() && progress(me()) < pre().length) out.event = true;
  if(a && a.status==='voting' && !myAnswer(a,'vote')) out.event = true;
  if(a && a.status==='open' && !myAnswer(a, a.ranker_id===me() ? 'vote' : 'pred')) out.ranking = true;
  return out;
}
function defaultTab(){
  const a = active();
  if(a) return a.kind==='pre' ? 'event' : 'ranking';
  return predOpen() ? 'event' : 'stand';
}
function tabBar(cur){
  const dot = needsMe();
  return `<nav class="tabbar">${TABS.map(([id,label])=>
    `<button class="tab ${id==='stand'?'mid':''} ${cur===id?'on':''}" data-tab="${id}" aria-label="${label}">
      <span class="ic">${ICON[id]}${dot[id]?'<i class="ping"></i>':''}</span><span class="lb">${label}</span></button>`).join('')}</nav>`;
}

function tabEvent(){
  const a = active();
  let html = '';
  if(ui.openQ){
    const q = Q(ui.openQ);
    if(q && q.kind==='pre' && q.status==='revealed') return `<div class="card">${resultCard(q)}<button class="btn ghost" style="margin-top:12px" data-open="">Terug</button></div>`;
    if(q && q.kind==='pre' && predOpen()) return preEditor(q);
    ui.openQ = null;
  }
  if(a && a.status==='voting') html += activeCard(a);
  if(predOpen()){
    const n = progress(me()), tot = pre().length;
    html += `<div class="card center"><div class="kicker">Voorspellingen sluiten over</div><div class="cnt">${countdown()}</div>
      <p class="muted" style="margin:10px 0 0">${n===tot ? 'Alles ingevuld. Aanpassen mag tot de deadline.' : 'Zet bij elke vraag de groep op volgorde. Wat de vragen betekenen, blijkt in het weekend.'}</p>
      <div class="bar"><i style="width:${Math.round(n/tot*100)}%"></i></div><div class="kicker">${n} / ${tot} ingevuld</div></div>`;
    if(n < tot){
      const next = pre().find(q=>!myAnswer(q,'pred'));
      html += `<button class="btn gold" data-open="${next.id}">${n ? 'Verder invullen' : 'Begin'}</button>`;
    }
    html += `<div style="margin-top:16px">${preList()}</div>`;
  } else {
    if(!a || a.status!=='voting') html += `<div class="center" style="margin:6px 0 4px"><div class="kicker">Event-vragen</div></div>
      <p class="center muted" style="margin:0 0 14px">Je voorspellingen staan vast. Ze worden één voor één onthuld.</p>`;
    html += preList();
  }
  return html;
}

function tabRanking(){
  const a = active();
  if(ui.openQ){
    const q = Q(ui.openQ);
    if(q && q.kind==='live' && q.status==='revealed') return `<div class="card">${resultCard(q)}<button class="btn ghost" style="margin-top:12px" data-open="">Terug</button></div>`;
    ui.openQ = null;
  }
  let html = '';
  if(a && a.status==='open') html += activeCard(a);
  const played = live().filter(q=>q.status==='revealed').sort((x,y)=>(y.ts||'').localeCompare(x.ts||''));
  if(!(a && a.status==='open')) html += `<div class="card big-wait"><div class="kicker">Ranking-vragen</div>
    <h2 class="pulse">${played.length ? 'Wacht op de volgende ronde' : 'Nog geen rondes gespeeld'}</h2>
    <p class="muted" style="margin:6px 0 0">De quizmaster start de rondes tijdens het weekend. Eén van jullie rangschikt, de rest gokt.</p></div>`;
  if(played.length) html += `<div class="kicker" style="margin:18px 0 8px">Gespeeld</div>` + played.map(q=>
    `<button class="qrow rev" data-open="${q.id}"><span class="t">${esc(q.title)}<small>volgens ${esc(P(q.ranker_id).name)}</small></span><span class="st">+${scoreQ(q)[me()]?.total ?? 0}</span></button>`).join('');
  return html;
}

function tabStand(){
  const st = standings(), last = lastRevealed();
  const lead = st[0];
  let html = `<div class="center" style="margin:6px 0 2px"><div class="kicker">Leaderboard</div></div>
    <div class="card">${st.map((s,i)=>`<div class="score ${s.p.id===me()?'mine':''}"><span class="pos">${i+1}</span><span>${esc(s.p.name)}${s.p.id===me()?' <span class="tag">jij</span>':''}</span><span class="pts">${s.pts}</span></div>`).join('')}</div>`;
  if(lead && lead.pts>0) html += `<div class="heldnow"><img src="de_held.jpg" alt=""><div><div class="kicker">Huidige Held</div><div class="hn">${esc(lead.p.name)}</div></div></div>`;
  if(last) html += `<div class="kicker" style="margin:20px 0 8px">Laatst onthuld</div><div class="card">${resultCard(last)}</div>`;
  else html += `<p class="center muted" style="margin-top:18px">Nog niets onthuld. ${predOpen()?'Eerst voorspellen.':'De eerste onthulling komt eraan.'}</p>`;
  return html;
}

// letters door elkaar, zodat een verborgen challenge ook onder de blur niet te lezen is
const scramble = s => s.replace(/[A-Za-zÀ-ÿ]/g, (c,i)=>{ const p = 'aeorntslkdgmhvbwuzpij'; const ch = p[(c.charCodeAt(0)*7 + i*3) % p.length]; return c===c.toUpperCase() ? ch.toUpperCase() : ch });
function tabChallenges(){
  const rules = `<div class="card center"><div class="kicker">Challenges</div><h2 style="margin-top:6px">Puntentelling</h2>
    <div class="pts3"><div><b>3</b><span>winnaar</span></div><div><b>2</b><span>tweede</span></div><div><b>1</b><span>derde</span></div><div><b>0</b><span>de rest</span></div></div>
    <p class="muted" style="margin:10px 0 0;font-size:14px">De quizmaster zet een challenge open zodra hij aan de beurt is.</p></div>`;
  return rules + challenges().map(q=>{
    if(q.status==='closed') return `<div class="chal locked"><div class="kicker">Challenge ${q.nr} · nog geheim</div><div class="ct">${esc(scramble(q.title))}</div></div>`;
    if(q.status==='open') return `<div class="chal live"><div class="kicker">Challenge ${q.nr} · loopt nu</div><div class="ct">${esc(q.title)}</div><p class="muted" style="margin:6px 0 0">Uitslag volgt.</p></div>`;
    const mine = scoreQ(q)[me()];
    return `<div class="chal done"><div class="kicker">Challenge ${q.nr} · uitslag${mine?` · jij +${mine.total}`:''}</div><div class="ct">${esc(q.title)}</div>${podium(q)}</div>`;
  }).join('');
}
/* ---------- soundboard ---------- */
const snd = { audio:null, id:null };
function tabSound(){
  return `<div class="center" style="margin:6px 0 14px"><div class="kicker">Soundboard</div>
    <p class="muted" style="margin:6px 0 0;font-size:14px">Koppel je telefoon aan de boombox en tik.</p></div>
    <div class="sb">${SOUNDS.map(([id,label,text])=>`<button class="sbb ${snd.id===id?'playing':''}" data-sound="${id}">
      <span class="sbl">${esc(label)}</span></button>`).join('')}</div>`;
}
function playSound(id){
  const mark = () => document.querySelectorAll('.sbb').forEach(b=>b.classList.toggle('playing', b.dataset.sound===snd.id));
  if(snd.audio){ snd.audio.pause(); snd.audio.currentTime = 0 }
  if(snd.id === id){ snd.audio = null; snd.id = null; return mark() }   // nogmaals tikken = stoppen
  const au = new Audio(`sounds/${id}.mp3`);
  snd.audio = au; snd.id = id; mark();
  au.onended = () => { if(snd.audio===au){ snd.audio=null; snd.id=null; mark() } };
  au.play().catch(()=>{ snd.audio=null; snd.id=null; mark() });
}
const tabSoon = (title, text) => `<div class="card big-wait" style="margin-top:20vh"><div class="kicker">Binnenkort</div><h2>${title}</h2><p class="muted" style="margin:8px 0 0">${text}</p></div>`;

function viewPlayer(){
  const tab = ui.tab || defaultTab();
  const body = tab==='event' ? tabEvent() : tab==='ranking' ? tabRanking() : tab==='stand' ? tabStand()
    : tab==='challenges' ? tabChallenges()
    : tabSound();
  return header() + body + tabBar(tab);
}

/* ============ scherm: quizmaster ============ */
const ATABS = [['events','Events','event'],['ranking','Ranking','ranking'],['challenges','Challenges','challenges'],['deelnemers','Deelnemers','people']];
ICON.people = '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3 19.5c.6-3.3 3-5.2 6-5.2s5.4 1.9 6 5.2"/><circle cx="17" cy="9" r="2.4"/><path d="M16.5 14.2c2.3.2 4 1.8 4.5 4.6"/></svg>';

function adminDefaultTab(){
  const a = active();
  if(a) return a.kind==='pre' ? 'events' : 'ranking';
  return predOpen() ? 'deelnemers' : 'events';
}
function adminTabBar(cur){
  const a = active(), dot = {};
  if(a && a.status==='voting') dot.events = true;
  if(a && a.status==='open') dot.ranking = true;
  if(challenges().some(q=>q.status==='open')) dot.challenges = true;
  return `<nav class="tabbar four">${ATABS.map(([id,label,ic])=>
    `<button class="tab ${cur===id?'on':''}" data-atab="${id}" aria-label="${label}"><span class="ic">${ICON[ic]}${dot[id]?'<i class="ping"></i>':''}</span><span class="lb">${label}</span></button>`).join('')}</nav>`;
}

function activeAdminCard(a){
  const who = id => a.status==='voting' ? answers(a,'vote').some(x=>x.player_id===id)
    : id===a.ranker_id ? answers(a,'vote').some(x=>x.player_id===id) : answers(a,'pred').some(x=>x.player_id===id);
  const ready = a.status==='voting' ? answers(a,'vote').length>0 : answers(a,'vote').some(x=>x.player_id===a.ranker_id);
  return `<div class="card"><div class="kicker">Loopt nu · ${qLabel(a)}${a.status==='voting'?' · stemming':''}</div><h2>${esc(a.title)}</h2>
    ${a.secret?`<div class="secret">${esc(a.secret)}</div>`:''}
    ${a.ranker_id?`<p class="muted">Rangschikker: <b>${esc(P(a.ranker_id).name)}</b></p>`:''}
    <div class="chips" style="margin:10px 0 14px">${S.players.map(p=>`<span class="chip ${who(p.id)?'on':''}">${esc(p.name)}${p.id===a.ranker_id?' ★':''}${who(p.id)?' ✓':''}</span>`).join('')}</div>
    ${!ready ? `<p class="muted">${a.status==='voting'?'Nog geen stemmen.':`Wachten tot ${esc(P(a.ranker_id).name)} heeft gerangschikt.`}</p>`:''}
    <button class="btn gold" data-reveal="${a.id}" ${ready?'':'disabled'}>Onthullen</button>
    <button class="btn ghost danger" style="margin-top:8px" data-cancel="${a.id}">${ui.arm==='c'+a.id?'Zeker? Tik nog een keer':'Annuleren'}</button></div>`;
}
// melding als er op een ander tabblad iets loopt
const busyElsewhere = (a, tab) => `<div class="card center" style="padding:12px"><p class="muted" style="margin:0 0 8px">Er loopt nog ${a.kind==='pre'?'een stemming bij Events':'een ranking-ronde'}. Rond die eerst af.</p>
  <button class="btn small" style="width:100%" data-atab="${tab}">Naar ${a.kind==='pre'?'Events':'Ranking'}</button></div>`;

function adminEvents(){
  const a = active(), open = predOpen();
  let html = '';
  if(a && a.kind==='pre') html += activeAdminCard(a);
  else if(a) html += busyElsewhere(a,'ranking');
  html += `<div class="card"><div class="kicker">Event-vragen · uitslagen</div>${open?`<p class="muted" style="font-size:14px">Onthullen kan vanaf vrijdag 17:00 (nog ${countdown()}).</p>`:''}` + pre().map(q=>{
    let ctl = '';
    if(q.status==='revealed') ctl = `<button class="btn small ghost" data-undo="${q.id}">${ui.arm==='u'+q.id?'Zeker? Tik nog een keer':'Onthulling terugdraaien'}</button>`;
    else if(q.status==='closed' && q.mode==='gemeten'){
      if(ui.truthFor===q.id) ctl = picker('truth'+q.id,'Tik de echte volgorde. 1 = het meest.') +
        `<button class="btn gold" style="margin-top:10px" data-truth="${q.id}" ${full('truth'+q.id)?'':'disabled'}>Onthullen</button>`;
      else ctl = `<button class="btn small" data-truthopen="${q.id}" ${open||a?'disabled':''}>Uitslag invullen</button>`;
    } else if(q.status==='closed') ctl = `<button class="btn small" data-vote="${q.id}" ${open||a?'disabled':''}>Start stemming</button>`;
    const st = q.status==='revealed' ? 'onthuld' : q.status==='voting' ? 'stemming loopt' : fmtAt(q.push_at);
    return `<div class="adm ${q.status==='revealed'?'isdone':''}"><div><b>${dnr(q)}.</b> ${esc(q.title)}</div>
      <div class="meta">${esc(q.secret)} · ${q.mode==='gemeten'?'jij vult in':'groep stemt'} · ${st}</div>${ctl}</div>`;
  }).join('') + `</div>`;
  return html;
}

function adminRanking(){
  const a = active();
  let html = '';
  if(a && a.kind==='live') html += activeAdminCard(a);
  else if(a) html += busyElsewhere(a,'events');
  const cats = [...new Set(live().map(q=>q.cat))];
  const played = live().filter(q=>q.status==='revealed').length;
  html += `<div class="card"><div class="kicker">Ranking-vragen · ${played} gespeeld</div><h2 style="margin-top:6px">1. Kies een vraag</h2>` +
    cats.map(c=>`<div class="kicker" style="margin:14px 0 8px">${esc(c)}</div><div class="chips">${live().filter(q=>q.cat===c).map(q=>
      `<button class="chip ${ui.newLive===q.id?'on':''} ${q.status==='revealed'?'done':''}" data-live="${q.id}" ${q.status!=='closed'?'disabled':''}>${esc(q.title)}</button>`).join('')}</div>`).join('') +
    `<div style="margin-top:14px"><input type="text" id="custom" placeholder="Of typ een eigen vraag" value="${esc(ui.customTitle)}"></div>
     <button class="btn small" style="margin-top:8px;width:100%" data-act="addlive" ${ui.customTitle.trim()?'':'disabled'}>Vraag toevoegen</button>
     <h2 style="margin-top:22px">2. Wie rangschikt?</h2><div class="chips">${S.players.map(p=>
      `<button class="chip ${ui.newRanker===p.id?'on':''}" data-ranker="${p.id}">${esc(p.name)}</button>`).join('')}
      <button class="chip ${ui.newRanker==='_random'?'on':''}" data-ranker="_random">Willekeurig</button></div>
     <button class="btn gold" style="margin-top:16px" data-act="startlive" ${!a && ui.newLive && ui.newRanker?'':'disabled'}>${a?'Eerst lopende ronde afronden':'Zet live'}</button></div>`;
  return html;
}

function adminChallenges(){
  return `<div class="card"><div class="kicker">Challenges · 3, 2 en 1 punt</div>` + challenges().map(q=>{
    let ctl;
    if(q.status==='closed') ctl = `<button class="btn small" data-chopen="${q.id}">Openzetten</button>`;
    else if(q.status==='open'){
      if(ui.truthFor===q.id){ const k='ch'+q.id, n=(ui.picks[k]||[]).length;
        ctl = picker(k,'Tik de top 3 op volgorde: winnaar eerst.') + `<button class="btn gold" style="margin-top:10px" data-chsave="${q.id}" ${n>=3?'':'disabled'}>Uitslag opslaan</button>`; }
      else ctl = `<div class="row"><button class="btn small" data-truthopen="${q.id}">Uitslag invullen</button><button class="btn small ghost" data-chhide="${q.id}">Weer verbergen</button></div>`;
    } else ctl = `<button class="btn small ghost" data-undo="${q.id}">${ui.arm==='u'+q.id?'Zeker? Tik nog een keer':'Uitslag terugdraaien'}</button>`;
    const st = q.status==='closed' ? 'verborgen voor deelnemers' : q.status==='open' ? 'open, wacht op uitslag' : 'uitslag: ' + q.truth.slice(0,3).map(id=>P(id).name).join(', ');
    return `<div class="adm ${q.status==='revealed'?'isdone':''}"><div><b>${q.nr}.</b> ${esc(q.title)}</div><div class="meta">${st}</div>${ctl}</div>`;
  }).join('') + `</div>`;
}

function adminDeelnemers(){
  const tot = pre().length, done = S.players.filter(p=>progress(p.id)===tot).length, open = predOpen();
  let html = `<div class="card center"><div class="kicker">Event-vragen ingevuld</div><div class="cnt">${done} / ${S.players.length}</div>
    <p class="muted" style="margin:6px 0 0">${open ? `Deadline vrijdag 17:00, nog ${countdown()}.` : 'De voorspellingen zijn gesloten.'}</p></div>`;
  html += S.players.map(p=>{
    const n = progress(p.id), missing = pre().filter(q=>!S.answers.some(x=>x.question_id===q.id && x.kind==='pred' && x.player_id===p.id));
    const isOpen = ui.openPlayer===p.id;
    return `<button class="prow ${n===tot?'full':''}" data-player="${p.id}">
        <span class="pn">${esc(p.name)}</span><span class="pc">${n===tot?'✓ compleet':`${n} / ${tot}`}</span>
        <span class="bar"><i style="width:${Math.round(n/tot*100)}%"></i></span></button>
      ${isOpen && missing.length ? `<div class="pmiss"><div class="kicker" style="margin-bottom:6px">Nog niet ingevuld</div>${missing.map(q=>`<div>${dnr(q)}. ${esc(q.title)}</div>`).join('')}</div>` : ''}`;
  }).join('');
  html += `<div class="card" style="margin-top:18px"><div class="kicker" style="margin-bottom:6px">Stand</div>${scoreboard()}</div>
    <p class="center"><a href="#tv" class="muted">Tv-scherm openen</a></p>`;
  return html;
}

function viewAdmin(){
  if(!isAdmin()) return header() + `<div class="card">Alleen de quizmaster heeft toegang.</div>`;
  const tab = ui.atab || adminDefaultTab();
  const body = tab==='events' ? adminEvents() : tab==='ranking' ? adminRanking() : tab==='challenges' ? adminChallenges() : adminDeelnemers();
  return header() + `<div class="center"><div class="kicker">Quizmaster</div></div>` + body + adminTabBar(tab);
}

/* ============ scherm: tv ============ */
function viewTv(){
  const a = active(), last = lastRevealed();
  let main;
  if(a){
    const who = id => a.status==='voting' ? answers(a,'vote').some(x=>x.player_id===id)
      : id===a.ranker_id ? answers(a,'vote').some(x=>x.player_id===id) : answers(a,'pred').some(x=>x.player_id===id);
    main = `<div class="kicker">${a.status==='voting'?`${qLabel(a)} · iedereen stemt`:`Live-ronde · ${esc(P(a.ranker_id).name)} rangschikt`}</div>
      <h1>${esc(a.title)}</h1>${a.secret?`<div class="secret">${esc(a.secret)}</div>`:''}
      <div class="tvgrid">${S.players.map(p=>`<div class="tvp ${who(p.id)?'in':''} ${p.id===a.ranker_id?'ranker':''}">${esc(p.name)}
        <div class="st">${who(p.id)?'klaar':'denkt na…'}</div></div>`).join('')}</div>`;
  } else if(predOpen()){
    main = `<div class="tvhero"><img class="tvlogo" src="de_held.jpg" alt="De Held"><div><div class="kicker">Het Heldenweekend 2026</div><h1>Ranking de Helden</h1></div></div>
      <div class="kicker" style="margin-top:4vh">Voorspellingen sluiten over</div><div class="cnt">${countdown()}</div>
      <div class="tvgrid">${S.players.map(p=>`<div class="tvp ${progress(p.id)===pre().length?'in':''}">${esc(p.name)}<div class="st">${progress(p.id)} / ${pre().length}</div></div>`).join('')}</div>`;
  } else if(last && last.kind==='challenge'){
    main = `<div class="kicker">Challenge · de uitslag</div><h1>${esc(last.title)}</h1>${podium(last,'tvorder',1.2)}
      <div class="winner" style="animation-delay:3.4s">Winnaar: <b>${esc(P(last.truth[0]).name)}</b> (+3)</div>`;
  } else if(last){
    const sc = scoreQ(last), n = last.truth.length;
    const best = Object.entries(sc).filter(([,o])=>o.bonus).map(([pid])=>esc(P(pid).name));
    main = `<div class="kicker">${qLabel(last)} · de onthulling${last.ranker_id?` · volgens ${esc(P(last.ranker_id).name)}`:''}</div>
      <h1>${esc(last.title)}</h1>${last.secret?`<div class="secret">${esc(last.secret)}</div>`:''}
      ${order(last.truth,'tvorder',0.9)}
      <div class="winner" style="animation-delay:${(n*0.9+2.2).toFixed(1)}s">${best.length?`Beste voorspelling: <b>${best.join(' & ')}</b> (+${BONUS})`:'Niemand had er iets van goed.'}</div>`;
  } else {
    main = `<div class="tvhero big"><img class="tvlogo" src="de_held.jpg" alt="De Held"><div><div class="kicker">Het Heldenweekend 2026</div><h1>Ranking de Helden</h1><p class="sub pulse">Wie wordt de Held?</p></div></div>`;
  }
  return `<div class="tv tvwrap"><div>${main}</div><div class="tvside card"><h2>Stand</h2>${scoreboard()}</div></div>`;
}

/* ============ render ============ */
function render(force){
  document.body.classList.toggle('tv', route()==='tv');
  const sig = JSON.stringify([S, loadErr, ui, route(), me(), Math.floor(now()/30000)]);
  if(!force && sig === lastSig) return; lastSig = sig;
  const app = document.getElementById('app');
  const el = document.activeElement, fid = el && el.id, sel = el && el.selectionStart;
  let html;
  if(!S) html = loadErr ? `<div class="err">Kan de spelgegevens niet laden: ${esc(loadErr)}</div><button class="btn" data-act="retry">Opnieuw proberen</button>` : '';
  else if(route()==='tv') html = viewTv();
  else if(!me() || ls.get('helden_code')!==GAME_CODE) html = viewLogin();
  else if(route()==='admin') html = viewAdmin();
  else html = viewPlayer();
  if(S && loadErr) html = `<div class="err">${esc(loadErr)}</div>` + html;
  app.innerHTML = html;
  if(fid){ const f = document.getElementById(fid); if(f){ f.focus(); try{ f.setSelectionRange(sel,sel) }catch{} } }
}

/* ============ interactie ============ */
function arm(tag){ if(ui.arm===tag){ ui.arm=null; return true } ui.arm=tag; render(); setTimeout(()=>{ if(ui.arm===tag){ ui.arm=null; render() } },4000); return false }

document.addEventListener('input', e => { if(e.target.id==='custom'){ ui.customTitle = e.target.value; render() } });
document.addEventListener('keydown', e => { if(e.key==='Enter' && e.target.id==='code') document.querySelector('[data-act=code]')?.click() });
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act],[data-me],[data-pick],[data-clear],[data-submit],[data-edit],[data-open],[data-reveal],[data-cancel],[data-truthopen],[data-truth],[data-vote],[data-undo],[data-live],[data-ranker],[data-tab],[data-chopen],[data-chhide],[data-chsave],[data-atab],[data-player],[data-sound]');
  if(!t || t.disabled) return;
  const d = t.dataset;
  if(d.act) e.preventDefault();
  if(d.act==='code'){
    const v = (document.getElementById('code').value||'').trim().toUpperCase();
    if(v===GAME_CODE){ ls.set('helden_code',GAME_CODE); ui.codeErr=false } else ui.codeErr=true;
    return render(true);
  }
  if(d.act==='retry') return refresh();
  if(d.act==='logout'){ ls.del('helden_me'); location.hash=''; return render(true) }
  if(d.me){ ls.set('helden_me', d.me); return render(true) }
  if(d.sound){ playSound(d.sound); return }
  if(d.tab){ ui.tab = d.tab; ui.openQ = null; window.scrollTo(0,0); return render() }
  if(d.atab){ ui.atab = d.atab; ui.truthFor = null; window.scrollTo(0,0); return render() }
  if(d.player){ ui.openPlayer = ui.openPlayer===d.player ? null : d.player; return render() }
  if(d.pick){
    const k = d.pick, arr = [...(ui.picks[k]||[])], i = arr.indexOf(d.id);
    if(i>=0) arr.splice(i,1); else arr.push(d.id);
    if(arr.length === S.players.length-1) arr.push(S.players.find(p=>!arr.includes(p.id)).id);
    ui.picks[k] = arr; return render();
  }
  if(d.clear){ ui.picks[d.clear]=[]; return render() }
  if(d.edit){ const [qid,kind] = d.edit.split(':'); const m = myAnswer(Q(+qid),kind); if(m) ui.picks[d.edit]=[...m.picks]; ui.editing[d.edit]=true; return render() }
  if('open' in d){ ui.openQ = d.open ? +d.open : null; window.scrollTo(0,0); return render() }
  if(d.submit){
    const [qid,kind] = d.submit.split(':'), q = Q(+qid);
    if(kind==='pred' && q.kind==='pre' && !predOpen()) { loadErr='De voorspellingen zijn gesloten.'; return render(true) }
    return act(async()=>{
      await db.setAnswer({question_id:q.id, player_id:me(), kind, picks:ui.picks[d.submit], updated_at:stamp()});
      ui.editing[d.submit]=false;
      if(q.kind==='pre' && kind==='pred'){ const next = pre().find(x=>x.id!==q.id && !myAnswer(x,'pred')); ui.openQ = next ? next.id : null; window.scrollTo(0,0) }
    });
  }
  if(d.reveal){
    const q = Q(+d.reveal);
    const truth = q.status==='voting' ? groupTruth(q) : answers(q,'vote').find(a=>a.player_id===q.ranker_id)?.picks;
    if(!truth) return;
    return act(()=>db.updateQ(q.id,{truth, status:'revealed', ts:stamp()}));
  }
  if(d.cancel){ if(!arm('c'+d.cancel)) return; const q = Q(+d.cancel);
    return act(async()=>{ await db.delAnswers(q.id,'vote'); if(q.kind==='live') await db.delAnswers(q.id,'pred');
      await db.updateQ(q.id,{status:'closed', ranker_id:q.kind==='live'?null:q.ranker_id, ts:null}) }) }
  if(d.truthopen){ ui.truthFor = +d.truthopen; return render() }
  if(d.truth){ const id = +d.truth; const truth = ui.picks['truth'+id];
    return act(async()=>{ await db.updateQ(id,{truth, status:'revealed', ts:stamp()}); ui.truthFor=null }) }
  if(d.chopen) return act(()=>db.updateQ(+d.chopen,{status:'open'}));
  if(d.chhide) return act(()=>db.updateQ(+d.chhide,{status:'closed'}));
  if(d.chsave){ const id = +d.chsave; const truth = ui.picks['ch'+id];
    return act(async()=>{ await db.updateQ(id,{truth, status:'revealed', ts:stamp()}); ui.truthFor=null }) }
  if(d.vote) return act(()=>db.updateQ(+d.vote,{status:'voting', ts:stamp()}));
  if(d.undo){ if(!arm('u'+d.undo)) return; const q = Q(+d.undo);
    return act(async()=>{ await db.delAnswers(q.id,'vote'); if(q.kind==='live') await db.delAnswers(q.id,'pred');
      await db.updateQ(q.id,{status:q.kind==='challenge'?'open':'closed', truth:null, ts:null, ranker_id:q.kind==='live'?null:q.ranker_id}) }) }
  if(d.live){ ui.newLive = ui.newLive===+d.live ? null : +d.live; return render() }
  if(d.ranker){ ui.newRanker = ui.newRanker===d.ranker ? null : d.ranker; return render() }
  if(d.act==='addlive'){ const title = ui.customTitle.trim(); if(!title) return;
    return act(async()=>{ await db.addQ({kind:'live', cat:'Eigen vragen', title, mode:'ranker'}); ui.customTitle='';
      const s = await db.load(); ui.newLive = s.questions.filter(q=>q.title===title).pop()?.id ?? null }) }
  if(d.act==='startlive'){
    let r = ui.newRanker; if(r==='_random') r = S.players[Math.floor(Math.random()*S.players.length)].id;
    const id = ui.newLive;
    return act(async()=>{ await db.updateQ(id,{status:'open', ranker_id:r, ts:stamp()}); ui.newLive=null; ui.newRanker=null });
  }
});
window.addEventListener('hashchange', ()=>{ ui.openQ=null; render(true) });
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) refresh() });

/* ============ achtergrond beweegt rustig mee met scrollen ============ */
(()=>{ const bg = document.getElementById('bg'); if(!bg) return; let tick = false;
  const upd = () => { const y = window.scrollY || 0;
    bg.style.setProperty('--py', (-y*0.12).toFixed(1)+'px');
    bg.style.setProperty('--rot', Math.max(-6, Math.min(6, y*0.004)).toFixed(2)+'deg'); tick = false };
  window.addEventListener('scroll', ()=>{ if(!tick){ tick = true; requestAnimationFrame(upd) } }, {passive:true}); upd();
})();

/* ============ start ============ */
(async()=>{
  try{ db = MOCK ? mockDb() : await supaDb() }
  catch(e){ loadErr = 'Verbinding mislukt: '+(e.message||e); return render(true) }
  db.subscribe(soonRefresh);
  await refresh();
  setInterval(refresh, 4000);    // vangnet als realtime op 4G hapert
})();
