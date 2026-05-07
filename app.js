import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ============ FIREBASE CONFIG ============
const firebaseConfig = {
  apiKey: "AIzaSyDo_74q__VT249nTBhmJ7BYKOW06uViUkQ",
  authDomain: "volleylab-tournament.firebaseapp.com",
  projectId: "volleylab-tournament",
  storageBucket: "volleylab-tournament.firebasestorage.app",
  messagingSenderId: "368984394811",
  appId: "1:368984394811:web:84c7da699ae3cfcbc8201e",
  measurementId: "G-H7ZBS9YHX6"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const TOURNAMENT_REF = doc(db, "tournaments", "main");
const STORE = 'vl25b';

let firebaseReady = false;
let applyingRemoteState = false;
let syncIndicator = null;

// ============ FIREBASE HELPERS ============

function setSyncStatus(ok) {
  if (!syncIndicator) syncIndicator = document.getElementById('sync-indicator');
  if (!syncIndicator) return;
  syncIndicator.className = ok ? 'sync-dot sync-ok' : 'sync-dot sync-err';
  syncIndicator.title = ok ? 'Synced ✓' : 'Sync error';
}

// Firebase does not support nested arrays (array of arrays).
// S.ko is [[game,game,...], [game,...], ...]
// We convert it to { r0: [game,game], r1: [game], ... } for Firebase
// and back when loading.

function koToFirebase(ko) {
  const obj = {};
  ko.forEach((round, ri) => { obj[`r${ri}`] = round; });
  return obj;
}

function koFromFirebase(obj) {
  if (!obj) return [];
  return Object.keys(obj)
    .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))
    .map(k => obj[k]);
}

function stateToFirebase(s) {
  return {
    groups: s.groups,
    sched:  s.sched,
    ko:     koToFirebase(s.ko),
    cfg:    s.cfg
  };
}

function stateFromFirebase(data) {
  return {
    groups: data.groups || [],
    sched:  data.sched  || [],
    ko:     koFromFirebase(data.ko),
    cfg:    data.cfg    || { ...DEF_SETTINGS }
  };
}

async function pushStateToCloud() {
  if (!firebaseReady || applyingRemoteState) return;
  try {
    await setDoc(TOURNAMENT_REF, {
      state: stateToFirebase(S),
      updatedAt: serverTimestamp()
    }, { merge: true });
    setSyncStatus(true);
  } catch (err) {
    console.error("Could not save to Firebase:", err);
    setSyncStatus(false);
  }
}

async function loadInitialCloudState() {
  try {
    const snap = await getDoc(TOURNAMENT_REF);
    if (snap.exists() && snap.data().state) {
      applyingRemoteState = true;
      const remote = stateFromFirebase(snap.data().state);
      // Only load from Firebase if groups are not TBD
      const hasRealTeams = remote.groups && remote.groups[0] &&
        remote.groups[0].teams[0] !== 'TBD / TBD' &&
        remote.groups[0].teams[0] === DEFAULT_GROUPS[0].teams[0];
      if (hasRealTeams) {
        Object.assign(S, remote);
        localStorage.setItem(STORE, JSON.stringify(S));
      } else {
        S.groups = JSON.parse(JSON.stringify(DEFAULT_GROUPS));
        await pushStateToCloud();
      }
      applyingRemoteState = false;
    } else {
      S.groups = JSON.parse(JSON.stringify(DEFAULT_GROUPS));
      firebaseReady = true;
      await pushStateToCloud();
    }
  } catch (err) {
    console.error("Could not load Firebase state:", err);
  } finally {
    firebaseReady = true;
  }
}

// Live listener — updates all devices in real time
onSnapshot(TOURNAMENT_REF, (snap) => {
  if (!snap.exists() || !snap.data().state) return;
  if (applyingRemoteState) return;
  applyingRemoteState = true;
  const remote = stateFromFirebase(snap.data().state);
  Object.assign(S, remote);
  localStorage.setItem(STORE, JSON.stringify(S));
  applyingRemoteState = false;
  renderAll();
  setSyncStatus(true);
});

// ============ CONSTANTS ============
const PILLS = ['p1','p2','p3','p4'];
const PW = 'volleylab';
const DEF_SETTINGS = { numCouples:26, courts:4, numGroups:8, advPerGroup:1, startTime:'07:00', gameDur:30, breakDur:0 };

const DEFAULT_GROUPS = [
  { name:'A', teams:['שמרית חמלניצקי / וניר קיגלמן','שחף / הדר רוז','עידן / לינוי','מתן שפירא / דנה כהן'] },
  { name:'B', teams:['גב / כרמל ארזי','יערה ראוף / עומר כרמלי','שגיא / אורטל','עפרי רוסו / אמיר'] },
  { name:'C', teams:['אפרת / איתמר','שיי כהן / נועה עובד','בן גולדברג / טל זמירי'] },
  { name:'D', teams:['תום / דנה בובי','מייקי / ביידץ','חנה / לירון'] },
  { name:'E', teams:['נעם ברוך / דור אביטל','פבל / סאני','עפרי בר / אביב'] },
  { name:'F', teams:['יהונתן / ענבל','כריסטינה / אייל','לי קאשי / עדי מנחם'] },
  { name:'G', teams:['תומר סייג / שרון סייג','לימור / אלון פנוש','נוה ספונים / מעין בן דב'] },
  { name:'H', teams:['גיל ליפשיץ / שני זוניגה','ערן יונה / קארן בנק','שהם / מיקה'] }
];

