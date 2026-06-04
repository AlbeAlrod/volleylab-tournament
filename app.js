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
const WOMEN_REF = doc(db, "tournaments", "women2");
const MEN_REF   = doc(db, "tournaments", "men2");
const STORE = 'vl25b_v3';

let firebaseReady = false;
let applyingRemoteState = false;
let syncIndicator = null;

// ============ FIREBASE HELPERS ============
function setSyncStatus(ok) {
  if (!syncIndicator) syncIndicator = document.getElementById('sync-indicator');
  if (!syncIndicator) return;
  syncIndicator.className = ok ? 'sync-dot sync-ok' : 'sync-dot sync-err';
  syncIndicator.title = ok ? 'Synced' : 'Sync error';
}

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

function divStateToFirebase(ds) {
  return { groups: ds.groups, sched: ds.sched, ko: koToFirebase(ds.ko), cfg: ds.cfg };
}

function divStateFromFirebase(data, defCfg) {
  return {
    groups: data.groups && data.groups.length ? data.groups : null,
    sched:  data.sched  || [],
    ko:     koFromFirebase(data.ko),
    cfg:    data.cfg    || { ...defCfg }
  };
}

async function pushStateToCloud() {
  if (!firebaseReady || applyingRemoteState) return;
  try {
    await setDoc(WOMEN_REF, { state: divStateToFirebase(S.women), updatedAt: serverTimestamp() }, { merge: true });
    await setDoc(MEN_REF,   { state: divStateToFirebase(S.men),   updatedAt: serverTimestamp() }, { merge: true });
    setSyncStatus(true);
  } catch (err) {
    console.error("Firebase save error:", err);
    setSyncStatus(false);
  }
}

async function loadInitialCloudState() {
  try {
    const [snapW, snapM] = await Promise.all([getDoc(WOMEN_REF), getDoc(MEN_REF)]);
    applyingRemoteState = true;
    if (snapW.exists() && snapW.data().state) {
      const remote = divStateFromFirebase(snapW.data().state, DEF_CFG_WOMEN);
      if (remote.groups) S.women.groups = remote.groups;
      S.women.sched = remote.sched;
      S.women.ko    = remote.ko;
      S.women.cfg   = remote.cfg;
    }
    if (snapM.exists() && snapM.data().state) {
      const remote = divStateFromFirebase(snapM.data().state, DEF_CFG_MEN);
      if (remote.groups) S.men.groups = remote.groups;
      S.men.sched = remote.sched;
      S.men.ko    = remote.ko;
      S.men.cfg   = remote.cfg;
    }
    localStorage.setItem(STORE, JSON.stringify(S));
    applyingRemoteState = false;
    firebaseReady = true;
    if (!snapW.exists() || !snapM.exists()) await pushStateToCloud();
  } catch (err) {
    console.error("Firebase load error:", err);
  } finally {
    firebaseReady = true;
  }
}

onSnapshot(WOMEN_REF, snap => {
  if (!snap.exists() || !snap.data().state || applyingRemoteState) return;
  applyingRemoteState = true;
  const remote = divStateFromFirebase(snap.data().state, DEF_CFG_WOMEN);
  if (remote.groups) S.women.groups = remote.groups;
  S.women.sched = remote.sched;
  S.women.ko    = remote.ko;
  S.women.cfg   = remote.cfg;
  localStorage.setItem(STORE, JSON.stringify(S));
  applyingRemoteState = false;
  renderAll(); setSyncStatus(true);
});

onSnapshot(MEN_REF, snap => {
  if (!snap.exists() || !snap.data().state || applyingRemoteState) return;
  applyingRemoteState = true;
  const remote = divStateFromFirebase(snap.data().state, DEF_CFG_MEN);
  if (remote.groups) S.men.groups = remote.groups;
  S.men.sched = remote.sched;
  S.men.ko    = remote.ko;
  S.men.cfg   = remote.cfg;
  localStorage.setItem(STORE, JSON.stringify(S));
  applyingRemoteState = false;
  renderAll(); setSyncStatus(true);
});

// ============ CONSTANTS ============
const PILLS = ['p1','p2','p3','p4'];
const PW = 'volleylab';

const DEF_CFG_WOMEN = { numCouples:10, courts:2, numGroups:2, advPerGroup:2, startTime:'07:00', gameDur:30, breakDur:0, courtOffset:0 };
const DEF_CFG_MEN   = { numCouples:16, courts:2, numGroups:4, advPerGroup:2, startTime:'07:00', gameDur:30, breakDur:0, courtOffset:2 };

// Hebrew names, English UI
const DEFAULT_WOMEN_GROUPS = [
  { name:'A', teams:['דניאל גלר / דנה כהן','איה שמואלי / נויה שטיר','רני / טטי','ענבל / ליאל','לימור / שמרית'] },
  { name:'B', teams:['לורי סאזוואן / נוי מימון','דנה בובי / נועה ביידץ','אורטל / דיקלה','אפרת / ירדן','קארן ארמוני / קרין'] }
];

const DEFAULT_MEN_GROUPS = [
  { name:'A', teams:['רוי רביד / דרור','אליאור כהן / זאב כהן','גל יואל סדן / עומרי בנדולי','שחף מויאל / רז גולדשטיין'] },
  { name:'B', teams:['שהם / אריק לייקין','רענן בראשה / סער דנון','אלון כהן / רועי כהן','אור תובי / אביעז'] },
  { name:'C', teams:['תום בכר / דניאל קינן','הלל / אורי','אלעד / חנן','? / שגיא לוי'] },
  { name:'D', teams:['מתן שפירא / עדן לוי','רועי מסלטון / ירין בית דגן','מקס דוד טרו / ואסילי ליאונטייב','דור אביטל / תומר אימבר'] }
];

// ============ STATE ============
let S = {
  women: { groups: JSON.parse(JSON.stringify(DEFAULT_WOMEN_GROUPS)), sched: [], ko: [], cfg: {...DEF_CFG_WOMEN} },
  men:   { groups: JSON.parse(JSON.stringify(DEFAULT_MEN_GROUPS)),   sched: [], ko: [], cfg: {...DEF_CFG_MEN}   }
};

let activeDiv   = 'all';
let editTarget  = null;
let activeCourt = 'all';
let schedFilter = '';   // team name filter on schedule page
let admin = false;

// ============ LOCAL STORAGE ============
function load() {
  try {
    const d = localStorage.getItem(STORE);
    if (d) {
      const parsed = JSON.parse(d);
      if (parsed.women) {
        if (!parsed.women.cfg) parsed.women.cfg = {...DEF_CFG_WOMEN};
        if (parsed.women.groups && parsed.women.groups.length) S.women.groups = parsed.women.groups;
        S.women.sched = parsed.women.sched || [];
        S.women.ko    = parsed.women.ko    || [];
        S.women.cfg   = parsed.women.cfg;
      }
      if (parsed.men) {
        if (!parsed.men.cfg) parsed.men.cfg = {...DEF_CFG_MEN};
        if (parsed.men.groups && parsed.men.groups.length) S.men.groups = parsed.men.groups;
        S.men.sched = parsed.men.sched || [];
        S.men.ko    = parsed.men.ko    || [];
        S.men.cfg   = parsed.men.cfg;
      }
    }
  } catch(e) {}
}

