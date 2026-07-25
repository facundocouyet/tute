/* ============================================================
   TUTE · contador — lógica de la app
   Port fiel del diseño "Contador de Tute" (claude.ai/design).
   Estado en localStorage, sin dependencias.
   ============================================================ */
(() => {
  'use strict';

  // ---- Reglas de puntaje (props del diseño) -----------------
  const GANADOR = 'más puntos';   // 'más puntos' | 'menos puntos'
  const PUNTOS_BASE = 5;
  const IDA_Y_VUELTA = true;

  const LS_KEY = 'tute-contador-v1';

  const PALETTE = [
    { c: '#bf1716', t: 'rojo' },
    { c: '#141414', t: 'tinta' },
    { c: 'oklch(0.46 0.09 135)', t: 'oliva' },
    { c: 'oklch(0.44 0.06 255)', t: 'azul' },
    { c: 'oklch(0.58 0.11 70)', t: 'ámbar' },
  ];

  // ---- Estado ----------------------------------------------
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) {}
  const initialPlayers = (saved && saved.players && saved.players.length >= 2) ? saved.players : [
    { name: 'Vale', color: '#bf1716' },
    { name: 'Nico', color: '#141414' },
    { name: 'Caro', color: 'oklch(0.46 0.09 135)' },
    { name: 'Tomi', color: 'oklch(0.44 0.06 255)' },
  ];
  let initialGame = (saved && saved.game) || null;
  const untouched = initialGame && initialGame.mano === 0 && initialGame.phase === 'pedir' &&
    (!initialGame.hist || !initialGame.hist.length) && (initialGame.bids || []).every((b) => b === 0);
  if (untouched) initialGame = null;

  const state = {
    entered: false,
    tab: 'partida',
    players: initialPlayers,
    game: initialGame,
    active: initialGame ? ((saved && saved.active) || initialPlayers.map((p, i) => i)) : null,
    sel: initialPlayers.map(() => true),
    t: (saved && saved.t) || null,
    undoStack: [],
    tGamesDraft: 5,
    setupMode: 'libre',
    demoStep: 0,
  };
  let timers = [];

  const app = document.getElementById('app');

  function persist() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        players: state.players, game: state.game, t: state.t, active: state.active,
      }));
    } catch (e) {}
  }

  function setState(patch) {
    Object.assign(state, patch);
    persist();
    render();
  }

  // ---- Helpers de juego ------------------------------------
  function fresh(n) {
    return { mano: 0, phase: 'pedir', bids: Array(n).fill(0), wons: Array(n).fill(0), totals: Array(n).fill(0), deltas: null, applied: false, hist: [] };
  }
  function actives() {
    return state.active ? state.active.map((i) => state.players[i]).filter(Boolean) : state.players;
  }
  function seq() {
    const n = actives().length;
    const s = [];
    for (let i = 1; i <= 10; i++) s.push(i);
    if (IDA_Y_VUELTA) {
      for (let j = 0; j < n; j++) s.push(10);
      for (let i = 10; i >= 1; i--) s.push(i);
    }
    return s;
  }
  function extraTens(mi) {
    const n = actives().length;
    return mi >= 10 && mi < 10 + n;
  }
  function moreWins() { return GANADOR !== 'menos puntos'; }
  function placements(totals) {
    const idx = totals.map((v, i) => i);
    idx.sort((a, b) => moreWins() ? totals[b] - totals[a] : totals[a] - totals[b]);
    const rank = Array(totals.length).fill(1);
    idx.forEach((pi, pos) => {
      rank[pi] = (pos > 0 && totals[pi] === totals[idx[pos - 1]]) ? rank[idx[pos - 1]] : pos + 1;
    });
    return { order: idx, rank };
  }
  function snap() { return JSON.stringify({ game: state.game, t: state.t }); }
  function pushUndo(list) { return [...list.slice(-24), snap()]; }

  // ---- Acciones --------------------------------------------
  function adj(kind, i, d) {
    const g = state.game, s = seq();
    const cards = s[Math.min(g.mano, s.length - 1)];
    const arr = g[kind].slice();
    arr[i] = Math.max(0, Math.min(cards, arr[i] + d));
    setState({ game: Object.assign({}, g, { [kind]: arr }) });
  }
  function confirmBids() {
    const g = state.game;
    setState({ game: Object.assign({}, g, { phase: 'ganar', wons: g.bids.slice() }) });
  }
  function closeMano() {
    const g = state.game, s = seq();
    const undoStack = pushUndo(state.undoStack);
    const deltas = g.bids.map((b, i) => g.wons[i] === b ? PUNTOS_BASE + b : -Math.abs(g.wons[i] - b));
    const totals = g.totals.map((v, i) => v + deltas[i]);
    const cards = s[Math.min(g.mano, s.length - 1)];
    const next = Object.assign({}, g, {
      totals, deltas, mano: g.mano + 1,
      hist: [...(g.hist || []), { cards, deltas, totals, st: extraTens(g.mano) }],
    });
    let t = state.t;
    if (next.mano >= s.length) {
      next.phase = 'fin';
      if (t && !g.applied) {
        const { rank } = placements(totals);
        t = Object.assign({}, t, { points: t.points.map((p, i) => p + rank[i]) });
        next.applied = true;
      }
    } else {
      next.phase = 'pedir';
      next.bids = g.bids.map(() => 0);
      next.wons = g.wons.map(() => 0);
    }
    setState({ game: next, t, undoStack });
  }
  function undo() {
    const us = state.undoStack;
    if (!us.length) return;
    const prev = JSON.parse(us[us.length - 1]);
    setState({ game: prev.game, t: prev.t, undoStack: us.slice(0, -1) });
  }
  function resetMano() {
    const g = state.game;
    if (!g) return;
    setState({ game: Object.assign({}, g, { phase: 'pedir', bids: g.bids.map(() => 0), wons: g.wons.map(() => 0) }) });
  }
  function resetPartida() {
    setState({ game: fresh(actives().length), undoStack: pushUndo(state.undoStack) });
  }
  function resetTable(players) {
    const pendingT = (state.t && !state.t.points) ? state.t : null;
    setState({ players, game: null, active: null, sel: players.map(() => true), t: pendingT, undoStack: [] });
  }
  function addPlayer() {
    const players = state.players;
    const used = players.map((p) => p.color);
    const free = PALETTE.find((sw) => !used.includes(sw.c)) || PALETTE[0];
    resetTable([...players, { name: 'Jugador ' + (players.length + 1), color: free.c }]);
  }
  function startPartida() {
    const sel = state.sel || state.players.map(() => true);
    const idx = sel.map((v, i) => v ? i : -1).filter((i) => i >= 0);
    const nt = state.setupMode === 'torneo'
      ? { total: state.tGamesDraft, game: 1, points: Array(idx.length).fill(0) }
      : null;
    setState({ active: idx, game: fresh(idx.length), undoStack: [], t: nt });
  }
  function finPrimary() {
    if (state.t) {
      if (state.t.game < state.t.total) {
        setState({ t: Object.assign({}, state.t, { game: state.t.game + 1 }), game: fresh(actives().length), undoStack: [] });
      } else {
        setState({ tab: 'torneo' });
      }
    } else {
      setState({ game: null, undoStack: [] });
    }
  }
  function takeSelfie(i, inputEl) {
    const f = inputEl.files && inputEl.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const x = c.getContext('2d');
        const m = Math.min(img.width, img.height);
        x.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, 128, 128);
        const url = c.toDataURL('image/jpeg', 0.82);
        setState({ players: state.players.map((q, j) => j === i ? Object.assign({}, q, { photo: url }) : q) });
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
    inputEl.value = '';
  }

  // ---- Demo (reglas) ---------------------------------------
  function demoData() {
    const acts = actives();
    const n = acts.length;
    const demoStep = state.demoStep;
    const cx = 150, cy = 139, seatR = 118;
    const seats = acts.map((p, i) => {
      const a = (-90 + i * 360 / n) * Math.PI / 180;
      return { x: Math.round(cx + Math.cos(a) * seatR), y: Math.round(cy + Math.sin(a) * seatR), color: avBg(p), initial: avTx(p), name: p.name };
    });
    const roles = [
      { n: '5', copa: true },
      { n: '4', oro: true },
      { n: '11', oro: true },
      { n: '2', basto: true },
      { n: '7', basto: true },
    ];
    const lastStep = n + 1;
    const winIdx = n >= 3 ? 2 : 1;
    const cards = acts.map((p, i) => {
      const a = (-90 + i * 360 / n) * Math.PI / 180;
      const played = demoStep >= i + 1;
      const role = roles[Math.min(i, roles.length - 1)];
      return {
        n: role.n, isOro: !!role.oro, isCopa: !!role.copa, isBasto: !!role.basto,
        x: Math.round(cx + Math.cos(a) * (played ? 58 : 92)),
        y: Math.round(cy + Math.sin(a) * (played ? 58 : 92)),
        rot: Math.round(a * 180 / Math.PI + 90),
        op: played ? 1 : 0,
        border: (demoStep >= lastStep && i === winIdx) ? 'var(--red-500)' : 'var(--ink-800)',
      };
    });
    const nm = (i) => (acts[i] ? acts[i].name.toLowerCase() : '');
    const captions = ['el triunfo es oro. "fallar" es no tener el palo que se juega.'];
    for (let i = 0; i < n; i++) {
      captions.push(
        i === 0 ? nm(0) + ' abre la baza con el 5 de copas.'
        : i === 1 ? nm(1) + ' no tiene copas: está obligado a fallar con triunfo. tira el 4 de oro.'
        : i === 2 ? nm(2) + ' tampoco tiene copas y tiene un oro que mata al 4: lo tiene que tirar sí o sí. tira el caballo (11).'
        : i === 3 ? nm(3) + ' también falló, y tiene el 5 de oro… pero no le gana al 11 de ' + nm(2) + ': se lo puede guardar y tira cualquier otra.'
        : nm(i) + ' no tiene copas ni un oro que mate: puede tirar cualquier carta.'
      );
    }
    captions.push(n >= 3 ? 'la baza se la lleva el oro más alto: el caballo.' : 'la baza se la lleva el triunfo: el 4 de oro.');
    return {
      seats, cards,
      keptVisible: n >= 4,
      keptX: Math.round(cx + Math.cos((-90 + 3 * 360 / n) * Math.PI / 180 + 0.38) * 88),
      keptY: Math.round(cy + Math.sin((-90 + 3 * 360 / n) * Math.PI / 180 + 0.38) * 88),
      keptRot: Math.round((-90 + 3 * 360 / n) + 90 + 16),
      keptOp: demoStep >= 4 ? 1 : 0,
      caption: captions[Math.min(demoStep, captions.length - 1)],
      btnLabel: demoStep === 0 ? 'ver la jugada' : 'repetir',
    };
  }
  function setDemoStep(k) {
    state.demoStep = k;
    if (state.tab !== 'reglas' || !document.getElementById('demo-root')) { render(); return; }
    const d = demoData();
    d.cards.forEach((c, i) => {
      const el = document.getElementById('demo-card-' + i);
      if (!el) return;
      el.style.left = c.x + 'px';
      el.style.top = c.y + 'px';
      el.style.opacity = c.op;
      el.style.borderColor = c.border;
    });
    const kept = document.getElementById('demo-kept');
    if (kept) kept.style.opacity = d.keptOp;
    const cap = document.getElementById('demo-caption');
    if (cap) cap.textContent = d.caption;
    const btn = document.getElementById('demo-btn');
    if (btn) btn.textContent = d.btnLabel;
  }
  function playDemo() {
    timers.forEach(clearTimeout);
    timers = [];
    const n = actives().length;
    state.demoStep = 0;
    render();
    for (let k = 1; k <= n + 1; k++) {
      timers.push(setTimeout(() => setDemoStep(k), 500 + (k - 1) * 1700));
    }
  }

  // ---- Helpers de vista ------------------------------------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function ini(p) { return ((p.name || '').trim()[0] || '?').toUpperCase(); }
  function avBg(p) { return p.photo ? ("url('" + p.photo + "') center/cover no-repeat") : p.color; }
  function avTx(p) { return p.photo ? '' : ini(p); }
  function avatar(p, size, font, extra) {
    return '<div style="width: ' + size + 'px; height: ' + size + 'px; border-radius: 50%; background: ' + avBg(p) +
      '; color: var(--cream-100); font-family: var(--font-display); font-size: ' + font +
      'px; display: flex; align-items: center; justify-content: center; flex: none;' + (extra || '') + '">' + esc(avTx(p)) + '</div>';
  }

  const SVG_ORO = '<svg width="12" height="12" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.4" style="fill: oklch(0.72 0.12 80); stroke: #141414; stroke-width: 1.2;"></circle><circle cx="7" cy="7" r="2.4" style="fill: none; stroke: #141414; stroke-width: 1;"></circle></svg>';
  const SVG_COPA = '<svg width="12" height="12" viewBox="0 0 14 14"><path d="M3 1.5h8v3.4c0 2.2-1.8 3.8-4 3.8s-4-1.6-4-3.8Z" style="fill: var(--red-500); stroke: #141414; stroke-width: 1;"></path><rect x="6.3" y="8.7" width="1.4" height="2.2" style="fill: #141414;"></rect><rect x="4" y="10.9" width="6" height="1.5" rx="0.7" style="fill: #141414;"></rect></svg>';
  const SVG_BASTO = '<svg width="12" height="12" viewBox="0 0 14 14"><path d="M6 1.2c1.9-.7 3.3.5 2.8 2.2l-2.2 8.4c-.3 1-1.7 1-1.9 0L4.2 3.6c-.2-1 .6-2 1.8-2.4Z" style="fill: oklch(0.46 0.09 135); stroke: #141414; stroke-width: 1;"></path></svg>';

  const smallBtn = (act, label, extra) =>
    '<button data-act="' + act + '" class="press" style="height: 36px; padding: 0 14px; border: 1.5px solid var(--ink-800); border-radius: var(--radius-sm); background: transparent; font-family: var(--font-accent); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-800); cursor: pointer;' + (extra || '') + '">' + label + '</button>';

  const stepBtn = (act, i, sign) =>
    '<button data-act="' + act + '" data-i="' + i + '" class="press" style="width: 44px; height: 44px; border: 1.5px solid var(--ink-800); border-radius: var(--radius-sm); background: var(--cream-100); font-family: var(--font-display); font-size: 20px; color: var(--ink-800); cursor: pointer; padding: 0; line-height: 1;">' + sign + '</button>';

  // ---- Secciones -------------------------------------------
  function loginHTML() {
    return '' +
    '<div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 30; background: var(--cream-100); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 32px 60px; text-align: center;">' +
      '<div style="position: relative; width: 130px; height: 140px; margin-bottom: 28px;">' +
        '<div style="position: absolute; left: 50%; top: 50%; width: 86px; height: 122px; transform: translate(-50%, -50%) rotate(-5deg); border-radius: 10px; background: var(--red-600); border: 2px solid var(--ink-800); box-shadow: var(--shadow-hard); display: flex; align-items: center; justify-content: center;">' +
          '<div style="position: absolute; top: 7px; left: 9px; font-family: var(--font-display); font-size: 15px; line-height: 1; color: var(--cream-100);">10</div>' +
          '<div style="position: absolute; bottom: 7px; right: 9px; font-family: var(--font-display); font-size: 15px; line-height: 1; color: var(--cream-100); transform: rotate(180deg);">10</div>' +
          '<div style="width: 42px; height: 42px; border-radius: 50%; background: var(--cream-100); display: flex; align-items: center; justify-content: center;">' +
            '<div style="font-family: var(--font-display); font-size: 24px; line-height: 1; color: var(--red-600);">t</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div style="font-family: var(--font-condensed); font-size: 96px; line-height: 0.88; color: var(--ink-800);">TUTE</div>' +
      '<div style="font-family: var(--font-accent); font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-400); margin-top: 12px;">contador · cartas españolas</div>' +
      '<div style="font-family: var(--font-display); font-size: 19px; color: var(--red-500); margin-top: 26px;">tu jugada.</div>' +
      '<div style="width: 220px; margin-top: 14px;">' +
        '<button data-act="enter" class="btn btn-primary">entrar</button>' +
      '</div>' +
    '</div>';
  }

  function setupHTML(ctx) {
    const { sel, players } = ctx;
    const selCount = sel.filter(Boolean).length;
    const rows = players.map((p, i) =>
      '<div style="display: flex; align-items: center; gap: 10px; padding: 6px 8px 6px 14px; border-top: ' + (i === 0 ? 'none' : '1px solid var(--cream-200)') + '; opacity: ' + (sel[i] ? 1 : 0.55) + ';">' +
        avatar(p, 34, 16) +
        '<input id="sel-name-' + i + '" data-rename="' + i + '" value="' + esc(p.name) + '" placeholder="nombre" class="name-input" style="flex: 1; font-size: 15px; padding: 8px 2px;">' +
        '<button data-act="selToggle" data-i="' + i + '" aria-label="juega" style="width: 44px; height: 44px; border: none; background: none; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; flex: none;">' +
          '<div style="width: 26px; height: 26px; border-radius: 6px; border: 1.5px solid var(--ink-800); background: ' + (sel[i] ? 'var(--ink-800)' : 'transparent') + '; display: flex; align-items: center; justify-content: center; color: var(--cream-100); font-size: 14px; pointer-events: none;">' + (sel[i] ? '✓' : '') + '</div>' +
        '</button>' +
      '</div>'
    ).join('');
    const isTorneo = state.setupMode === 'torneo';
    return '' +
    '<div class="kicker">' + (isTorneo ? 'nuevo torneo' : 'nueva partida') + '</div>' +
    '<div class="title">¿quiénes juegan?</div>' +
    '<div style="border: 1.5px solid var(--ink-800); border-radius: var(--radius-md); background: var(--cream-50); box-shadow: var(--shadow-hard-sm); overflow: hidden; margin-top: 16px;">' + rows + '</div>' +
    (players.length < 5
      ? '<button data-act="addPlayer" class="press" style="width: 100%; margin-top: 10px; height: 46px; border: 1.5px dashed var(--ink-400); border-radius: var(--radius-md); background: none; font-family: var(--font-accent); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-800); cursor: pointer;">+ añadir jugador</button>'
      : '') +
    '<div style="display: flex; justify-content: space-between; align-items: center; margin: 12px 2px 2px;">' +
      '<span style="font-family: var(--font-accent); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-400);">' + selCount + ' en la mesa' + (selCount < 2 ? ' · mínimo 2' : '') + '</span>' +
      '<button data-act="goJugadores" style="border: none; background: none; font-family: var(--font-accent); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--red-500); cursor: pointer; padding: 8px 0;">editar jugadores</button>' +
    '</div>' +
    '<div style="display: flex; gap: 8px; margin: 10px 0 12px;">' +
      '<button data-act="modeLibre" class="press" style="flex: 1; height: 44px; border: 1.5px solid var(--ink-800); border-radius: var(--radius-sm); background: ' + (isTorneo ? 'transparent' : 'var(--ink-800)') + '; color: ' + (isTorneo ? 'var(--ink-800)' : 'var(--cream-100)') + '; font-family: var(--font-accent); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer;">partida libre</button>' +
      '<button data-act="modeTorneo" class="press" style="flex: 1; height: 44px; border: 1.5px solid var(--ink-800); border-radius: var(--radius-sm); background: ' + (isTorneo ? 'var(--ink-800)' : 'transparent') + '; color: ' + (isTorneo ? 'var(--cream-100)' : 'var(--ink-800)') + '; font-family: var(--font-accent); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer;">torneo</button>' +
    '</div>' +
    (isTorneo
      ? '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding: 8px 8px 8px 14px; border: 1.5px solid var(--ink-800); border-radius: var(--radius-md); background: var(--cream-50);">' +
          '<div style="font-family: var(--font-accent); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-400);">partidas<br>del torneo</div>' +
          '<div style="display: flex; align-items: center; gap: 8px;">' +
            '<button data-act="tgDec" class="press" style="width: 44px; height: 44px; border: 1.5px solid var(--ink-800); border-radius: var(--radius-sm); background: var(--cream-100); font-family: var(--font-display); font-size: 20px; color: var(--ink-800); cursor: pointer; padding: 0;">−</button>' +
            '<div style="font-family: var(--font-display); font-size: 28px; width: 36px; text-align: center;">' + state.tGamesDraft + '</div>' +
            '<button data-act="tgInc" class="press" style="width: 44px; height: 44px; border: 1.5px solid var(--ink-800); border-radius: var(--radius-sm); background: var(--cream-100); font-family: var(--font-display); font-size: 20px; color: var(--ink-800); cursor: pointer; padding: 0;">+</button>' +
          '</div>' +
        '</div>'
      : '') +
    '<button data-act="startPartida" class="btn btn-primary"' + (selCount < 2 ? ' disabled' : '') + '>' + (isTorneo ? 'empezar torneo' : 'empezar partida') + '</button>';
  }

  function gameHTML(ctx) {
    const { g, s, mi, cards, fin, t, activesArr, board } = ctx;
    const pedir = g.phase === 'pedir';
    const arr = pedir ? g.bids : g.wons;
    const sum = arr.reduce((a, b) => a + b, 0);
    const eq = sum === cards;
    const valid = pedir ? !eq : eq;
    const sumLeft = (pedir ? 'piden ' : 'ganadas ') + sum + ' de ' + cards;
    const sumRight = pedir
      ? (eq ? 'no pueden pedir justas' : (sum > cards ? 'van de más' : 'van de menos'))
      : (eq ? 'cierra justo' : 'deben sumar ' + cards);
    const sumColor = valid ? 'var(--ink-400)' : 'var(--red-500)';
    const kicker = t ? ('torneo · partida ' + t.game + ' de ' + t.total) : 'partida libre';

    const boardHTML = board.map((p, i) =>
      '<div style="flex: 1; min-width: 0; padding: 12px 4px 8px; text-align: center; position: relative; border-left: ' + (i === 0 ? 'none' : '1px solid var(--cream-200)') + ';">' +
        (p.isLeader ? '<div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--red-500);"></div>' : '') +
        '<div style="width: 30px; height: 30px; border-radius: 50%; background: ' + p.color + '; color: var(--cream-100); font-family: var(--font-display); font-size: 15px; display: flex; align-items: center; justify-content: center; margin: 0 auto 5px;">' + esc(p.initial) + '</div>' +
        '<div style="font-family: var(--font-accent); font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ink-400);">' + esc(p.name) + '</div>' +
        '<div style="font-family: var(--font-display); font-size: 26px; line-height: 1.1; margin-top: 1px;">' + p.total + '</div>' +
        '<div style="font-family: var(--font-display); font-size: 11px; height: 13px; color: ' + p.deltaColor + ';">' + p.deltaLabel + '</div>' +
      '</div>'
    ).join('');

    const entryRows = activesArr.map((p, i) =>
      '<div style="display: flex; align-items: center; gap: 10px; padding: 6px 0; border-top: 1px solid var(--cream-200);">' +
        avatar(p, 26, 13) +
        '<div style="flex: 1; min-width: 0;">' +
          '<div style="font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + esc(p.name) + '</div>' +
          (!pedir ? '<div style="font-size: 11px; color: var(--ink-400);">pidió ' + g.bids[i] + '</div>' : '') +
        '</div>' +
        '<div style="display: flex; align-items: center; gap: 6px; flex: none;">' +
          stepBtn('decEntry', i, '−') +
          '<div style="width: 30px; text-align: center; font-family: var(--font-display); font-size: 24px;">' + arr[i] + '</div>' +
          stepBtn('incEntry', i, '+') +
        '</div>' +
      '</div>'
    ).join('');

    const { order, rank } = ctx.placement;
    const ranking = order.map((pi) => {
      const tp = (t && fin) ? '+' + rank[pi] + ' pt torneo' : '';
      return '<div style="display: flex; align-items: center; gap: 10px; padding: 9px 0; border-top: 1px solid var(--ink-600);">' +
        '<div style="font-family: var(--font-display); font-size: 16px; color: var(--red-400); width: 24px; flex: none;">' + rank[pi] + 'º</div>' +
        avatar(activesArr[pi], 24, 12, ' border: 1px solid var(--ink-600);') +
        '<div style="flex: 1; min-width: 0; font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + esc(activesArr[pi].name) + '</div>' +
        (tp ? '<div style="font-family: var(--font-accent); font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(235,228,210,0.55);">' + tp + '</div>' : '') +
        '<div style="font-family: var(--font-display); font-size: 20px;">' + g.totals[pi] + '</div>' +
      '</div>';
    }).join('');
    const winnerName = activesArr[order[0]] ? activesArr[order[0]].name : '';
    let finPrimaryLabel = 'nueva partida';
    if (t) finPrimaryLabel = t.game < t.total ? 'siguiente partida' : 'ver la tabla final';

    return '' +
    '<div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 12px;">' +
      '<div style="min-width: 0;">' +
        '<div class="kicker">' + esc(kicker) + '</div>' +
        '<div class="title">' + (fin ? 'fin de la partida' : 'mano de ' + cards) + '</div>' +
        (!fin && extraTens(mi) ? '<div style="display: inline-block; margin-top: 8px; padding: 5px 10px; background: var(--red-500); color: var(--cream-100); font-family: var(--font-accent); font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase; border-radius: 4px;">sin triunfo</div>' : '') +
      '</div>' +
      '<div style="text-align: right; flex: none;">' +
        '<div style="font-family: var(--font-display); font-size: 22px; line-height: 1;">' + (fin ? s.length : mi + 1) + '/' + s.length + '</div>' +
        '<div style="font-family: var(--font-accent); font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-400); margin-top: 3px;">manos</div>' +
      '</div>' +
    '</div>' +
    '<div style="height: 3px; background: var(--cream-200); margin: 14px 0 16px; position: relative;">' +
      '<div style="position: absolute; top: 0; bottom: 0; left: 0; width: ' + Math.round((fin ? s.length : mi) / s.length * 100) + '%; background: var(--red-500); transition: width 0.4s var(--ease-out);"></div>' +
    '</div>' +
    '<div style="display: flex; border: 1.5px solid var(--ink-800); border-radius: var(--radius-md); background: var(--cream-50); box-shadow: var(--shadow-hard-sm); overflow: hidden; margin-bottom: 16px;">' + boardHTML + '</div>' +
    (!fin
      ? '<div style="border: 1.5px solid var(--ink-800); border-radius: var(--radius-md); background: var(--cream-50); padding: 16px; box-shadow: var(--shadow-hard-sm);">' +
          '<div style="font-family: var(--font-display); font-size: 22px; line-height: 1.1;">' + (pedir ? '¿cuántas piden?' : '¿cuántas ganaron?') + '</div>' +
          '<div style="font-family: var(--font-accent); font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-400); margin: 4px 0 8px;">mano de ' + cards + (cards === 1 ? ' carta' : ' cartas') + ' · ' + (mi + 1) + ' de ' + s.length + (extraTens(mi) ? ' · sin triunfo' : '') + '</div>' +
          entryRows +
          '<div style="display: flex; justify-content: space-between; align-items: center; margin: 10px 0 12px; font-family: var(--font-accent); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;">' +
            '<span style="color: var(--ink-400);">' + sumLeft + '</span>' +
            '<span style="color: ' + sumColor + ';">' + sumRight + '</span>' +
          '</div>' +
          '<button data-act="primary" class="btn btn-primary"' + (!valid ? ' disabled' : '') + '>' + (pedir ? 'confirmar pedidas' : 'cerrar mano') + '</button>' +
          '<div style="display: flex; gap: 8px; margin-top: 10px; justify-content: space-between;">' +
            (state.undoStack.length ? smallBtn('undo', 'deshacer') : '') +
            smallBtn('resetMano', 'reiniciar mano') +
            '<button data-act="resetPartida" style="height: 36px; padding: 0 10px; border: none; background: none; font-family: var(--font-accent); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-400); cursor: pointer; margin-left: auto;">reiniciar partida</button>' +
          '</div>' +
        '</div>'
      : '<div style="border-radius: var(--radius-md); background: var(--ink-800); color: var(--cream-100); padding: 18px; box-shadow: var(--shadow-hard-red);">' +
          '<div style="font-family: var(--font-accent); font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(235,228,210,0.55);">fin de la partida</div>' +
          '<div style="font-family: var(--font-display); font-size: 27px; margin: 4px 0 12px;">gana ' + esc(winnerName) + '</div>' +
          ranking +
          '<div style="margin-top: 14px; display: flex; flex-direction: column; gap: 8px;">' +
            '<button data-act="finPrimary" class="btn btn-primary">' + finPrimaryLabel + '</button>' +
            (state.undoStack.length
              ? '<button data-act="undo" style="height: 40px; border: 1.5px solid var(--cream-200); border-radius: var(--radius-sm); background: transparent; font-family: var(--font-accent); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--cream-100); cursor: pointer;">deshacer última mano</button>'
              : '') +
          '</div>' +
        '</div>') +
    '<button data-act="resetSession" class="press" style="width: 100%; margin-top: 14px; height: 44px; border: 1.5px solid var(--ink-800); border-radius: var(--radius-sm); background: transparent; font-family: var(--font-accent); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-800); cursor: pointer;">reiniciar sesión · cambiar jugadores</button>';
  }

  function planillaHTML(ctx) {
    const { g, t, board } = ctx;
    const hist = g.hist || [];
    const kicker = t ? ('torneo · partida ' + t.game + ' de ' + t.total) : 'partida libre';
    let inner;
    if (!hist.length) {
      inner = '<p style="font-size: 12.5px; color: var(--ink-400); margin-top: 14px; line-height: 1.5;">todavía no se cerró ninguna mano. la planilla se va llenando a medida que juegan.</p>';
    } else {
      const head = board.map((p) =>
        '<div style="flex: 1; padding: 6px 0; display: flex; justify-content: center;">' +
          '<div style="width: 22px; height: 22px; border-radius: 50%; background: ' + p.color + '; color: var(--cream-100); font-family: var(--font-display); font-size: 11px; display: flex; align-items: center; justify-content: center;">' + esc(p.initial) + '</div>' +
        '</div>'
      ).join('');
      const rows = hist.map((h) =>
        '<div style="display: flex; align-items: center; border-top: 1px solid var(--cream-200);">' +
          '<div style="width: 46px; flex: none; text-align: center; font-family: var(--font-display); font-size: 14px; padding: 7px 0; color: ' + (h.st ? 'var(--red-500)' : 'var(--ink-400)') + ';">' + h.cards + '</div>' +
          h.totals.map((tv, i) =>
            '<div style="flex: 1; text-align: center; font-family: var(--font-display); font-size: 15px; color: ' + (h.deltas[i] < 0 ? 'var(--red-500)' : 'var(--ink-800)') + ';">' + tv + '</div>'
          ).join('') +
        '</div>'
      ).join('');
      const totals = board.map((p) =>
        '<div style="flex: 1; text-align: center; font-family: var(--font-display); font-size: 17px; color: var(--ink-800);">' + p.total + '</div>'
      ).join('');
      inner = '<div style="margin-top: 16px;">' +
        '<div style="border: 1.5px solid var(--ink-800); border-radius: var(--radius-md); background: var(--cream-50); overflow: hidden;">' +
          '<div style="display: flex; align-items: center; background: var(--cream-100);">' +
            '<div style="width: 46px; flex: none; padding: 8px 0; text-align: center; font-family: var(--font-accent); font-size: 8px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-400);">mano</div>' + head +
          '</div>' +
          rows +
          '<div style="display: flex; align-items: center; border-top: 1.5px solid var(--ink-800); background: var(--cream-100);">' +
            '<div style="width: 46px; flex: none; text-align: center; font-family: var(--font-accent); font-size: 8px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-800); padding: 10px 0;">total</div>' + totals +
          '</div>' +
        '</div>' +
        '<p style="font-size: 11px; color: var(--ink-400); margin: 8px 2px 0;">total acumulado por mano · celda roja: mano fallada · nº rojo: mano sin triunfo.</p>' +
      '</div>';
    }
    return '<div class="kicker">' + esc(kicker) + '</div><div class="title">la planilla</div>' + inner;
  }

  function torneoHTML(ctx) {
    const { g, t, fin, activesArr } = ctx;
    const g0 = state.game;
    const tDone = !!t && !!g0 && t.game >= t.total && fin;
    const tPts = t ? (t.points || activesArr.map(() => 0)) : [];
    const tOrder = tPts.map((v, i) => i).sort((a, b) => tPts[a] - tPts[b]);
    const tRank = Array(tPts.length).fill(1);
    tOrder.forEach((pi, pos) => {
      tRank[pi] = (pos > 0 && tPts[pi] === tPts[tOrder[pos - 1]]) ? tRank[tOrder[pos - 1]] : pos + 1;
    });
    const played = t ? (t.game - 1 + (fin ? 1 : 0)) : 0;
    const tKicker = t ? ('partida ' + Math.min(t.game, t.total) + ' de ' + t.total + ' · ' + played + ' jugadas') : 'torneo';
    const tTitle = tDone ? ('campeón: ' + (activesArr[tOrder[0]] ? activesArr[tOrder[0]].name.toLowerCase() : '')) : (t ? 'la tabla' : 'armar torneo');

    let inner;
    if (!t) {
      inner = '<div style="border: 1.5px solid var(--ink-800); border-radius: var(--radius-md); background: var(--cream-50); padding: 18px 16px; box-shadow: var(--shadow-hard-sm); margin-top: 16px;">' +
        '<p style="font-size: 13px; line-height: 1.55; color: var(--ink-800); margin: 0 0 8px;">el torneo se arma al iniciar una partida: elegís quiénes juegan, marcás "torneo" y cuántas partidas.</p>' +
        '<p style="font-size: 12.5px; line-height: 1.5; color: var(--ink-400); margin: 0 0 16px;">cada partida reparte puntos según el puesto: el 1º suma 1, el 2º suma 2… gana el torneo quien menos puntos junta.</p>' +
        (!g0
          ? '<button data-act="goSetupTorneo" class="btn btn-primary">armar torneo</button>'
          : '<p style="font-size: 12px; color: var(--red-500); margin: 0; line-height: 1.5;">hay una partida en curso: terminala (o reiniciala) antes de armar un torneo.</p>') +
      '</div>';
    } else {
      const rows = tOrder.map((pi, pos) =>
        '<div style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-top: ' + (pos === 0 ? 'none' : '1px solid var(--cream-200)') + '; background: ' + (tRank[pi] === 1 ? 'rgba(191, 23, 22, 0.05)' : 'transparent') + ';">' +
          '<div style="font-family: var(--font-display); font-size: 18px; width: 26px; flex: none; color: ' + (tRank[pi] === 1 ? 'var(--red-500)' : 'var(--ink-800)') + ';">' + tRank[pi] + 'º</div>' +
          avatar(activesArr[pi], 30, 14) +
          '<div style="flex: 1; min-width: 0;">' +
            '<div style="font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + esc(activesArr[pi].name) + '</div>' +
            (tRank[pi] === 1 ? '<div style="font-family: var(--font-accent); font-size: 8px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--red-500); margin-top: 2px;">va primero</div>' : '') +
          '</div>' +
          '<div style="font-family: var(--font-display); font-size: 24px;">' + tPts[pi] + '</div>' +
          '<div style="font-family: var(--font-accent); font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-400);">pts</div>' +
        '</div>'
      ).join('');
      inner = '' +
      '<div style="height: 3px; background: var(--cream-200); margin: 14px 0 16px; position: relative;">' +
        '<div style="position: absolute; top: 0; bottom: 0; left: 0; width: ' + Math.round(played / t.total * 100) + '%; background: var(--red-500); transition: width 0.4s var(--ease-out);"></div>' +
      '</div>' +
      '<div style="border: 1.5px solid var(--ink-800); border-radius: var(--radius-md); background: var(--cream-50); box-shadow: var(--shadow-hard-sm); overflow: hidden;">' + rows + '</div>' +
      '<p style="font-size: 11.5px; color: var(--ink-400); margin: 12px 2px 0; line-height: 1.5;">se suma el puesto de cada partida · menos puntos = mejor puesto.</p>' +
      '<button data-act="endTournament" class="press" style="width: 100%; margin-top: 14px; height: 44px; border: 1.5px solid var(--ink-800); border-radius: var(--radius-sm); background: transparent; font-family: var(--font-accent); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-800); cursor: pointer;">' + (tDone ? 'cerrar torneo' : 'terminar torneo') + '</button>';
    }
    return '<div class="kicker">' + esc(tKicker) + '</div><div class="title">' + esc(tTitle) + '</div>' + inner;
  }

  function jugadoresHTML() {
    const players = state.players;
    const cards = players.map((p, i) => {
      const swatches = PALETTE.map((sw, j) => {
        const selc = p.color === sw.c;
        return '<button data-act="pickColor" data-i="' + i + '" data-j="' + j + '" title="' + sw.t + '" style="width: 38px; height: 38px; border-radius: 50%; background: ' + sw.c + '; border: ' + (selc ? '3px solid var(--cream-50)' : '1.5px solid rgba(20, 20, 20, 0.15)') + '; box-shadow: ' + (selc ? '0 0 0 2px var(--ink-800)' : 'none') + '; cursor: pointer; padding: 0;"></button>';
      }).join('');
      return '<div style="border: 1.5px solid var(--ink-800); border-radius: var(--radius-md); background: var(--cream-50); padding: 14px;">' +
        '<div style="display: flex; align-items: center; gap: 12px;">' +
          avatar(p, 42, 20) +
          '<input id="pl-name-' + i + '" data-rename="' + i + '" value="' + esc(p.name) + '" placeholder="nombre" class="name-input" style="flex: 1; font-size: 16px; padding: 6px 2px; border-bottom-color: var(--cream-300);">' +
          (players.length > 2 ? '<button data-act="removePlayer" data-i="' + i + '" style="border: none; background: none; font-family: var(--font-accent); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-400); cursor: pointer; padding: 12px 4px;">quitar</button>' : '') +
        '</div>' +
        '<div style="display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap;">' + swatches + '</div>' +
        '<div style="display: flex; gap: 8px; margin-top: 12px; align-items: center;">' +
          '<label for="selfie-' + i + '" style="height: 38px; padding: 0 14px; border: 1.5px solid var(--ink-800); border-radius: var(--radius-sm); background: var(--cream-100); font-family: var(--font-accent); font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-800); cursor: pointer; display: flex; align-items: center;">' + (p.photo ? 'cambiar foto' : 'selfie') + '</label>' +
          '<input id="selfie-' + i + '" data-selfie="' + i + '" type="file" accept="image/*" capture="user" style="display: none;">' +
          (p.photo ? '<button data-act="clearPhoto" data-i="' + i + '" style="border: none; background: none; font-family: var(--font-accent); font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-400); cursor: pointer; padding: 12px 6px;">quitar foto</button>' : '') +
        '</div>' +
      '</div>';
    }).join('');
    return '' +
    '<div class="kicker">jugadores</div>' +
    '<div class="title">la mesa</div>' +
    '<div style="display: flex; flex-direction: column; gap: 10px; margin-top: 16px;">' + cards + '</div>' +
    (players.length < 5
      ? '<button data-act="addPlayer" class="press" style="width: 100%; margin-top: 12px; height: 50px; border: 1.5px dashed var(--ink-400); border-radius: var(--radius-md); background: none; font-family: var(--font-accent); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-800); cursor: pointer;">+ añadir jugador · máx. 5</button>'
      : '') +
    '<p style="font-size: 11.5px; color: var(--ink-400); margin: 14px 2px 0; line-height: 1.5;">agregar o quitar jugadores reinicia la partida y el torneo en curso. los nombres y colores se pueden cambiar en cualquier momento.</p>' +
    '<button data-act="logout" class="press" style="width: 100%; margin-top: 16px; height: 44px; border: 1.5px solid var(--ink-800); border-radius: var(--radius-sm); background: transparent; font-family: var(--font-accent); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-800); cursor: pointer;">salir</button>';
  }

  function reglasHTML() {
    const d = demoData();
    const deck =
      '<div style="position: absolute; left: 132px; top: 139px; transform: translate(-50%, -50%);">' +
        '<div style="position: absolute; left: 3px; top: 3px; width: 26px; height: 36px; border-radius: 4px; background: var(--ink-700);"></div>' +
        '<div style="position: relative; width: 26px; height: 36px; border-radius: 4px; background: var(--ink-800); border: 1.5px solid var(--cream-50);"></div>' +
      '</div>' +
      '<div style="position: absolute; left: 175px; top: 139px; width: 40px; height: 28px; transform: translate(-50%, -50%); border-radius: 4px; background: var(--cream-50); border: 1.5px solid var(--ink-800); box-shadow: var(--shadow-sm); display: flex; align-items: center; justify-content: center; gap: 4px;">' +
        '<div style="font-family: var(--font-display); font-size: 13px; color: var(--ink-800); line-height: 1;">6</div>' + SVG_ORO +
      '</div>';
    const cards = d.cards.map((c, i) =>
      '<div id="demo-card-' + i + '" style="position: absolute; left: ' + c.x + 'px; top: ' + c.y + 'px; width: 30px; height: 41px; border-radius: 4px; background: var(--cream-50); border: 1.5px solid ' + c.border + '; box-shadow: var(--shadow-sm); transform: translate(-50%, -50%) rotate(' + c.rot + 'deg); opacity: ' + c.op + '; transition: all 0.6s var(--ease-out); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;">' +
        '<div style="font-family: var(--font-display); font-size: 13px; line-height: 1; color: var(--ink-800);">' + c.n + '</div>' +
        (c.isOro ? SVG_ORO : '') + (c.isCopa ? SVG_COPA : '') + (c.isBasto ? SVG_BASTO : '') +
      '</div>'
    ).join('');
    const kept = d.keptVisible
      ? '<div id="demo-kept" style="position: absolute; left: ' + d.keptX + 'px; top: ' + d.keptY + 'px; width: 30px; height: 41px; border-radius: 4px; background: var(--cream-50); border: 1.5px dashed var(--ink-400); transform: translate(-50%, -50%) rotate(' + d.keptRot + 'deg); opacity: ' + d.keptOp + '; transition: all 0.6s var(--ease-out); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;">' +
          '<div style="font-family: var(--font-display); font-size: 13px; line-height: 1; color: var(--ink-800);">5</div>' + SVG_ORO +
        '</div>'
      : '';
    const seats = d.seats.map((st) =>
      '<div style="position: absolute; left: ' + st.x + 'px; top: ' + st.y + 'px; transform: translate(-50%, -50%); text-align: center;">' +
        '<div style="width: 30px; height: 30px; border-radius: 50%; background: ' + st.color + '; color: var(--cream-100); font-family: var(--font-display); font-size: 14px; display: flex; align-items: center; justify-content: center; margin: 0 auto;">' + esc(st.initial) + '</div>' +
        '<div style="font-family: var(--font-accent); font-size: 8px; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 3px; color: var(--ink-400);">' + esc(st.name) + '</div>' +
      '</div>'
    ).join('');
    const rules = [
      ['las manos', 'se sube del 1 al 10, se juegan tantas manos de 10 sin triunfo como jugadores haya, y se baja del 10 al 1 con triunfo.'],
      ['las pedidas', 'antes de jugar cada mano, cada jugador dice cuántas bazas va a ganar. la suma nunca puede dar justo: siempre queda una carta de más o de menos. puede que nadie pida.'],
      ['la puntuación', 'si cumplís lo pedido sumás 5 puntos más 1 por cada carta ganada. si fallás, restás la diferencia entre lo pedido y lo ganado.'],
      ['el triunfo', 'el mazo queda con una carta dada vuelta: ese palo es el triunfo. si no tenés el palo que se juega, tenés que fallar con triunfo; el que sigue solo está obligado a tirar triunfo si tiene uno que mate al que está en la mesa.'],
      ['el valor de las cartas', 'de mayor a menor: 1, 3, 12 (rey), 11 (caballo), 10 (sota), 7, 6, 5, 4 y 2.'],
      ['el torneo', 'tu puesto en cada partida son tus puntos de torneo. el que menos puntos junta va primero.'],
    ].map((r, i) =>
      '<div style="display: flex; gap: 14px; padding: 13px 2px; border-top: 1px solid var(--cream-200);' + (i === 5 ? ' border-bottom: 1px solid var(--cream-200);' : '') + '">' +
        '<div style="font-family: var(--font-display); font-size: 16px; color: var(--red-500); flex: none; width: 22px;">0' + (i + 1) + '</div>' +
        '<div>' +
          '<div style="font-size: 14px; font-weight: 600;">' + r[0] + '</div>' +
          '<div style="font-size: 12.5px; color: var(--ink-400); line-height: 1.5; margin-top: 2px;">' + r[1] + '</div>' +
        '</div>' +
      '</div>'
    ).join('');
    return '' +
    '<div class="kicker">reglas</div>' +
    '<div class="title">cómo se juega</div>' +
    '<div style="border: 1.5px solid var(--ink-800); border-radius: var(--radius-md); background: var(--cream-50); box-shadow: var(--shadow-hard-sm); padding: 16px; margin-top: 16px;">' +
      '<div style="font-family: var(--font-display); font-size: 20px;">la mano fallada</div>' +
      '<div id="demo-root" style="position: relative; width: 300px; height: 278px; margin: 0 auto;">' +
        '<div style="position: absolute; left: 50%; top: 50%; width: 178px; height: 178px; transform: translate(-50%, -50%); border-radius: 50%; border: 2px solid var(--ink-800); background: var(--cream-100);"></div>' +
        '<div style="position: absolute; left: 50%; top: 50%; width: 152px; height: 152px; transform: translate(-50%, -50%); border-radius: 50%; border: 1px solid var(--cream-300);"></div>' +
        deck + cards + kept + seats +
      '</div>' +
      '<div id="demo-caption" style="min-height: 36px; font-size: 12.5px; line-height: 1.45; color: var(--ink-400); text-align: center; margin-bottom: 12px;">' + esc(d.caption) + '</div>' +
      '<button id="demo-btn" data-act="playDemo" class="btn btn-ink">' + d.btnLabel + '</button>' +
    '</div>' +
    '<div style="display: flex; flex-direction: column; margin-top: 18px;">' + rules + '</div>' +
    '<p style="font-size: 11px; color: var(--ink-400); margin: 14px 2px 0;">próximamente: más reglas animadas sobre la mesa.</p>';
  }

  function tabbarHTML() {
    const defs = [
      { key: 'partida', label: 'partida' },
      { key: 'planilla', label: 'planilla' },
      { key: 'torneo', label: 'torneo' },
      { key: 'jugadores', label: 'jugadores' },
      { key: 'reglas', label: 'reglas' },
    ];
    return '<div class="tabbar">' + defs.map((d) => {
      const on = state.tab === d.key;
      return '<button data-act="tab" data-key="' + d.key + '">' +
        '<div class="bar" style="background: ' + (on ? 'var(--red-500)' : 'transparent') + '; pointer-events: none;"></div>' +
        '<div class="lbl" style="color: ' + (on ? 'var(--ink-800)' : 'var(--ink-400)') + '; pointer-events: none;">' + d.label + '</div>' +
      '</button>';
    }).join('') + '</div>';
  }

  // ---- Render ----------------------------------------------
  function buildCtx() {
    const g0 = state.game;
    const activesArr = actives();
    const sel = state.sel || state.players.map(() => true);
    const n = activesArr.length;
    const s = seq();
    const g = g0 || fresh(n);
    const mi = Math.min(g.mano, s.length - 1);
    const cards = s[mi];
    const fin = g.phase === 'fin';
    const hasPlay = g.mano > 0;
    const placement = placements(g.totals);
    const board = activesArr.map((p, i) => ({
      name: p.name, color: avBg(p), initial: avTx(p),
      total: g.totals[i],
      deltaLabel: g.deltas ? (g.deltas[i] < 0 ? '−' + Math.abs(g.deltas[i]) : '+' + g.deltas[i]) : '',
      deltaColor: g.deltas && g.deltas[i] < 0 ? 'var(--red-500)' : 'var(--ink-400)',
      isLeader: hasPlay && placement.rank[i] === 1,
    }));
    return { g0, g, s, mi, cards, fin, t: state.t, activesArr, sel, players: state.players, board, placement };
  }

  function render() {
    const focusEl = document.activeElement;
    const focusId = (focusEl && focusEl.id && app.contains(focusEl)) ? focusEl.id : null;
    let selStart = null;
    if (focusId && typeof focusEl.selectionStart === 'number') selStart = focusEl.selectionStart;

    const ctx = buildCtx();
    let content = '';
    if (state.tab === 'partida') content = ctx.g0 ? gameHTML(ctx) : setupHTML(ctx);
    else if (state.tab === 'planilla') content = planillaHTML(ctx);
    else if (state.tab === 'torneo') content = torneoHTML(ctx);
    else if (state.tab === 'jugadores') content = jugadoresHTML();
    else if (state.tab === 'reglas') content = reglasHTML();

    app.innerHTML =
      (state.entered ? '' : loginHTML()) +
      '<div class="scroll">' + content + '</div>' +
      tabbarHTML();

    if (focusId) {
      const el = document.getElementById(focusId);
      if (el) {
        el.focus();
        if (selStart != null && el.setSelectionRange) {
          try { el.setSelectionRange(selStart, selStart); } catch (e) {}
        }
      }
    }
  }

  // ---- Eventos ---------------------------------------------
  app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const i = el.dataset.i != null ? +el.dataset.i : -1;
    switch (el.dataset.act) {
      case 'enter': setState({ entered: true }); break;
      case 'logout': setState({ entered: false, tab: 'partida' }); break;
      case 'tab': setState({ tab: el.dataset.key }); break;
      case 'selToggle': setState({ sel: state.sel.map((v, j) => j === i ? !v : v) }); break;
      case 'addPlayer': addPlayer(); break;
      case 'modeLibre': setState({ setupMode: 'libre' }); break;
      case 'modeTorneo': setState({ setupMode: 'torneo' }); break;
      case 'tgDec': setState({ tGamesDraft: Math.max(1, state.tGamesDraft - 1) }); break;
      case 'tgInc': setState({ tGamesDraft: Math.min(20, state.tGamesDraft + 1) }); break;
      case 'startPartida': startPartida(); break;
      case 'goJugadores': setState({ tab: 'jugadores' }); break;
      case 'incEntry': adj(state.game.phase === 'pedir' ? 'bids' : 'wons', i, 1); break;
      case 'decEntry': adj(state.game.phase === 'pedir' ? 'bids' : 'wons', i, -1); break;
      case 'primary': state.game.phase === 'pedir' ? confirmBids() : closeMano(); break;
      case 'undo': undo(); break;
      case 'resetMano': resetMano(); break;
      case 'resetPartida': resetPartida(); break;
      case 'resetSession': setState({ game: null, t: null, active: null, undoStack: [], tab: 'partida' }); break;
      case 'finPrimary': finPrimary(); break;
      case 'goSetupTorneo': setState({ tab: 'partida', setupMode: 'torneo' }); break;
      case 'endTournament': setState({ t: null }); break;
      case 'removePlayer': resetTable(state.players.filter((q, j) => j !== i)); break;
      case 'pickColor': {
        const sw = PALETTE[+el.dataset.j];
        setState({ players: state.players.map((q, j) => j === i ? Object.assign({}, q, { color: sw.c }) : q) });
        break;
      }
      case 'clearPhoto': setState({ players: state.players.map((q, j) => j === i ? Object.assign({}, q, { photo: null }) : q) }); break;
      case 'playDemo': playDemo(); break;
    }
  });

  app.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.rename != null) {
      const i = +el.dataset.rename;
      setState({ players: state.players.map((q, j) => j === i ? Object.assign({}, q, { name: el.value }) : q) });
    }
  });

  app.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.selfie != null) takeSelfie(+el.dataset.selfie, el);
  });

  render();
})();