// ============ STATE ============
let S = { groups: JSON.parse(JSON.stringify(DEFAULT_GROUPS)), sched: [], ko: [], cfg: {...DEF_SETTINGS} };
let editTarget = null;
let activeCourt = 'all';
let admin = false;

// ============ ACCESSORS ============
function NC()    { return S.cfg.courts; }
function DUR()   { return S.cfg.gameDur; }
function BRK()   { return S.cfg.breakDur; }
function START() { return S.cfg.startTime; }

// ============ LOCAL STORAGE ============
function load() {
  try {
    const d = localStorage.getItem(STORE);
    if (d) { S = JSON.parse(d); if (!S.cfg) S.cfg = {...DEF_SETTINGS}; }
  } catch(e) {}
}

function save() {
  try { localStorage.setItem(STORE, JSON.stringify(S)); } catch(e) {}
  pushStateToCloud();
}

// ============ TIME UTILS ============
function t2m(t) { const [h,m] = t.split(':').map(Number); return h*60+m; }
function m2t(m) { return `${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`; }
function addM(t, m) { return m2t(t2m(t)+m); }

// ============ ADMIN / AUTH ============
function adminClick() {
  if (admin) { admin = false; refreshA(); rerender(); return; }
  document.getElementById('pw-modal').classList.remove('h');
  setTimeout(() => document.getElementById('pw-inp').focus(), 80);
}

function tryLogin() {
  const val = document.getElementById('pw-inp').value;
  if (val === PW) {
    admin = true; closeLogin(); refreshA(); rerender();
  } else {
    document.getElementById('pw-err').classList.remove('h');
    document.getElementById('pw-inp').value = '';
    document.getElementById('pw-inp').focus();
  }
}

function closeLogin() {
  document.getElementById('pw-modal').classList.add('h');
  document.getElementById('pw-inp').value = '';
  document.getElementById('pw-err').classList.add('h');
}

function refreshA() {
  const txt  = document.getElementById('adm-txt');
  const btn  = document.getElementById('abtn');
  const bar  = document.getElementById('mode-bar');
  const mtxt = document.getElementById('mode-text');
  document.body.classList.toggle('admin-mode', admin);
  if (txt)  txt.textContent  = admin ? 'Admin on' : 'Admin';
  if (btn)  btn.classList.toggle('on', admin);
  if (bar)  bar.className = 'mode-bar ' + (admin ? 'mode-admin' : 'mode-view');
  if (mtxt) mtxt.textContent = admin
    ? 'Admin mode — you can edit teams, scores and settings'
    : 'View only — tap Admin to manage the tournament';
  if (!admin && document.getElementById('page-settings').classList.contains('on')) goPage('teams');
}

function rerender() {
  renderStageBar();
  const active = ['teams','standings','schedule','bracket','settings']
    .find(p => document.getElementById('page-'+p) && document.getElementById('page-'+p).classList.contains('on'));
  if (active === 'teams')     renderTeams();
  if (active === 'standings') renderStandings();
  if (active === 'schedule')  renderSchedulePage();
  if (active === 'bracket')   { updateKO(); renderBracket(); }
  if (active === 'settings')  renderSettings();
  renderStats();
}

function renderAll() {
  refreshA();
  renderStageBar();
  renderTeams();
  renderStandings();
  renderSchedulePage();
  updateKO();
  renderBracket();
  renderSettings();
  renderStats();
}

// ============ STAGE BAR ============
function renderStageBar() {
  const bar = document.getElementById('stage-bar');
  if (!bar) return;
  const poolDone = S.sched.length > 0 && S.sched.every(g => isValidScore(parseInt(g.sa), parseInt(g.sb)));
  const koProgress = S.ko.map(round => round.every(g => isValidScore(parseInt(g.sa), parseInt(g.sb))));
  const steps = ['Pool Stage'];
  S.ko.forEach((_, ri) => steps.push(getKORoundName(ri)));
  let currentStep = 0;
  if (S.sched.length === 0) { currentStep = 0; }
  else if (!poolDone) { currentStep = 0; }
  else { currentStep = 1; koProgress.forEach((done, i) => { if (done) currentStep = i+2; }); }
  bar.innerHTML = steps.map((s, i) => `
    <div class="stage-step">
      ${i > 0 ? '<div class="stage-arrow"></div>' : ''}
      <div class="stage-pill ${i < currentStep ? 'done' : i === currentStep ? 'active' : ''}">${s}</div>
    </div>`).join('');
}