function save() {
  try { localStorage.setItem(STORE, JSON.stringify(S)); } catch(e) {}
  pushStateToCloud();
}

// ============ TIME UTILS ============
function t2m(t) { const [h,m] = (t||'00:00').split(':').map(Number); return h*60+m; }
function m2t(m) { return `${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`; }
function addM(t, m) { return m2t(t2m(t)+m); }

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
  if (hi === 21 && hi - lo < 2) return `Need 2-point lead · e.g. 21–${21-2}`;
  if (hi > 21 && hi - lo !== 2) return `Above 21: exactly 2 apart · e.g. ${lo+2}–${lo}`;
  return null;
}

// ============ ROUND NAME ============
function roundName(count) {
  if (count === 2)  return 'Final';
  if (count === 4)  return 'Semifinals';
  if (count === 8)  return 'Quarterfinals';
  if (count === 16) return 'Round of 16';
  if (count === 32) return 'Round of 32';
  return `Round of ${count}`;
}

function getKORoundName(div, ri) {
  const ko = S[div] && S[div].ko;
  if (!ko || !ko[ri]) return '';
  return roundName(ko[ri].length * 2);
}

// ============ ACTIVE DIVISIONS ============
function getActiveDivs() {
  return activeDiv === 'all' ? ['women','men'] : [activeDiv];
}

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
  const settEl = document.getElementById('page-settings');
  document.body.classList.toggle('admin-mode', admin);
  if (txt)  txt.textContent  = admin ? 'Admin on' : 'Admin';
  if (btn)  btn.classList.toggle('on', admin);
  if (bar)  bar.className = 'mode-bar ' + (admin ? 'mode-admin' : 'mode-view');
  if (mtxt) mtxt.textContent = admin
    ? 'Admin mode — you can edit teams, scores and settings'
    : 'View only — tap Admin to manage the tournament';
  if (settEl && !admin && settEl.classList.contains('on')) goPage('standings');
}

function rerender() {
  renderDivFilter();
  renderStageBar();
  const pages = ['standings','schedule','bracket','settings'];
  const active = pages.find(p => {
    const el = document.getElementById('page-'+p);
    return el && el.classList.contains('on');
  });
  if (active === 'standings') renderStandings();
  if (active === 'schedule')  renderSchedulePage();
  if (active === 'bracket')   { updateKO(); renderBracket(); }
  if (active === 'settings')  renderSettings();
  renderStats();
}

function renderAll() {
  refreshA();
  renderDivFilter();
  renderStageBar();
  renderStandings();
  renderSchedulePage();
  updateKO();
  renderBracket();
  renderSettings();
  renderStats();
}

// ============ DIVISION FILTER ============
function setDiv(d) {
  activeDiv = d;
  activeCourt = 'all';
  schedFilter = '';
  const inp = document.getElementById('sched-search');
  if (inp) inp.value = '';
  renderDivFilter();
  rerender();
}

function renderDivFilter() {
  ['all','women','men'].forEach(d => {
    const btn = document.getElementById('df-' + d);
    if (btn) btn.classList.toggle('on', activeDiv === d);
  });
}

// ============ STAGE BAR ============
function renderStageBar() {
  const bar = document.getElementById('stage-bar');
  if (!bar) return;
  const div = getActiveDivs()[0];
  const DS = S[div];
  const poolDone = DS.sched.length > 0 && DS.sched.every(g => isValidScore(parseInt(g.sa), parseInt(g.sb)));
  const koProgress = DS.ko.map(round => round.every(g => isValidScore(parseInt(g.sa), parseInt(g.sb))));
  const steps = ['Pool Stage'];
  DS.ko.forEach((_, ri) => steps.push(getKORoundName(div, ri)));
  let cur = 0;
  if (DS.sched.length === 0) cur = 0;
  else if (!poolDone) cur = 0;
  else { cur = 1; koProgress.forEach((done, i) => { if (done) cur = i+2; }); }
  bar.innerHTML = steps.map((s, i) => `
    <div class="stage-step">
      ${i > 0 ? '<div class="stage-arrow"></div>' : ''}
      <div class="stage-pill ${i < cur ? 'done' : i === cur ? 'active' : ''}">${s}</div>
    </div>`).join('');
}