// ============ NAV ============
function goPage(p) {
  if (p === 'settings' && !admin) p = 'teams';
  document.querySelectorAll('.pg').forEach(e => e.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(e => e.classList.remove('on'));
  document.getElementById('page-'+p).classList.add('on');
  const tab = document.getElementById('tab-'+p);
  if (tab) tab.classList.add('on');
  if (p === 'teams')     renderTeams();
  if (p === 'standings') renderStandings();
  if (p === 'schedule')  renderSchedulePage();
  if (p === 'bracket')   { updateKO(); renderBracket(); }
  if (p === 'settings')  renderSettings();
}

// ============ TEAMS PAGE ============
function renderTeams() {
  const grid = document.getElementById('teams-grid');
  grid.innerHTML = '';
  S.groups.forEach((grp, gi) => {
    const card = document.createElement('div');
    card.className = 'group-card';
    const teamsHTML = grp.teams.map((t, ti) => `
      <div class="team-item" id="titem-${gi}-${ti}">
        <span class="team-rank">${ti+1}</span>
        <span class="team-name-display" id="tname-${gi}-${ti}">${t}</span>
        ${admin ? `<button class="gedit-btn" onclick="openEdit(${gi},${ti})">✏️</button>
        <button class="team-del" onclick="deleteTeam(${gi},${ti})">×</button>` : ''}
      </div>`).join('');
    card.innerHTML = `
      <div class="group-head">
        <span class="gname">GROUP ${grp.name}</span>
        <span style="font-size:11px;color:#fff;opacity:.85">${grp.teams.length} teams</span>
      </div>
      <div class="team-list" id="tlist-${gi}">${teamsHTML}</div>
      ${admin ? `<div class="add-team-row">
        <input class="add-team-input" id="new-team-${gi}" placeholder="Add couple (e.g. Dana / Avi)" onkeydown="if(event.key==='Enter')addTeam(${gi})"/>
        <button class="add-team-btn" onclick="addTeam(${gi})">+ Add couple</button>
      </div>` : ''}`;
    grid.appendChild(card);
  });
}

function openEdit(gi, ti) {
  if (!admin) return;
  editTarget = {gi, ti};
  const name = S.groups[gi].teams[ti];
  const parts = name.split('/').map(s => s.trim());
  document.getElementById('edit-p1').value = parts[0] || '';
  document.getElementById('edit-p2').value = parts[1] || '';
  document.getElementById('edit-modal-title').textContent = `Edit — Group ${S.groups[gi].name}`;
  document.getElementById('edit-modal').classList.remove('h');
  document.getElementById('edit-p1').focus();
}

function closeEdit() { document.getElementById('edit-modal').classList.add('h'); editTarget = null; }

function saveEdit() {
  if (!admin || !editTarget) return;
  const {gi, ti} = editTarget;
  const p1 = document.getElementById('edit-p1').value.trim();
  const p2 = document.getElementById('edit-p2').value.trim();
  const name = p2 ? `${p1} / ${p2}` : p1;
  if (!name) return;
  const old = S.groups[gi].teams[ti];
  S.groups[gi].teams[ti] = name;
  S.sched.forEach(g => { if (g.a === old) g.a = name; if (g.b === old) g.b = name; });
  closeEdit(); save(); renderTeams();
}

function addTeam(gi) {
  if (!admin) return;
  const inp = document.getElementById(`new-team-${gi}`);
  const name = inp.value.trim();
  if (!name) return;
  S.groups[gi].teams.push(name);
  inp.value = '';
  save(); renderTeams();
}

function deleteTeam(gi, ti) {
  if (!admin) return;
  if (S.groups[gi].teams.length <= 1) { alert('Each pool needs at least 1 team'); return; }
  S.groups[gi].teams.splice(ti, 1);
  save(); renderTeams();
}

// ============ SCHEDULE GENERATION ============
function rr(teams) {
  if (teams.length < 2) return [];
  const list = teams.length % 2 === 0 ? [...teams] : [...teams, 'BYE'];
  const half = list.length / 2;
  const games = [];
  for (let r = 0; r < list.length - 1; r++) {
    for (let i = 0; i < half; i++) {
      const a = list[i], b = list[list.length - 1 - i];
      if (a !== 'BYE' && b !== 'BYE') games.push([a, b]);
    }
    list.splice(1, 0, list.pop());
  }
  return games;
}

function generateSchedule() {
  if (!admin) return;
  const slot = DUR() + BRK();
  const all = [];
  S.groups.forEach((grp, gi) => {
    rr(grp.teams).forEach(([a, b]) => {
      all.push({ type:'g', gi, gn:grp.name, a, b, sa:'', sb:'' });
    });
  });
const scheduled = [];
const pending = [...all];
let slotIdx = 0;
while (pending.length > 0) {
  const usedTeams = new Set();
  const remaining = [];
  for (const g of pending) {
    if (!usedTeams.has(g.a) && !usedTeams.has(g.b) && scheduled.filter(x => x.si === slotIdx).length < NC()) {
      g.court = scheduled.filter(x => x.si === slotIdx).length + 1;
      g.si = slotIdx;
      g.time = addM(START(), slotIdx * slot);
      usedTeams.add(g.a);
      usedTeams.add(g.b);
      scheduled.push(g);
    } else {
      remaining.push(g);
    }
  }
  pending.length = 0;
  pending.push(...remaining);
  slotIdx++;
}
S.sched = scheduled;
  S.sched = all;

  const adv = S.cfg.advPerGroup || 0;
  const ng = S.groups.length;
  if (adv < 1) { S.ko = []; save(); goPage('schedule'); return; }

  const koSeeds = [];
  for (let rank = 1; rank <= adv; rank++)
    for (let g = 0; g < ng; g++)
      koSeeds.push(`${String.fromCharCode(65+g)}${rank}`);

  let bracketSize = 1;
  while (bracketSize < koSeeds.length) bracketSize *= 2;
  while (koSeeds.length < bracketSize) koSeeds.push('TBD');

  S.ko = [];
  const lastSi = all.length ? all[all.length-1].si : 0;
  let rs = lastSi + 1;

  const firstRound = [];
  for (let i = 0; i < bracketSize / 2; i++) {
    const aSeed = koSeeds[i];
    const bSeed = koSeeds[bracketSize - 1 - i];
    firstRound.push({ a:aSeed, b:bSeed, seedA:aSeed, seedB:bSeed, sa:'', sb:'' });
  }
  firstRound.forEach((g, gi) => {
    g.court = (gi % NC()) + 1;
    g.si = rs + Math.floor(gi / NC());
    g.time = addM(START(), g.si * slot);
  });
  rs += Math.ceil(firstRound.length / NC());
  S.ko.push(firstRound);

  let matches = firstRound.length / 2;
  while (matches >= 1) {
    const round = [];
    for (let i = 0; i < matches; i++) {
      round.push({
        a: `Winner of ${getKORoundName(S.ko.length-1)} ${i*2+1}`,
        b: `Winner of ${getKORoundName(S.ko.length-1)} ${i*2+2}`,
        sa: '', sb: '',
        court: (i % NC()) + 1,
        si: rs + Math.floor(i / NC()),
        time: addM(START(), (rs + Math.floor(i / NC())) * slot)
      });
    }
    rs += Math.ceil(round.length / NC());
    S.ko.push(round);
    matches = matches / 2;
  }

  save();
  goPage('schedule');
}

// ============ STANDINGS ============
function getStandings(gi) {
  const grp = S.groups[gi];
  const rec = {};
  grp.teams.forEach(t => rec[t] = {w:0, l:0, pts:0, scored:0, against:0});
  S.sched.filter(g => g.type === 'g' && g.gi === gi).forEach(g => {
    const sa = parseInt(g.sa), sb = parseInt(g.sb);
    if (!isNaN(sa) && !isNaN(sb) && g.sa !== '' && g.sb !== '') {
      if (rec[g.a]) { rec[g.a].scored += sa; rec[g.a].against += sb; }
      if (rec[g.b]) { rec[g.b].scored += sb; rec[g.b].against += sa; }
      if (sa > sb) { if(rec[g.a]){rec[g.a].w++;rec[g.a].pts+=2;} if(rec[g.b]){rec[g.b].l++;rec[g.b].pts+=1;} }
      else if (sb > sa) { if(rec[g.b]){rec[g.b].w++;rec[g.b].pts+=2;} if(rec[g.a]){rec[g.a].l++;rec[g.a].pts+=1;} }
    }
  });
  return grp.teams.map(t => ({name:t, ...rec[t], diff:(rec[t].scored-rec[t].against)}))
    .sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.w !== a.w) return b.w - a.w;
      if (b.diff !== a.diff) return b.diff - a.diff;
      return b.scored - a.scored;
    });
}

function renderStandings() {
  const grid = document.getElementById('standings-grid');
  grid.innerHTML = '';
  S.groups.forEach((grp, gi) => {
    const st = getStandings(gi);
    const played = S.sched.filter(g => g.gi === gi && isValidScore(parseInt(g.sa), parseInt(g.sb))).length;
    const card = document.createElement('div'); card.className = 'scard';
    const rows = st.map((t, i) => {
      const isWinner = i === 0 && played > 0;
      const diff = t.diff || 0;
      const diffStr = diff > 0 ? `+${diff}` : String(diff);
      const diffClass = diff > 0 ? 'diff-pos' : diff < 0 ? 'diff-neg' : 'diff-zero';
      return `<tr class="${isWinner ? 'winner' : ''}">
        <td><span class="rnk">${isWinner ? '#1' : i+1}</span>${t.name}</td>
        <td>${t.w}</td><td>${t.l}</td>
        <td class="${diffClass}">${diff !== 0 || t.w > 0 || t.l > 0 ? diffStr : '—'}</td>
        <td class="pts-val">${t.pts}</td>
      </tr>`;
    }).join('');
    card.innerHTML = `<div class="scard-head"><span class="scard-name">GROUP ${grp.name}</span><span style="font-size:11px;color:var(--text3)">Top teams advance</span></div>
    <table class="stbl"><thead><tr><th>Team</th><th>W</th><th>L</th><th>+/−</th><th>Pts</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
    grid.appendChild(card);
  });
}

// ============ SCORE VALIDATION ============
function isValidScore(a, b) {
  if (isNaN(a) || isNaN(b)) return false;
  const hi = Math.max(a, b), lo = Math.min(a, b);
  if (hi < 21) return false;
  if (hi === lo) return false;
  if (hi === 21) return hi - lo >= 2;
  return hi - lo === 2;
}

function scoreError(a, b) {
  if (a === '' || b === '') return null;
  const sa = parseInt(a), sb = parseInt(b);
  if (isNaN(sa) || isNaN(sb)) return null;
  const hi = Math.max(sa, sb), lo = Math.min(sa, sb);
  if (hi < 21) return `Score must reach at least 21 · e.g. 21–${lo}`;
  if (hi === lo) return `Scores can't be equal`;
  if (hi === 21 && hi - lo < 2) return `Need a 2-point lead · e.g. 21–${21-2}`;
  if (hi > 21 && hi - lo !== 2) return `Above 21 both must be exactly 2 apart · e.g. ${lo+2}–${lo}`;
  return null;
}

function setGS(idx, k, v) {
  if (!admin) return;
  S.sched[idx][k] = v;
  const g = S.sched[idx];
  const err = scoreError(g.sa, g.sb);
  const errEl = document.getElementById(`gerr-${idx}`);
  if (errEl) { errEl.textContent = err || ''; errEl.style.display = err ? 'block' : 'none'; }
  if (!err) {
    updateKO();
    save();
    if (document.getElementById('page-standings').classList.contains('on')) renderStandings();
    if (document.getElementById('page-bracket').classList.contains('on')) renderBracket();
    renderStats();
  }
}

function setKS(ri, gi, k, v) {
  if (!admin) return;
  S.ko[ri][gi][k] = v;
  const g = S.ko[ri][gi];
  const err = scoreError(g.sa, g.sb);
  const errEl = document.getElementById(`kerr-${ri}-${gi}`);
  if (errEl) { errEl.textContent = err || ''; errEl.style.display = err ? 'block' : 'none'; }
  if (!err) {
    updateKO();
    save();
    if (document.getElementById('page-bracket').classList.contains('on')) renderBracket();
  }
}

// ============ SCHEDULE PAGE ============
function renderSchedulePage() { renderStats(); renderCourtFilter(); renderScheduleContent(); }

function renderStats() {
  const el = document.getElementById('sbar');
  if (!S.sched.length) { el.innerHTML = ''; return; }
  const ko = S.ko.reduce((s, r) => s + r.length, 0);
  const done = S.sched.filter(g => g.sa !== '' && g.sb !== '').length;
  const last = S.ko.length ? S.ko[S.ko.length-1][0] : S.sched[S.sched.length-1];
  const end = last ? addM(last.time, DUR()) : '--:--';
  el.innerHTML = `
    <div class="sc"><div class="sl">Pool Games</div><div class="sv">${done}/${S.sched.length}</div></div>
    <div class="sc"><div class="sl">Knockout Games</div><div class="sv">${ko}</div></div>
    <div class="sc"><div class="sl">Courts</div><div class="sv">${NC()}</div></div>
    <div class="sc"><div class="sl">Est. End</div><div class="sv a">${end}</div></div>`;
}

function renderCourtFilter() {
  const el = document.getElementById('court-filter');
  const courts = [1, 2, 3, 4].slice(0, NC());
  el.innerHTML = `<button class="cf-btn cf-all ${activeCourt === 'all' ? 'on' : ''}" onclick="setCourt('all')">All Courts</button>`
    + courts.map(c => `<button class="cf-btn cf-${c} ${activeCourt === c ? 'on' : ''}" onclick="setCourt(${c})">Court ${c}</button>`).join('');
}

function setCourt(c) { activeCourt = c; renderCourtFilter(); renderScheduleContent(); }

function renderScheduleContent() {
  const el = document.getElementById('schedule-content');
  if (!S.sched.length) {
    el.innerHTML = `<div class="empty"><h3>No schedule yet</h3><p>Go to Teams tab and click Generate Schedule</p></div>`;
    return;
  }
  el.innerHTML = '';

  // Group stage
  const groupGames = S.sched.filter(g => activeCourt === 'all' || g.court === activeCourt);
  if (groupGames.length) {
    const sec = document.createElement('div');
    sec.innerHTML = '<div class="sec-title">Pool Stage</div>';
    const bySlot = {};
    groupGames.forEach(g => { if (!bySlot[g.si]) bySlot[g.si] = []; bySlot[g.si].push(g); });
    Object.keys(bySlot).sort((a, b) => a - b).forEach(si => {
      const games = bySlot[si];
      const block = document.createElement('div'); block.className = 'tblock';
      block.innerHTML = `<div class="thdr"><span class="tlbl">${games[0].time}</span><div class="tline"></div></div>`;
      games.forEach(g => {
        const idx = S.sched.indexOf(g);
        const done = isValidScore(parseInt(g.sa), parseInt(g.sb));
        const pc = PILLS[(g.court-1) % 4];
        const err = scoreError(g.sa, g.sb);
        const wrap = document.createElement('div');
        const row = document.createElement('div');
        row.className = 'gc' + (done ? ' done' : '');
        row.innerHTML = `
          <span class="pill ${pc}">Court ${g.court}</span>
          <span class="gt">${g.a}<span class="gtag">${g.gn}</span></span>
          <span class="gvs">vs</span>
          <span class="gt r">${g.b}</span>
          <span class="sw">
            ${admin
              ? `<input class="si" type="number" min="0" max="99" placeholder="—" value="${g.sa}" onchange="setGS(${idx},'sa',this.value)"/>
                 <span class="ssep">:</span>
                 <input class="si" type="number" min="0" max="99" placeholder="—" value="${g.sb}" onchange="setGS(${idx},'sb',this.value)"/>`
              : `<span class="ssep">${done ? `${g.sa} : ${g.sb}` : '— : —'}</span>`}
          </span>`;
        wrap.appendChild(row);
        const errD = document.createElement('div');
        errD.id = `gerr-${idx}`; errD.className = 'score-err';
        errD.style.display = err ? 'block' : 'none'; errD.textContent = err || '';
        wrap.appendChild(errD);
        block.appendChild(wrap);
      });
      sec.appendChild(block);
    });
    el.appendChild(sec);
  }

  // KO stage
  if (S.ko.length) {
    const koGames = S.ko.flatMap((r, ri) => r.map((g, gi) => ({...g, ri, gi})))
      .filter(g => activeCourt === 'all' || g.court === activeCourt);
    if (koGames.length) {
      const sec = document.createElement('div');
      sec.innerHTML = '<div class="sec-title" style="margin-top:8px">Knockout Stage</div>';
      const byRound = {};
      koGames.forEach(g => { const k = `${g.ri}`; if (!byRound[k]) byRound[k] = []; byRound[k].push(g); });
      Object.keys(byRound).sort((a, b) => a - b).forEach(ri => {
        const games = byRound[ri];
        const rn = getKORoundName(parseInt(ri));
        const block = document.createElement('div'); block.className = 'tblock';
        block.innerHTML = `<div class="thdr"><span class="tlbl">${games[0].time}</span><div class="tline"></div><span class="rtag">${rn}</span></div>`;
        games.forEach(g => {
          const pc = PILLS[(g.court-1) % 4];
          const done = isValidScore(parseInt(g.sa), parseInt(g.sb));
          const err = scoreError(g.sa, g.sb);
          const wrap = document.createElement('div');
          const row = document.createElement('div');
          row.className = 'gc' + (done ? ' done' : '');
          row.innerHTML = `
            <span class="pill ${pc}">Court ${g.court}</span>
            <span class="gt">${g.a}</span>
            <span class="gvs">vs</span>
            <span class="gt r">${g.b}</span>
            <span class="sw">
              ${admin
                ? `<input class="si" type="number" min="0" placeholder="—" value="${g.sa}" onchange="setKS(${g.ri},${g.gi},'sa',this.value)"/>
                   <span class="ssep">:</span>
                   <input class="si" type="number" min="0" placeholder="—" value="${g.sb}" onchange="setKS(${g.ri},${g.gi},'sb',this.value)"/>`
                : `<span class="ssep">${done ? `${g.sa} : ${g.sb}` : '— : —'}</span>`}
            </span>`;
          wrap.appendChild(row);
          const errD = document.createElement('div');
          errD.id = `kerr-${g.ri}-${g.gi}`; errD.className = 'score-err';
          errD.style.display = err ? 'block' : 'none'; errD.textContent = err || '';
          wrap.appendChild(errD);
          block.appendChild(wrap);
        });
        sec.appendChild(block);
      });
      el.appendChild(sec);
    }
  }
}

// ============ KO UPDATE ============
function getKOWinner(game) {
  if (!game) return null;
  const sa = parseInt(game.sa), sb = parseInt(game.sb);
  if (isValidScore(sa, sb)) return sa > sb ? game.a : game.b;
  return null;
}

function updateKO() {
  if (!S.ko.length) return;
  const adv = S.cfg.advPerGroup;
  const ng = S.groups.length;

  const koSeeds = [];
  for (let rank = 1; rank <= adv; rank++)
    for (let g = 0; g < ng; g++)
      koSeeds.push(`${String.fromCharCode(65+g)}${rank}`);
  const nKO = koSeeds.length;
  const paired = [];
  for (let i = 0; i < nKO / 2; i++) paired.push([koSeeds[i], koSeeds[nKO-1-i]]);

  // Fill first KO round from pool standings
  if (S.ko[0]) {
    paired.forEach(([sA, sB], i) => {
      if (!S.ko[0][i]) return;
      const rA = resolvePoolSeed(sA);
      const rB = resolvePoolSeed(sB);
      S.ko[0][i].a = rA.known ? rA.label : sA;
      S.ko[0][i].b = rB.known ? rB.label : sB;
      S.ko[0][i].seedA = sA;
      S.ko[0][i].seedB = sB;
    });
  }

  // Fill subsequent rounds from previous round winners
  for (let ri = 1; ri < S.ko.length; ri++) {
    S.ko[ri].forEach((g, gi) => {
      const wa = getKOWinner(S.ko[ri-1][gi*2]);
      const wb = getKOWinner(S.ko[ri-1][gi*2+1]);
      const rndName = getKORoundName(ri-1);
      g.a = wa || `Winner of ${rndName} ${gi*2+1}`;
      g.b = wb || `Winner of ${rndName} ${gi*2+2}`;
    });
  }
}

function resolvePoolSeed(seed) {
  const m = String(seed || '').match(/^([A-Z])(\d+)$/);
  if (!m) return { label: seed || 'TBD', known: false };
  const gLetter = m[1];
  const rank = parseInt(m[2], 10);
  const gi = gLetter.charCodeAt(0) - 65;
  if (gi < 0 || gi >= S.groups.length) return { label: seed, known: false };
  const grp = S.groups[gi];
  const totalGames = (grp.teams.length * (grp.teams.length - 1)) / 2;
  const doneCnt = S.sched.filter(g => g.gi === gi && isValidScore(parseInt(g.sa), parseInt(g.sb))).length;
  const st = getStandings(gi);
  if (doneCnt !== totalGames || !st[rank-1]) return { label: seed, known: false };
  return { label: st[rank-1].name, known: true };
}

function getKORoundName(ri) {
  if (!S.ko[ri]) return '';
  const teamsInRound = S.ko[ri].length * 2;
  if (teamsInRound === 2)  return 'Final';
  if (teamsInRound === 4)  return 'Semifinals';
  if (teamsInRound === 8)  return 'Quarterfinals';
  if (teamsInRound === 16) return 'Round of 16';
  if (teamsInRound === 32) return 'Round of 32';
  return `Round of ${teamsInRound}`;
}

function getKOSeedPairForMatch(matchIndex) {
  const adv = S.cfg.advPerGroup || 1;
  const ng = S.groups.length;
  const koSeeds = [];
  for (let rank = 1; rank <= adv; rank++)
    for (let g = 0; g < ng; g++)
      koSeeds.push(`${String.fromCharCode(65+g)}${rank}`);
  const nKO = koSeeds.length;
  if (!nKO) return ['TBD', 'TBD'];
  return [koSeeds[matchIndex], koSeeds[nKO-1-matchIndex]];
}

// ============ BRACKET ============
const base = 52;

function renderBracket() {
  const tree = document.getElementById('btree');
  const champDiv = document.getElementById('champ-div');
  const info = document.getElementById('binfo');
  tree.innerHTML = ''; champDiv.innerHTML = '';

  const done = S.sched.filter(g => isValidScore(parseInt(g.sa), parseInt(g.sb))).length;
  const total = S.sched.length;
  info.innerHTML = !total
    ? 'Generate the schedule first to see the knockout bracket.'
    : `Pool stage: <span>${done}/${total} games played</span> — bracket updates live as scores are entered`;

  if (!S.ko.length) return;

  const adv = S.cfg.advPerGroup || 0;
  const ng = S.groups.length;
  const koSeeds2 = [];
  for (let rank = 1; rank <= adv; rank++)
    for (let g = 0; g < ng; g++)
      koSeeds2.push(`${String.fromCharCode(65+g)}${rank}`);
  const nKO2 = koSeeds2.length;
  const seedPairs2 = [];
  for (let i = 0; i < nKO2 / 2; i++) seedPairs2.push([koSeeds2[i], koSeeds2[nKO2-1-i]]);

  // Pool column
  const seedsCol = document.createElement('div');
  seedsCol.className = 'bround';
  seedsCol.innerHTML = '<div class="brnd-title">Pool</div>';
  const seedMatches = document.createElement('div');
  seedMatches.className = 'brnd-matches';
  seedPairs2.forEach((pair, pi) => {
    const wrap = document.createElement('div');
    wrap.className = 'bmatch-wrap';
    if (pi > 0) wrap.style.marginTop = '10px';
    const seedA = resolvePoolSeed(pair[0]);
    const seedB = resolvePoolSeed(pair[1]);
    const nameA = seedA.known ? seedA.label : pair[0];
    const nameB = seedB.known ? seedB.label : pair[1];
    wrap.innerHTML = `<div class="bmatch-box"><div class="bmatch bseed">
      <div class="bteam ${seedA.known ? '' : 'tbd'}"><span class="bname">${nameA}</span>${seedA.known ? `<span class="bsc seed-tag">${pair[0]}</span>` : ''}</div>
      <div class="bteam ${seedB.known ? '' : 'tbd'}"><span class="bname">${nameB}</span>${seedB.known ? `<span class="bsc seed-tag">${pair[1]}</span>` : ''}</div>
    </div></div>`;
    seedMatches.appendChild(wrap);
  });
  seedsCol.appendChild(seedMatches);
  tree.appendChild(seedsCol);

  // KO rounds
  S.ko.forEach((round, ri) => {
    const col = document.createElement('div');
    col.className = 'bround';
    col.innerHTML = `<div class="brnd-title">${getKORoundName(ri)}</div>`;
    const matchesEl = document.createElement('div');
    matchesEl.className = 'brnd-matches';
    const spacer = ri === 0 ? 10 : (Math.pow(2,ri)-1)*base + (Math.pow(2,ri-1)-1)*10;

    round.forEach((g, gi) => {
      const wrap = document.createElement('div');
      wrap.className = 'bmatch-wrap';
      if (gi > 0) wrap.style.marginTop = spacer + 'px';

      const sa = parseInt(g.sa), sb = parseInt(g.sb);
      const hs = isValidScore(sa, sb);
      const wa = hs && sa > sb, wb = hs && sb > sa;

      let labelA, labelB, codeA = '', codeB = '', knownA = false, knownB = false;

      if (ri === 0) {
        const pair = getKOSeedPairForMatch(gi);
        const seedA = resolvePoolSeed(pair[0]);
        const seedB = resolvePoolSeed(pair[1]);
        labelA = seedA.known ? seedA.label : pair[0];
        labelB = seedB.known ? seedB.label : pair[1];
        codeA = seedA.known ? pair[0] : '';
        codeB = seedB.known ? pair[1] : '';
        knownA = seedA.known;
        knownB = seedB.known;
      } else {
        const sourceRound = getKORoundName(ri-1);
        labelA = g.a && !g.a.startsWith('Winner of') ? g.a : `Winner of ${sourceRound} ${gi*2+1}`;
        labelB = g.b && !g.b.startsWith('Winner of') ? g.b : `Winner of ${sourceRound} ${gi*2+2}`;
        knownA = !!(g.a && !g.a.startsWith('Winner of'));
        knownB = !!(g.b && !g.b.startsWith('Winner of'));
      }

      const box = document.createElement('div');
      box.className = 'bmatch-box';
      box.innerHTML = `<div class="bmatch">
        <div class="bteam ${wa ? 'win' : ''} ${knownA ? '' : 'tbd'}">
          <span class="bname">${labelA}</span>
          ${codeA ? `<span class="bsc seed-tag">${codeA}</span>` : ''}
          ${hs ? `<span class="bsc">${g.sa}</span>` : ''}
        </div>
        <div class="bteam ${wb ? 'win' : ''} ${knownB ? '' : 'tbd'}">
          <span class="bname">${labelB}</span>
          ${codeB ? `<span class="bsc seed-tag">${codeB}</span>` : ''}
          ${hs ? `<span class="bsc">${g.sb}</span>` : ''}
        </div>
      </div>`;
      wrap.appendChild(box);
      matchesEl.appendChild(wrap);
    });
    col.appendChild(matchesEl);
    tree.appendChild(col);
  });

  // Champion
  const fin = S.ko[S.ko.length-1][0];
  if (fin) {
    const sa = parseInt(fin.sa), sb = parseInt(fin.sb);
    if (isValidScore(sa, sb)) {
      const w = sa > sb ? fin.a : fin.b;
      champDiv.innerHTML = `<div class="champ-wrap"><div class="ci">🏆</div><h2>Champion</h2><div class="champ-name">${w}</div></div>`;
    }
  }
}

// ============ SETTINGS ============
const SETT_LIMITS = {
  numCouples: [4, 64], courts: [1, 8], numGroups: [2, 16],
  advPerGroup: [1, 8], gameDur: [10, 120], breakDur: [0, 60]
};

function adjSetting(key, delta) {
  if (!admin) return;
  const [mn, mx] = SETT_LIMITS[key];
  S.cfg[key] = Math.min(mx, Math.max(mn, (S.cfg[key] || mn) + delta));
  save(); renderSettings();
}

function updateTimeSetting(key, val) {
  if (!admin) return;
  S.cfg[key] = val; save(); renderSettings();
}

// Distribute nc couples into ng groups as evenly as possible
// Extra couples go to first groups
function distributeGroups(nc, ng) {
  const base = Math.floor(nc / ng);
  const extra = nc % ng;
  const sizes = [];
  for (let i = 0; i < ng; i++) sizes.push(base + (i < extra ? 1 : 0));
  return sizes;
}

function renderSettings() {
  const ng = S.cfg.numGroups || 8;
  const nc = S.cfg.numCouples || 26;
  ['numCouples','courts','numGroups','advPerGroup','gameDur','breakDur'].forEach(k => {
    const el = document.getElementById('disp-'+k);
    if (el) el.textContent = S.cfg[k];
  });
  const ti = document.getElementById('inp-startTime');
  if (ti) ti.value = S.cfg.startTime;

  const sizes = distributeGroups(nc, ng);
  const totalGroupGames = sizes.reduce((s, sz) => s + (sz * (sz-1)) / 2, 0);
  const koTeams = Math.max(0, ng * (S.cfg.advPerGroup || 0));
  const koGames = koTeams > 1 ? (koTeams - 1) : 0;
  const totalGames = totalGroupGames + koGames;
  const slot = S.cfg.gameDur + S.cfg.breakDur;
  const parallelSlots = Math.ceil(totalGroupGames / S.cfg.courts);
  const [sh, sm] = S.cfg.startTime.split(':').map(Number);
  const endMins = sh*60 + sm + parallelSlots * slot + koGames * slot;
  const endH = String(Math.floor(endMins/60)%24).padStart(2,'0');
  const endM = String(endMins%60).padStart(2,'0');
  document.getElementById('sett-preview').innerHTML = `
    <div class="sett-preview-grid">
      <div class="prev-item"><div class="prev-label">Groups</div><div class="prev-val">${ng}</div></div>
      <div class="prev-item"><div class="prev-label">Group games</div><div class="prev-val">${totalGroupGames}</div></div>
      <div class="prev-item"><div class="prev-label">KO games</div><div class="prev-val">${koGames}</div></div>
      <div class="prev-item"><div class="prev-label">Total games</div><div class="prev-val">${totalGames}</div></div>
      <div class="prev-item"><div class="prev-label">Start</div><div class="prev-val">${S.cfg.startTime}</div></div>
      <div class="prev-item accent"><div class="prev-label">Est. end</div><div class="prev-val">${endH}:${endM}</div></div>
    </div>`;
}

function applySettings() {
  if (!admin) return;
  const ng = S.cfg.numGroups || 8;
  const nc = S.cfg.numCouples || 26;
  S.cfg.advPerGroup = Math.min(Math.max(S.cfg.advPerGroup || 1, 1), 4);
  const allTeams = S.groups.flatMap(g => g.teams).filter(t => t && t !== 'TBD / TBD');
  while (allTeams.length < nc) allTeams.push('TBD / TBD');
  const trimmed = allTeams.slice(0, nc);
  const sizes = distributeGroups(nc, ng);
  const newGroups = [];
  let idx = 0;
  for (let g = 0; g < ng; g++) {
    newGroups.push({ name: String.fromCharCode(65+g), teams: trimmed.slice(idx, idx + sizes[g]) });
    idx += sizes[g];
  }
  S.groups = newGroups; S.sched = []; S.ko = [];
  save(); generateSchedule();
}

function resetAll() {
  if (!admin) return;
  if (!confirm('Reset all scores and regenerate the full schedule?')) return;
  S.sched.forEach(g => { g.sa = ''; g.sb = ''; });
  S.ko.forEach(r => r.forEach(g => { g.sa = ''; g.sb = ''; }));
  save(); generateSchedule();
}

// ============ EXPOSE GLOBALS ============
Object.assign(window, {
  adminClick, tryLogin, closeLogin, goPage,
  openEdit, closeEdit, saveEdit, addTeam, deleteTeam,
  generateSchedule, setGS, setKS, setCourt,
  adjSetting, updateTimeSetting, applySettings, resetAll
});

// ============ BOOT ============
window.addEventListener('load', async () => {
  load();
  refreshA();
  renderAll();
  await loadInitialCloudState();
  renderAll();
});