// ============ NAV ============
function goPage(p) {
  if (p === 'settings' && !admin) p = 'standings';
  if (p === 'teams') p = 'standings';
  document.querySelectorAll('.pg').forEach(e => e.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(e => e.classList.remove('on'));
  const pageEl = document.getElementById('page-'+p);
  if (!pageEl) return;
  pageEl.classList.add('on');
  const tab = document.getElementById('tab-'+p);
  if (tab) tab.classList.add('on');
  if (p === 'standings') renderStandings();
  if (p === 'schedule')  renderSchedulePage();
  if (p === 'bracket')   { updateKO(); renderBracket(); }
  if (p === 'settings')  renderSettings();
}

// ============ TEAMS PAGE ============
function makeGroupCard(div, grp, gi) {
  const badge = `<span class="ghead-div-tag">${div === 'women' ? 'W' : 'M'}</span>`;
  const card = document.createElement('div');
  card.className = 'group-card';
  const teamsHTML = grp.teams.map((t, ti) => `
    <div class="team-item" id="titem-${div}-${gi}-${ti}">
      <span class="team-rank">${ti+1}</span>
      <span class="team-name-display" id="tname-${div}-${gi}-${ti}">${t}</span>
      ${admin ? `<button class="gedit-btn" onclick="openEdit('${div}',${gi},${ti})">Edit</button>
      <button class="team-del" onclick="deleteTeam('${div}',${gi},${ti})">&#215;</button>` : ''}
    </div>`).join('');
  card.innerHTML = `
    <div class="group-head">
      <span class="gname">GROUP ${grp.name}</span>
      ${badge}
    </div>
    <div class="team-list" id="tlist-${div}-${gi}">${teamsHTML}</div>
    ${admin ? `<div class="add-team-row">
      <input class="add-team-input" id="new-team-${div}-${gi}" placeholder="Add couple (e.g. Dana / Avi)"
        onkeydown="if(event.key==='Enter')addTeam('${div}',${gi})"/>
      <button class="add-team-btn" onclick="addTeam('${div}',${gi})">+ Add couple</button>
    </div>` : ''}`;
  return card;
}

function renderTeams(highlight) {
  const grid = document.getElementById('teams-grid');
  if (!grid) return;
  grid.innerHTML = '';

  if (activeDiv === 'all') {
    ['women','men'].forEach(div => {
      const hdr = document.createElement('div');
      hdr.className = 'div-section-header';
      hdr.textContent = div === 'women' ? 'WOMEN' : 'MEN';
      grid.appendChild(hdr);
      const subGrid = document.createElement('div');
      subGrid.className = 'groups-subgrid';
      S[div].groups.forEach((grp, gi) => {
        if (highlight && !grp.teams.some(t => t.toLowerCase().includes(highlight.toLowerCase()))) return;
        subGrid.appendChild(makeGroupCard(div, grp, gi));
      });
      grid.appendChild(subGrid);
    });
  } else {
    const DS = S[activeDiv];
    const subGrid = document.createElement('div');
    subGrid.className = 'groups-subgrid';
    DS.groups.forEach((grp, gi) => {
      if (highlight && !grp.teams.some(t => t.toLowerCase().includes(highlight.toLowerCase()))) return;
      subGrid.appendChild(makeGroupCard(activeDiv, grp, gi));
    });
    grid.appendChild(subGrid);
  }
}

function openEdit(div, gi, ti) {
  if (!admin) return;
  editTarget = {div, gi, ti};
  const name = S[div].groups[gi].teams[ti];
  const parts = name.split('/').map(s => s.trim());
  document.getElementById('edit-p1').value = parts[0] || '';
  document.getElementById('edit-p2').value = parts[1] || '';
  document.getElementById('edit-modal-title').textContent = `Edit — Group ${S[div].groups[gi].name}`;
  document.getElementById('edit-modal').classList.remove('h');
  document.getElementById('edit-p1').focus();
}

function closeEdit() { document.getElementById('edit-modal').classList.add('h'); editTarget = null; }

function saveEdit() {
  if (!admin || !editTarget) return;
  const {div, gi, ti} = editTarget;
  const p1 = document.getElementById('edit-p1').value.trim();
  const p2 = document.getElementById('edit-p2').value.trim();
  const name = p2 ? `${p1} / ${p2}` : p1;
  if (!name) return;
  const old = S[div].groups[gi].teams[ti];
  S[div].groups[gi].teams[ti] = name;
  S[div].sched.forEach(g => { if (g.a === old) g.a = name; if (g.b === old) g.b = name; });
  S[div].ko.forEach(r => r.forEach(g => { if (g.a === old) g.a = name; if (g.b === old) g.b = name; }));
  closeEdit(); save(); renderTeams();
}

function addTeam(div, gi) {
  if (!admin) return;
  const inp = document.getElementById(`new-team-${div}-${gi}`);
  if (!inp) return;
  const name = inp.value.trim();
  if (!name) return;
  S[div].groups[gi].teams.push(name);
  inp.value = '';
  save(); renderTeams();
}

function deleteTeam(div, gi, ti) {
  if (!admin) return;
  if (S[div].groups[gi].teams.length <= 1) { alert('Each pool needs at least 1 team'); return; }
  S[div].groups[gi].teams.splice(ti, 1);
  save(); renderTeams();
}

// ============ SCHEDULE SEARCH ============
function filterTeams() { filterSchedule(); }   // alias kept for window export

function filterSchedule() {
  const inp = document.getElementById('sched-search');
  const query = (inp ? inp.value : '').trim().toLowerCase();

  if (!query) {
    schedFilter = '';
    renderScheduleContent();
    return;
  }

  // Find first matching team across active divisions
  const divs = getActiveDivs();
  let found = null;
  outer:
  for (const div of divs) {
    for (const grp of S[div].groups) {
      for (const t of grp.teams) {
        if (t.toLowerCase().includes(query)) { found = t; break outer; }
      }
    }
  }

  schedFilter = found || '';
  renderScheduleContent();
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

function generateScheduleForDiv(div) {
  const DS = S[div];
  const cfg = DS.cfg;
  const slotDur = cfg.gameDur + cfg.breakDur;
  const nc = cfg.courts || 2;
  const offset = cfg.courtOffset || 0;

  // Each pool gets a fixed court: pool gi → court (gi % nc) + 1 + offset
  // Pools cycle through courts if there are more pools than courts
  const courtQueues = {};
  DS.groups.forEach((grp, gi) => {
    const court = (gi % nc) + 1 + offset;
    if (!courtQueues[court]) courtQueues[court] = [];
    rr(grp.teams).forEach(([a, b]) => {
      courtQueues[court].push({ type:'g', div, gi, gn:grp.name, a, b, sa:'', sb:'', court });
    });
  });

  const courts = Object.keys(courtQueues).map(Number).sort((a,b) => a-b);
  const maxGames = Math.max(...courts.map(c => courtQueues[c].length));

  // Schedule: each slot runs one game per court in parallel
  const scheduled = [];
  for (let si = 0; si < maxGames; si++) {
    courts.forEach(court => {
      if (si < courtQueues[court].length) {
        const g = courtQueues[court][si];
        g.si   = si;
        g.time = addM(cfg.startTime, si * slotDur);
        scheduled.push(g);
      }
    });
  }
  DS.sched = scheduled;

  // ---- KO bracket ----
  const adv = cfg.advPerGroup || 0;
  const ng  = DS.groups.length;
  if (adv < 1) { DS.ko = []; return; }

  const koSeeds = [];
  for (let rank = 1; rank <= adv; rank++)
    for (let g = 0; g < ng; g++)
      koSeeds.push(`${String.fromCharCode(65+g)}${rank}`);

  let bracketSize = 1;
  while (bracketSize < koSeeds.length) bracketSize *= 2;
  while (koSeeds.length < bracketSize) koSeeds.push('TBD');

  DS.ko = [];
  const lastSi = scheduled.length ? Math.max(...scheduled.map(g => g.si)) : 0;
  let rs = lastSi + 1;

  const firstRound = [];
  for (let i = 0; i < bracketSize / 2; i++) {
    const aSeed = koSeeds[i], bSeed = koSeeds[bracketSize - 1 - i];
    firstRound.push({ a:aSeed, b:bSeed, seedA:aSeed, seedB:bSeed, sa:'', sb:'', div });
  }
  firstRound.forEach((g, gi) => {
    g.court = (gi % nc) + 1 + offset;
    g.si    = rs + Math.floor(gi / nc);
    g.time  = addM(cfg.startTime, g.si * slotDur);
  });
  rs += Math.ceil(firstRound.length / 2);
  DS.ko.push(firstRound);

  let matches = firstRound.length / 2;
  while (matches >= 1) {
    const prevName = getKORoundName(div, DS.ko.length - 1);
    const round = [];
    for (let i = 0; i < matches; i++) {
      round.push({
        a: `Winner of ${prevName} ${i*2+1}`,
        b: `Winner of ${prevName} ${i*2+2}`,
        sa: '', sb: '', div,
        court: (i % nc) + 1 + offset,
        si:    rs + Math.floor(i / nc),
        time:  addM(cfg.startTime, (rs + Math.floor(i / nc)) * slotDur)
      });
    }
    rs += Math.ceil(round.length / 2);
    DS.ko.push(round);
    matches = Math.floor(matches / 2);
  }
}

function generateSchedule() {
  if (!admin) return;
  getActiveDivs().forEach(div => generateScheduleForDiv(div));
  save();
  goPage('schedule');
}

// ============ STANDINGS ============
function getStandings(div, gi) {
  const DS = S[div];
  const grp = DS.groups[gi];
  const rec = {};
  grp.teams.forEach(t => rec[t] = {w:0, l:0, pts:0, scored:0, against:0});
  DS.sched.filter(g => g.type === 'g' && g.gi === gi).forEach(g => {
    const sa = parseInt(g.sa), sb = parseInt(g.sb);
    if (!isNaN(sa) && !isNaN(sb) && g.sa !== '' && g.sb !== '') {
      if (rec[g.a]) { rec[g.a].scored += sa; rec[g.a].against += sb; }
      if (rec[g.b]) { rec[g.b].scored += sb; rec[g.b].against += sa; }
      if (sa > sb) {
        if (rec[g.a]) { rec[g.a].w++; rec[g.a].pts+=2; }
        if (rec[g.b]) { rec[g.b].l++; rec[g.b].pts+=1; }
      } else if (sb > sa) {
        if (rec[g.b]) { rec[g.b].w++; rec[g.b].pts+=2; }
        if (rec[g.a]) { rec[g.a].l++; rec[g.a].pts+=1; }
      }
    }
  });
  return grp.teams.map(t => ({name:t, ...rec[t], diff:(rec[t].scored-rec[t].against)}))
    .sort((a, b) => {
      if (b.pts  !== a.pts)  return b.pts  - a.pts;
      if (b.w    !== a.w)    return b.w    - a.w;
      if (b.diff !== a.diff) return b.diff - a.diff;
      return b.scored - a.scored;
    });
}

function makeStandingsCard(div, grp, gi) {
  const DS = S[div];
  const adv = DS.cfg.advPerGroup || 1;
  const st  = getStandings(div, gi);
  const played = DS.sched.filter(g => g.gi === gi && isValidScore(parseInt(g.sa), parseInt(g.sb))).length;
  const badge  = `<span class="ghead-div-tag">${div === 'women' ? 'W' : 'M'}</span>`;
  const card   = document.createElement('div');
  card.className = 'scard';
  const rows = st.map((t, i) => {
    const isWinner = i < adv && played > 0;
    const diff = t.diff || 0;
    const diffStr = diff > 0 ? `+${diff}` : String(diff);
    const diffClass = diff > 0 ? 'diff-pos' : diff < 0 ? 'diff-neg' : 'diff-zero';
    return `<tr class="${isWinner ? 'winner' : ''}">
      <td><span class="rnk">#${i+1}</span>${t.name}</td>
      <td>${t.w}</td><td>${t.l}</td>
      <td class="${diffClass}">${diff !== 0 || t.w > 0 || t.l > 0 ? diffStr : '—'}</td>
      <td class="pts-val">${t.pts}</td>
    </tr>`;
  }).join('');
  card.innerHTML = `<div class="scard-head">
      <span class="scard-name">GROUP ${grp.name}</span>
      ${badge}
    </div>
    <table class="stbl">
      <thead><tr><th>Team</th><th>W</th><th>L</th><th>+/−</th><th>Pts</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  return card;
}

function renderStandings() {
  const grid = document.getElementById('standings-grid');
  if (!grid) return;
  grid.innerHTML = '';

  if (activeDiv === 'all') {
    ['women','men'].forEach(div => {
      const hdr = document.createElement('div');
      hdr.className = 'div-section-header';
      hdr.textContent = div === 'women' ? 'WOMEN' : 'MEN';
      grid.appendChild(hdr);
      const sub = document.createElement('div');
      sub.className = 'stnds-subgrid';
      S[div].groups.forEach((grp, gi) => sub.appendChild(makeStandingsCard(div, grp, gi)));
      grid.appendChild(sub);
    });
  } else {
    const DS  = S[activeDiv];
    const sub = document.createElement('div');
    sub.className = 'stnds-subgrid';
    DS.groups.forEach((grp, gi) => sub.appendChild(makeStandingsCard(activeDiv, grp, gi)));
    grid.appendChild(sub);
  }
}

// ============ SCORE SETTERS ============
function setGS(div, idx, k, v) {
  if (!admin) return;
  S[div].sched[idx][k] = v;
  const g   = S[div].sched[idx];
  const err = scoreError(g.sa, g.sb);
  const errEl = document.getElementById(`gerr-${div}-${idx}`);
  if (errEl) { errEl.textContent = err || ''; errEl.style.display = err ? 'block' : 'none'; }
  if (!err) {
    updateKOForDiv(div);
    save();
    if (document.getElementById('page-standings').classList.contains('on')) renderStandings();
    if (document.getElementById('page-bracket').classList.contains('on')) renderBracket();
    renderStats();
  }
}

function setKS(div, ri, gi, k, v) {
  if (!admin) return;
  S[div].ko[ri][gi][k] = v;
  const g   = S[div].ko[ri][gi];
  const err = scoreError(g.sa, g.sb);
  const errEl = document.getElementById(`kerr-${div}-${ri}-${gi}`);
  if (errEl) { errEl.textContent = err || ''; errEl.style.display = err ? 'block' : 'none'; }
  if (!err) {
    updateKOForDiv(div);
    save();
    if (document.getElementById('page-bracket').classList.contains('on')) renderBracket();
  }
}

// ============ SCHEDULE PAGE ============
function renderSchedulePage() { renderStats(); renderCourtFilter(); renderScheduleContent(); }

function renderStats() {
  const el = document.getElementById('sbar');
  if (!el) return;
  const divs = getActiveDivs();
  let totalPool = 0, donePool = 0, totalKO = 0;
  let lastTime = '07:00', lastDur = 30;

  divs.forEach(div => {
    const DS = S[div];
    totalPool += DS.sched.length;
    donePool  += DS.sched.filter(g => isValidScore(parseInt(g.sa), parseInt(g.sb))).length;
    totalKO   += DS.ko.reduce((s, r) => s + r.length, 0);
    const src  = DS.ko.length ? DS.ko[DS.ko.length-1] : null;
    const last = src ? src[0] : (DS.sched.length ? DS.sched[DS.sched.length-1] : null);
    if (last && t2m(last.time||'00:00') > t2m(lastTime)) {
      lastTime = last.time; lastDur = DS.cfg.gameDur;
    }
  });

  if (!totalPool) { el.innerHTML = ''; return; }
  const end = addM(lastTime, lastDur);
  el.innerHTML = `
    <div class="sc"><div class="sl">Pool Games</div><div class="sv">${donePool}/${totalPool}</div></div>
    <div class="sc"><div class="sl">KO Games</div><div class="sv">${totalKO}</div></div>
    <div class="sc"><div class="sl">Courts</div><div class="sv">${divs.length === 2 ? '4' : '2'}</div></div>
    <div class="sc"><div class="sl">Est. End</div><div class="sv a">${end}</div></div>`;
}

function renderCourtFilter() {
  const el = document.getElementById('court-filter');
  if (!el) return;
  const courts = new Set();
  getActiveDivs().forEach(div => {
    const offset = S[div].cfg.courtOffset || 0;
    for (let i = 1; i <= (S[div].cfg.courts || 2); i++) courts.add(i + offset);
  });
  const sorted = [...courts].sort((a, b) => a - b);
  el.innerHTML = `<button class="cf-btn cf-all ${activeCourt === 'all' ? 'on' : ''}" onclick="setCourt('all')">All Courts</button>`
    + sorted.map(c => `<button class="cf-btn cf-${c} ${activeCourt === c ? 'on' : ''}" onclick="setCourt(${c})">Court ${c}</button>`).join('');
}

function setCourt(c) { activeCourt = c; renderCourtFilter(); renderScheduleContent(); }

// Build a single game row element
function buildGameRow(div, g, idx, isKO) {
  const done = isValidScore(parseInt(g.sa), parseInt(g.sb));
  const pc   = PILLS[(g.court-1) % 4];
  const err  = scoreError(g.sa, g.sb);
  const wrap = document.createElement('div');
  const row  = document.createElement('div');
  row.className = 'gc' + (done ? ' done' : '');
  if (isKO) {
    row.innerHTML = `
      <span class="pill ${pc}">Court ${g.court}</span>
      <span class="gt">${g.a}</span>
      <span class="gvs">vs</span>
      <span class="gt r">${g.b}</span>
      <span class="sw">
        ${admin
          ? `<input class="si" type="number" min="0" placeholder="—" value="${g.sa}" onchange="setKS('${div}',${g.ri},${g.gi},'sa',this.value)"/>
             <span class="ssep">:</span>
             <input class="si" type="number" min="0" placeholder="—" value="${g.sb}" onchange="setKS('${div}',${g.ri},${g.gi},'sb',this.value)"/>`
          : `<span class="ssep">${done ? `${g.sa} : ${g.sb}` : '— : —'}</span>`}
      </span>`;
    const errD = document.createElement('div');
    errD.id = `kerr-${div}-${g.ri}-${g.gi}`; errD.className = 'score-err';
    errD.style.display = err ? 'block' : 'none'; errD.textContent = err || '';
    wrap.appendChild(row); wrap.appendChild(errD);
  } else {
    row.innerHTML = `
      <span class="pill ${pc}">Court ${g.court}</span>
      <span class="gt">${g.a}<span class="gtag">${g.gn}</span></span>
      <span class="gvs">vs</span>
      <span class="gt r">${g.b}</span>
      <span class="sw">
        ${admin
          ? `<input class="si" type="number" min="0" max="99" placeholder="—" value="${g.sa}" onchange="setGS('${div}',${idx},'sa',this.value)"/>
             <span class="ssep">:</span>
             <input class="si" type="number" min="0" max="99" placeholder="—" value="${g.sb}" onchange="setGS('${div}',${idx},'sb',this.value)"/>`
          : `<span class="ssep">${done ? `${g.sa} : ${g.sb}` : '— : —'}</span>`}
      </span>`;
    const errD = document.createElement('div');
    errD.id = `gerr-${div}-${idx}`; errD.className = 'score-err';
    errD.style.display = err ? 'block' : 'none'; errD.textContent = err || '';
    wrap.appendChild(row); wrap.appendChild(errD);
  }
  return wrap;
}

function renderScheduleContent() {
  const el = document.getElementById('schedule-content');
  if (!el) return;
  const divs = getActiveDivs();
  const hasAny = divs.some(div => S[div].sched.length > 0);

  if (!hasAny) {
    el.innerHTML = `<div class="empty"><h3>No schedule yet</h3><p>Go to Teams tab and click Generate Schedule</p></div>`;
    return;
  }

  const inp = document.getElementById('sched-search');
  const rawQuery = inp ? inp.value.trim() : '';
  if (rawQuery && !schedFilter) {
    el.innerHTML = `<div class="empty"><h3>No match</h3><p>No couple found for "<strong>${rawQuery}</strong>"</p></div>`;
    return;
  }

  el.innerHTML = '';

  // ── UNIFIED view when All + no search filter ──────────────────────────
  if (activeDiv === 'all' && !schedFilter) {
    // Collect ALL pool games from both divisions, tagged with div
    const allPool = [];
    divs.forEach(div => {
      S[div].sched
        .filter(g => activeCourt === 'all' || g.court === activeCourt)
        .forEach(g => allPool.push({...g, _div: div, _idx: S[div].sched.indexOf(g)}));
    });

    if (allPool.length) {
      const sec = document.createElement('div');
      sec.innerHTML = '<div class="sec-title">Pool Stage</div>';
      // Group by time string (both divs share same start time & slot duration)
      const byTime = {};
      allPool.forEach(g => {
        if (!byTime[g.time]) byTime[g.time] = [];
        byTime[g.time].push(g);
      });
      Object.keys(byTime).sort((a,b) => t2m(a)-t2m(b)).forEach(time => {
        const games = byTime[time];
        const block = document.createElement('div'); block.className = 'tblock';
        block.innerHTML = `<div class="thdr"><span class="tlbl">${time}</span><div class="tline"></div></div>`;
        games.forEach(g => block.appendChild(buildGameRow(g._div, g, g._idx, false)));
        sec.appendChild(block);
      });
      el.appendChild(sec);
    }

    // Collect ALL KO games from both divisions
    const allKO = [];
    divs.forEach(div => {
      S[div].ko.flatMap((r, ri) => r.map((g, gi) => ({...g, ri, gi, _div: div})))
        .filter(g => activeCourt === 'all' || g.court === activeCourt)
        .forEach(g => allKO.push(g));
    });

    if (allKO.length) {
      const sec = document.createElement('div');
      sec.innerHTML = '<div class="sec-title" style="margin-top:8px">Knockout Stage</div>';
      const byTime = {};
      allKO.forEach(g => {
        if (!byTime[g.time]) byTime[g.time] = [];
        byTime[g.time].push(g);
      });
      Object.keys(byTime).sort((a,b) => t2m(a)-t2m(b)).forEach(time => {
        const games = byTime[time];
        // Round label: use the first game's round name
        const rn = getKORoundName(games[0]._div, games[0].ri);
        const block = document.createElement('div'); block.className = 'tblock';
        block.innerHTML = `<div class="thdr"><span class="tlbl">${time}</span><div class="tline"></div><span class="rtag">${rn}</span></div>`;
        games.forEach(g => block.appendChild(buildGameRow(g._div, g, -1, true)));
        sec.appendChild(block);
      });
      el.appendChild(sec);
    }

    if (!el.children.length)
      el.innerHTML = `<div class="empty"><h3>No schedule yet</h3><p>Go to Teams tab and click Generate Schedule</p></div>`;
    return;
  }

  // ── Per-division view (Women / Men filter, or search active) ──────────
  divs.forEach(div => {
    const DS = S[div];
    if (!DS.sched.length && !DS.ko.length) return;

    const divSec = document.createElement('div');

    // Pool stage
    const groupGames = DS.sched.filter(g =>
      (activeCourt === 'all' || g.court === activeCourt) &&
      (!schedFilter || g.a === schedFilter || g.b === schedFilter)
    );
    if (groupGames.length) {
      const sec = document.createElement('div');
      sec.innerHTML = '<div class="sec-title">Pool Stage</div>';
      const bySlot = {};
      groupGames.forEach(g => { if (!bySlot[g.si]) bySlot[g.si] = []; bySlot[g.si].push(g); });
      Object.keys(bySlot).sort((a,b) => a-b).forEach(si => {
        const games = bySlot[si];
        const block = document.createElement('div'); block.className = 'tblock';
        block.innerHTML = `<div class="thdr"><span class="tlbl">${games[0].time}</span><div class="tline"></div></div>`;
        games.forEach(g => block.appendChild(buildGameRow(div, g, DS.sched.indexOf(g), false)));
        sec.appendChild(block);
      });
      divSec.appendChild(sec);
    }

    // KO stage
    if (DS.ko.length) {
      const koGames = DS.ko.flatMap((r, ri) => r.map((g, gi) => ({...g, ri, gi})))
        .filter(g =>
          (activeCourt === 'all' || g.court === activeCourt) &&
          (!schedFilter || g.a === schedFilter || g.b === schedFilter)
        );
      if (koGames.length) {
        const sec = document.createElement('div');
        sec.innerHTML = '<div class="sec-title" style="margin-top:8px">Knockout Stage</div>';
        const byRound = {};
        koGames.forEach(g => { const k = `${g.ri}`; if (!byRound[k]) byRound[k] = []; byRound[k].push(g); });
        Object.keys(byRound).sort((a,b) => a-b).forEach(ri => {
          const games = byRound[ri];
          const rn = getKORoundName(div, parseInt(ri));
          const block = document.createElement('div'); block.className = 'tblock';
          block.innerHTML = `<div class="thdr"><span class="tlbl">${games[0].time}</span><div class="tline"></div><span class="rtag">${rn}</span></div>`;
          games.forEach(g => block.appendChild(buildGameRow(div, g, -1, true)));
          sec.appendChild(block);
        });
        divSec.appendChild(sec);
      }
    }

    if (divSec.children.length) el.appendChild(divSec);
  });

  if (!el.children.length && schedFilter) {
    el.innerHTML = `<div class="empty"><h3>No games yet</h3><p>Generate the schedule first, then search will show results here.</p></div>`;
  }
}

// ============ KO UPDATE ============
function getKOWinner(game) {
  if (!game) return null;
  const sa = parseInt(game.sa), sb = parseInt(game.sb);
  if (isValidScore(sa, sb)) return sa > sb ? game.a : game.b;
  return null;
}

function resolvePoolSeed(div, seed) {
  const DS = S[div];
  const m  = String(seed || '').match(/^([A-Z])(\d+)$/);
  if (!m) return { label: seed || 'TBD', known: false };
  const gi   = m[1].charCodeAt(0) - 65;
  const rank = parseInt(m[2], 10);
  if (gi < 0 || gi >= DS.groups.length) return { label: seed, known: false };
  const grp = DS.groups[gi];
  const totalGames = (grp.teams.length * (grp.teams.length - 1)) / 2;
  const doneCnt = DS.sched.filter(g => g.gi === gi && isValidScore(parseInt(g.sa), parseInt(g.sb))).length;
  if (doneCnt !== totalGames) return { label: seed, known: false };
  const st = getStandings(div, gi);
  if (!st[rank-1]) return { label: seed, known: false };
  return { label: st[rank-1].name, known: true };
}

function updateKOForDiv(div) {
  const DS = S[div];
  if (!DS.ko.length) return;
  const adv = DS.cfg.advPerGroup;
  const ng  = DS.groups.length;

  const koSeeds = [];
  for (let rank = 1; rank <= adv; rank++)
    for (let g = 0; g < ng; g++)
      koSeeds.push(`${String.fromCharCode(65+g)}${rank}`);
  const nKO  = koSeeds.length;
  const paired = [];
  for (let i = 0; i < Math.floor(nKO / 2); i++) paired.push([koSeeds[i], koSeeds[nKO-1-i]]);

  if (DS.ko[0]) {
    paired.forEach(([sA, sB], i) => {
      if (!DS.ko[0][i]) return;
      const rA = resolvePoolSeed(div, sA);
      const rB = resolvePoolSeed(div, sB);
      DS.ko[0][i].a = rA.known ? rA.label : sA;
      DS.ko[0][i].b = rB.known ? rB.label : sB;
      DS.ko[0][i].seedA = sA;
      DS.ko[0][i].seedB = sB;
    });
  }

  for (let ri = 1; ri < DS.ko.length; ri++) {
    DS.ko[ri].forEach((g, gi) => {
      const wa = getKOWinner(DS.ko[ri-1][gi*2]);
      const wb = getKOWinner(DS.ko[ri-1][gi*2+1]);
      const rndName = getKORoundName(div, ri-1);
      g.a = wa || `Winner of ${rndName} ${gi*2+1}`;
      g.b = wb || `Winner of ${rndName} ${gi*2+2}`;
    });
  }
}

function updateKO() {
  getActiveDivs().forEach(div => updateKOForDiv(div));
}

// ============ BRACKET — no Pool column, start straight from KO ============
const BASE = 52;

function renderBracketForDiv(div, container) {
  const DS = S[div];

  if (activeDiv === 'all') {
    const hdr = document.createElement('div');
    hdr.className = 'div-section-header';
    hdr.textContent = div === 'women' ? 'WOMEN' : 'MEN';
    container.appendChild(hdr);
  }

  const done  = DS.sched.filter(g => isValidScore(parseInt(g.sa), parseInt(g.sb))).length;
  const total = DS.sched.length;
  const info  = document.createElement('div');
  info.className = 'binfo';
  info.innerHTML = !total
    ? 'Generate the schedule first to see the knockout bracket.'
    : `Pool stage: <span>${done}/${total} games played</span> — bracket updates live as scores are entered`;
  container.appendChild(info);

  if (!DS.ko.length) return;

  const adv = DS.cfg.advPerGroup || 0;
  const ng  = DS.groups.length;
  const koSeeds = [];
  for (let rank = 1; rank <= adv; rank++)
    for (let g = 0; g < ng; g++)
      koSeeds.push(`${String.fromCharCode(65+g)}${rank}`);
  const nKO = koSeeds.length;
  const seedPairs = [];
  for (let i = 0; i < Math.floor(nKO / 2); i++) seedPairs.push([koSeeds[i], koSeeds[nKO-1-i]]);

  const scroll = document.createElement('div');
  scroll.className = 'bscroll';
  const tree = document.createElement('div');
  tree.className = 'btree';
  scroll.appendChild(tree);

    // Bracket alignment maths:
  // Each .bmatch-box is ~78px tall (2 × 34px bteam + 10px box-margin).
  // Base gap between consecutive matches in round 0 = GAP px.
  // HG = match-height + gap = one "slot" in round 0.
  // colPadTop(ri) = (2^ri - 1) × HG / 2   → centres first match between its two feeders
  // matchGap(ri)  = (2^ri - 1) × HG + GAP  → gap between consecutive matches in round ri
  const HG = 90;   // bmatch height (78) + base gap (12)
  const GAP = 12;

  DS.ko.forEach((round, ri) => {
    const col = document.createElement('div');
    col.className = 'bround';
    col.innerHTML = `<div class="brnd-title">${getKORoundName(div, ri)}</div>`;
    const matchesEl = document.createElement('div');
    matchesEl.className = 'brnd-matches';
    const colPadTop = ri === 0 ? 0 : ((Math.pow(2, ri) - 1) * HG / 2);
    const matchGap  = (Math.pow(2, ri) - 1) * HG + GAP;
    matchesEl.style.paddingTop = colPadTop + 'px';

    round.forEach((g, gi) => {
      const wrap = document.createElement('div');
      wrap.className = 'bmatch-wrap';
      if (gi > 0) wrap.style.marginTop = matchGap + 'px';

      const sa = parseInt(g.sa), sb = parseInt(g.sb);
      const hs = isValidScore(sa, sb);
      const wa = hs && sa > sb, wb = hs && sb > sa;

      let labelA, labelB, codeA = '', codeB = '', knownA = false, knownB = false;

      if (ri === 0) {
        const pair  = gi < seedPairs.length ? seedPairs[gi] : [g.seedA||'TBD', g.seedB||'TBD'];
        const seedA = resolvePoolSeed(div, pair[0]);
        const seedB = resolvePoolSeed(div, pair[1]);
        labelA = seedA.known ? seedA.label : pair[0];
        labelB = seedB.known ? seedB.label : pair[1];
        codeA  = seedA.known ? pair[0] : '';
        codeB  = seedB.known ? pair[1] : '';
        knownA = seedA.known; knownB = seedB.known;
      } else {
        const srcRound = getKORoundName(div, ri-1);
        labelA = g.a && !g.a.startsWith('Winner of') ? g.a : `Winner of ${srcRound} ${gi*2+1}`;
        labelB = g.b && !g.b.startsWith('Winner of') ? g.b : `Winner of ${srcRound} ${gi*2+2}`;
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

  container.appendChild(scroll);

  // Champion
  const fin = DS.ko[DS.ko.length-1][0];
  if (fin) {
    const fsa = parseInt(fin.sa), fsb = parseInt(fin.sb);
    if (isValidScore(fsa, fsb)) {
      const w = fsa > fsb ? fin.a : fin.b;
      const champEl = document.createElement('div');
      champEl.innerHTML = `<div class="champ-wrap"><div class="ci">&#9733; CHAMPION</div><div class="champ-name">${w}</div></div>`;
      container.appendChild(champEl);
    }
  }
}

function renderBracket() {
  const container = document.getElementById('bracket-container');
  if (!container) return;
  container.innerHTML = '';
  getActiveDivs().forEach(div => renderBracketForDiv(div, container));
}

// ============ SETTINGS ============
const SETT_LIMITS = {
  numCouples:[4,64], courts:[1,8], numGroups:[2,16],
  advPerGroup:[1,8], gameDur:[10,120], breakDur:[0,60]
};

function adjSetting(div, key, delta) {
  if (!admin) return;
  const [mn, mx] = SETT_LIMITS[key];
  S[div].cfg[key] = Math.min(mx, Math.max(mn, (S[div].cfg[key] || mn) + delta));
  save(); renderSettings();
}

function updateTimeSetting(div, key, val) {
  if (!admin) return;
  S[div].cfg[key] = val; save(); renderSettings();
}

function distributeGroups(nc, ng) {
  const base = Math.floor(nc / ng), extra = nc % ng;
  const sizes = [];
  for (let i = 0; i < ng; i++) sizes.push(base + (i < extra ? 1 : 0));
  return sizes;
}

function renderSettingsForDiv(div) {
  const cfg = S[div].cfg;
  const ng  = cfg.numGroups  || 2;
  const nc  = cfg.numCouples || 10;
  const sizes = distributeGroups(nc, ng);
  const totalGroupGames = sizes.reduce((s, sz) => s + (sz * (sz-1)) / 2, 0);
  const koTeams = ng * (cfg.advPerGroup || 0);
  let bracketSize = 1;
  while (bracketSize < koTeams) bracketSize *= 2;
  const koGames    = bracketSize > 1 ? bracketSize - 1 : 0;
  const totalGames = totalGroupGames + koGames;
  const slot       = cfg.gameDur + cfg.breakDur;
  const poolSlots  = Math.ceil(totalGroupGames / (cfg.courts || 2));
  const koSlots    = Math.ceil(koGames / (cfg.courts || 2));
  const [sh, sm]   = cfg.startTime.split(':').map(Number);
  const endMins    = sh*60 + sm + (poolSlots + koSlots) * slot;
  const endH = String(Math.floor(endMins/60)%24).padStart(2,'0');
  const endM = String(endMins%60).padStart(2,'0');
  const isQF  = nc === 10 && ng === 2;
  const isR16 = nc === 12 && ng === 4;

  const womenModeHTML = div === 'women' ? `
    <div class="sett-card" style="margin-bottom:0">
      <div class="sett-card-title">Women Format</div>
      <div class="women-mode-row">
        <button class="wmode-btn ${isQF  ? 'on' : ''}" onclick="setWomenMode('qf')">10 Couples — Quarterfinals</button>
        <button class="wmode-btn ${isR16 ? 'on' : ''}" onclick="setWomenMode('r16')">12 Couples — Round of 16</button>
      </div>
    </div>` : '';

  return `${womenModeHTML}
    <div class="sett-grid">
      <div class="sett-card">
        <div class="sett-card-title">Tournament Format</div>
        <div class="sett-row">
          <div class="sett-label">
            <span class="sett-name">Number of couples</span>
            <span class="sett-desc">Total couples. Pools are distributed automatically.</span>
          </div>
          <div class="sett-ctrl">
            <button class="num-btn" onclick="adjSetting('${div}','numCouples',-1)">−</button>
            <span class="num-val">${cfg.numCouples}</span>
            <button class="num-btn" onclick="adjSetting('${div}','numCouples',1)">+</button>
          </div>
        </div>
        <div class="sett-row">
          <div class="sett-label">
            <span class="sett-name">Number of groups</span>
            <span class="sett-desc">Couples are distributed evenly.</span>
          </div>
          <div class="sett-ctrl">
            <button class="num-btn" onclick="adjSetting('${div}','numGroups',-1)">−</button>
            <span class="num-val">${cfg.numGroups}</span>
            <button class="num-btn" onclick="adjSetting('${div}','numGroups',1)">+</button>
          </div>
        </div>
        <div class="sett-row">
          <div class="sett-label">
            <span class="sett-name">Teams advancing per pool</span>
            <span class="sett-desc">How many advance to knockout.</span>
          </div>
          <div class="sett-ctrl">
            <button class="num-btn" onclick="adjSetting('${div}','advPerGroup',-1)">−</button>
            <span class="num-val">${cfg.advPerGroup}</span>
            <button class="num-btn" onclick="adjSetting('${div}','advPerGroup',1)">+</button>
          </div>
        </div>
      </div>
      <div class="sett-card">
        <div class="sett-card-title">Time Settings</div>
        <div class="sett-row">
          <div class="sett-label">
            <span class="sett-name">Start time</span>
            <span class="sett-desc">When the first game begins.</span>
          </div>
          <div class="sett-ctrl">
            <input type="time" class="time-inp" value="${cfg.startTime}" onchange="updateTimeSetting('${div}','startTime',this.value)" />
          </div>
        </div>
        <div class="sett-row">
          <div class="sett-label">
            <span class="sett-name">Game duration (min)</span>
            <span class="sett-desc">Allocated time per game.</span>
          </div>
          <div class="sett-ctrl">
            <button class="num-btn" onclick="adjSetting('${div}','gameDur',-5)">−</button>
            <span class="num-val">${cfg.gameDur}</span>
            <button class="num-btn" onclick="adjSetting('${div}','gameDur',5)">+</button>
          </div>
        </div>
        <div class="sett-row">
          <div class="sett-label">
            <span class="sett-name">Break between games (min)</span>
            <span class="sett-desc">Extra buffer between games.</span>
          </div>
          <div class="sett-ctrl">
            <button class="num-btn" onclick="adjSetting('${div}','breakDur',-5)">−</button>
            <span class="num-val">${cfg.breakDur}</span>
            <button class="num-btn" onclick="adjSetting('${div}','breakDur',5)">+</button>
          </div>
        </div>
      </div>
    </div>
    <div class="sett-preview">
      <div class="sett-preview-grid">
        <div class="prev-item"><div class="prev-label">Groups</div><div class="prev-val">${ng}</div></div>
        <div class="prev-item"><div class="prev-label">Group games</div><div class="prev-val">${totalGroupGames}</div></div>
        <div class="prev-item"><div class="prev-label">KO games</div><div class="prev-val">${koGames}</div></div>
        <div class="prev-item"><div class="prev-label">Total games</div><div class="prev-val">${totalGames}</div></div>
        <div class="prev-item"><div class="prev-label">Start</div><div class="prev-val">${cfg.startTime}</div></div>
        <div class="prev-item accent"><div class="prev-label">Est. end</div><div class="prev-val">${endH}:${endM}</div></div>
      </div>
    </div>
    <button class="gen-btn" onclick="applySettings('${div}')">Apply &amp; Regenerate Schedule</button>
    <div class="sett-danger">
      <div class="sett-card-title" style="color:var(--red)">Danger Zone</div>
      <p style="font-size:13px;color:var(--text2);margin-bottom:14px">Reset ALL scores and regenerate everything from scratch.</p>
      <button class="danger-btn" onclick="resetAll('${div}')">Reset tournament &amp; clear all scores</button>
    </div>`;
}

function renderSettings() {
  const container = document.getElementById('settings-container');
  if (!container) return;
  container.innerHTML = '';
  getActiveDivs().forEach(div => {
    if (activeDiv === 'all') {
      const hdr = document.createElement('div');
      hdr.className = 'div-section-header';
      hdr.textContent = div === 'women' ? 'WOMEN' : 'MEN';
      container.appendChild(hdr);
    }
    const sec = document.createElement('div');
    sec.innerHTML = renderSettingsForDiv(div);
    container.appendChild(sec);
  });
}

function applySettings(div) {
  if (!admin) return;
  const cfg = S[div].cfg;
  const ng  = cfg.numGroups  || 2;
  const nc  = cfg.numCouples || 10;
  cfg.advPerGroup = Math.min(Math.max(cfg.advPerGroup || 1, 1), 4);
  const allTeams = S[div].groups.flatMap(g => g.teams).filter(t => t && t !== 'TBD / TBD');
  while (allTeams.length < nc) allTeams.push('TBD / TBD');
  const trimmed = allTeams.slice(0, nc);
  const sizes   = distributeGroups(nc, ng);
  const newGroups = [];
  let idx = 0;
  for (let g = 0; g < ng; g++) {
    newGroups.push({ name: String.fromCharCode(65+g), teams: trimmed.slice(idx, idx + sizes[g]) });
    idx += sizes[g];
  }
  S[div].groups = newGroups; S[div].sched = []; S[div].ko = [];
  generateScheduleForDiv(div);
  save(); goPage('schedule');
}

function resetAll(div) {
  if (!admin) return;
  if (!confirm('Reset all scores and regenerate the full schedule?')) return;
  S[div].sched.forEach(g => { g.sa = ''; g.sb = ''; });
  S[div].ko.forEach(r => r.forEach(g => { g.sa = ''; g.sb = ''; }));
  generateScheduleForDiv(div);
  save(); rerender();
}

function setWomenMode(mode) {
  if (!admin) return;
  if (mode === 'qf') {
    S.women.cfg.numCouples = 10;
    S.women.cfg.numGroups  = 2;
    S.women.cfg.advPerGroup = 4;
  } else if (mode === 'r16') {
    S.women.cfg.numCouples = 12;
    S.women.cfg.numGroups  = 4;
    S.women.cfg.advPerGroup = 3;
  }
  save(); renderSettings();
}

// ============ EXPOSE GLOBALS ============
Object.assign(window, {
  adminClick, tryLogin, closeLogin, goPage, setDiv,
  openEdit, closeEdit, saveEdit, addTeam, deleteTeam,
  filterTeams, filterSchedule,
  generateSchedule, setGS, setKS, setCourt,
  adjSetting, updateTimeSetting, applySettings, resetAll, setWomenMode
});

// ============ BOOT ============
window.addEventListener('load', async () => {
  load();
  refreshA();
  renderAll();
  await loadInitialCloudState();
  renderAll();
});
