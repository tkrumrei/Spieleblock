(function () {
  'use strict';

  var STORE_KEY = 'spieleblock.wizard.v1';
  var MIN_PLAYERS = 3;
  var MAX_PLAYERS = 6;
  var TOTAL_CARDS = 60;

  // ---------- Speicher (localStorage) ----------

  function loadStore() {
    try {
      var data = JSON.parse(localStorage.getItem(STORE_KEY));
      if (data && typeof data.games === 'object') return data;
    } catch (e) {}
    return { games: {}, activeId: null };
  }

  function saveStore() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch (e) {
      toast('Speichern im Browser ist nicht möglich.');
    }
  }

  var store = loadStore();

  // ---------- Spiellogik ----------

  function roundScore(bid, tricks) {
    return bid === tricks ? 20 + 10 * tricks : -10 * Math.abs(bid - tricks);
  }

  function dealerOf(game, roundIndex) {
    return (game.firstDealer + roundIndex) % game.players.length;
  }

  // Reihenfolge der Ansagen: beginnend links vom Geber, Geber zuletzt.
  function bidOrder(game, roundIndex) {
    var n = game.players.length;
    var dealer = dealerOf(game, roundIndex);
    var order = [];
    for (var i = 1; i <= n; i++) order.push((dealer + i) % n);
    return order;
  }

  function isFinished(game) {
    return game.rounds.length >= game.totalRounds;
  }

  function currentRoundIndex(game) {
    return game.rounds.length;
  }

  function totals(game) {
    var t = game.players.map(function () { return 0; });
    game.rounds.forEach(function (r) {
      r.bids.forEach(function (bid, p) { t[p] += roundScore(bid, r.tricks[p]); });
    });
    return t;
  }

  function sum(arr) {
    return arr.reduce(function (a, b) { return a + b; }, 0);
  }

  function zeros(n) {
    var a = [];
    for (var i = 0; i < n; i++) a.push(0);
    return a;
  }

  function newCurrent(game) {
    var n = game.players.length;
    return { phase: 'bid', bids: zeros(n), tricks: zeros(n) };
  }

  function createGame(players, firstDealer, noEvenBids) {
    var now = Date.now();
    var game = {
      id: 'g' + now.toString(36) + Math.random().toString(36).slice(2, 6),
      created: now,
      updated: now,
      players: players,
      firstDealer: firstDealer,
      totalRounds: Math.floor(TOTAL_CARDS / players.length),
      options: { noEvenBids: noEvenBids },
      rounds: [],
      current: null
    };
    game.current = newCurrent(game);
    return game;
  }

  function activeGame() {
    return store.activeId ? store.games[store.activeId] : null;
  }

  function touch(game) {
    game.updated = Date.now();
    saveStore();
  }

  // ---------- Hilfsfunktionen UI ----------

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtSigned(n) {
    return n > 0 ? '+' + n : String(n);
  }

  function fmtDate(ts) {
    return new Date(ts).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 2500);
  }

  function showView(name) {
    $('view-setup').classList.toggle('hidden', name !== 'setup');
    $('view-game').classList.toggle('hidden', name !== 'game');
    window.scrollTo(0, 0);
  }

  // ---------- Ansicht: Neues Spiel ----------

  var setupPlayers = [];

  function initSetupPlayers() {
    // Spieler des zuletzt gespielten Spiels vorschlagen.
    var last = Object.keys(store.games)
      .map(function (id) { return store.games[id]; })
      .sort(function (a, b) { return b.updated - a.updated; })[0];
    setupPlayers = last ? last.players.slice() : ['', '', ''];
  }

  function renderSetup() {
    var box = $('player-inputs');
    box.innerHTML = setupPlayers.map(function (name, i) {
      return '<div class="player-row">' +
        '<input type="text" maxlength="20" autocomplete="off" data-idx="' + i + '" ' +
        'placeholder="Spieler ' + (i + 1) + '" value="' + esc(name) + '">' +
        '<button type="button" class="btn-ghost" data-remove="' + i + '" aria-label="Spieler entfernen"' +
        (setupPlayers.length <= MIN_PLAYERS ? ' disabled' : '') + '>✕</button>' +
        '</div>';
    }).join('');
    $('add-player').disabled = setupPlayers.length >= MAX_PLAYERS;
    renderDealerSelect();
    renderSavedGames();
  }

  function setupName(i) {
    return setupPlayers[i].trim() || 'Spieler ' + (i + 1);
  }

  function renderDealerSelect() {
    var sel = $('first-dealer');
    var prev = sel.value;
    sel.innerHTML = setupPlayers.map(function (_, i) {
      return '<option value="' + i + '">' + esc(setupName(i)) + '</option>';
    }).join('');
    if (prev !== '' && Number(prev) < setupPlayers.length) sel.value = prev;
  }

  function renderSavedGames() {
    var games = Object.keys(store.games)
      .map(function (id) { return store.games[id]; })
      .sort(function (a, b) { return b.updated - a.updated; });

    $('saved-card').classList.toggle('hidden', games.length === 0);
    $('saved-list').innerHTML = games.map(function (g) {
      var status = isFinished(g)
        ? 'Beendet'
        : 'Runde ' + (g.rounds.length + 1) + ' von ' + g.totalRounds;
      return '<li>' +
        '<div class="info">' +
        '<div class="names">' + esc(g.players.join(', ')) + '</div>' +
        '<div class="muted small">' + status + ' · ' + fmtDate(g.updated) + '</div>' +
        '</div>' +
        '<button type="button" data-open="' + g.id + '">' + (isFinished(g) ? 'Ansehen' : 'Weiter') + '</button>' +
        '<button type="button" class="btn-ghost btn-danger" data-delete="' + g.id + '" aria-label="Spiel löschen">🗑</button>' +
        '</li>';
    }).join('');
  }

  $('player-inputs').addEventListener('input', function (e) {
    var idx = e.target.getAttribute('data-idx');
    if (idx === null) return;
    setupPlayers[Number(idx)] = e.target.value;
    renderDealerSelect();
  });

  $('player-inputs').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-remove]');
    if (!btn) return;
    setupPlayers.splice(Number(btn.getAttribute('data-remove')), 1);
    renderSetup();
  });

  $('add-player').addEventListener('click', function () {
    if (setupPlayers.length >= MAX_PLAYERS) return;
    setupPlayers.push('');
    renderSetup();
    var inputs = $('player-inputs').querySelectorAll('input');
    inputs[inputs.length - 1].focus();
  });

  $('saved-list').addEventListener('click', function (e) {
    var open = e.target.closest('[data-open]');
    var del = e.target.closest('[data-delete]');
    if (open) {
      store.activeId = open.getAttribute('data-open');
      saveStore();
      openGame();
    } else if (del) {
      var id = del.getAttribute('data-delete');
      var g = store.games[id];
      if (!g || !confirm('Spiel mit ' + g.players.join(', ') + ' wirklich löschen?')) return;
      delete store.games[id];
      if (store.activeId === id) store.activeId = null;
      saveStore();
      renderSavedGames();
    }
  });

  $('start-game').addEventListener('click', function () {
    var names = setupPlayers.map(function (_, i) { return setupName(i); });
    var game = createGame(names, Number($('first-dealer').value) || 0, $('opt-no-even').checked);
    store.games[game.id] = game;
    store.activeId = game.id;
    saveStore();
    openGame();
  });

  // ---------- Ansicht: Spiel ----------

  function openGame() {
    if (!activeGame()) {
      showSetup();
      return;
    }
    showView('game');
    renderGame();
  }

  function showSetup() {
    initSetupPlayers();
    renderSetup();
    showView('setup');
  }

  function renderGame() {
    var game = activeGame();
    if (!game) return;
    renderRound(game);
    renderResult(game);
    renderTable(game);
    $('undo-round').disabled = game.rounds.length === 0;
  }

  function stepper(kind, player, value, max) {
    return '<div class="stepper">' +
      '<button type="button" data-step="' + kind + '" data-player="' + player + '" data-delta="-1"' +
      (value <= 0 ? ' disabled' : '') + ' aria-label="weniger">−</button>' +
      '<span class="val">' + value + '</span>' +
      '<button type="button" data-step="' + kind + '" data-player="' + player + '" data-delta="1"' +
      (value >= max ? ' disabled' : '') + ' aria-label="mehr">+</button>' +
      '</div>';
  }

  function renderRound(game) {
    var card = $('round-card');
    if (isFinished(game)) {
      card.classList.add('hidden');
      return;
    }
    card.classList.remove('hidden');

    var r = currentRoundIndex(game);
    var cards = r + 1;
    var cur = game.current;
    var dealer = dealerOf(game, r);
    var order = bidOrder(game, r);
    var isBid = cur.phase === 'bid';

    var html = '<div class="round-head">' +
      '<h2>Runde ' + cards + ' von ' + game.totalRounds + '</h2>' +
      '<span class="muted small">' + cards + (cards === 1 ? ' Karte' : ' Karten') +
      ' · Geber: ' + esc(game.players[dealer]) + '</span>' +
      '</div>' +
      '<div class="phase-label">' + (isBid ? 'Schritt 1: Ansagen' : 'Schritt 2: Gemachte Stiche') + '</div>';

    order.forEach(function (p, pos) {
      var tags = '';
      if (pos === 0) tags += '<span class="tag">beginnt</span>';
      if (p === dealer) tags += '<span class="tag">Geber</span>';
      var sub = isBid ? '' : '<div class="muted small">Ansage: ' + cur.bids[p] + '</div>';
      html += '<div class="entry">' +
        '<div class="who"><div class="name">' + esc(game.players[p]) + tags + '</div>' + sub + '</div>' +
        stepper(isBid ? 'bid' : 'tricks', p, isBid ? cur.bids[p] : cur.tricks[p], cards) +
        '</div>';
    });

    var ok;
    if (isBid) {
      var bidSum = sum(cur.bids);
      var blocked = game.options.noEvenBids && bidSum === cards;
      ok = !blocked;
      var diff = bidSum - cards;
      var hint = diff === 0 ? 'geht auf' : diff > 0 ? diff + ' zu viel' : -diff + ' zu wenig';
      html += '<div class="sumline' + (blocked ? ' warn' : '') + '">' +
        'Summe der Ansagen: <strong>' + bidSum + '</strong> bei ' + cards + ' Stichen (' + hint + ')' +
        (blocked ? '<br>Die Ansagen dürfen nicht aufgehen – ' + esc(game.players[dealer]) + ' muss anders ansagen.' : '') +
        '</div>' +
        '<button type="button" class="btn-primary btn-block" data-action="confirm-bids"' +
        (ok ? '' : ' disabled') + '>Ansagen festlegen</button>';
    } else {
      var trickSum = sum(cur.tricks);
      ok = trickSum === cards;
      html += '<div class="sumline' + (ok ? '' : ' warn') + '">' +
        'Verteilte Stiche: <strong>' + trickSum + '</strong> von ' + cards +
        (ok ? '' : (trickSum < cards ? ' – es fehlen noch ' + (cards - trickSum) : ' – ' + (trickSum - cards) + ' zu viel')) +
        '</div>' +
        '<div class="btn-row">' +
        '<button type="button" data-action="back-to-bids">← Ansagen</button>' +
        '<button type="button" class="btn-primary" data-action="finish-round"' +
        (ok ? '' : ' disabled') + '>Runde werten</button>' +
        '</div>';
    }

    card.innerHTML = html;
  }

  function ranking(game) {
    var t = totals(game);
    return game.players
      .map(function (name, i) { return { name: name, score: t[i] }; })
      .sort(function (a, b) { return b.score - a.score; });
  }

  function renderResult(game) {
    var card = $('result-card');
    if (!isFinished(game)) {
      card.classList.add('hidden');
      return;
    }
    card.classList.remove('hidden');
    var rank = ranking(game);
    var place = 0;
    var html = '<h2>🏆 Endstand</h2><ol class="ranking">';
    rank.forEach(function (r, i) {
      if (i === 0 || r.score !== rank[i - 1].score) place = i + 1;
      html += '<li><span class="place">' + place + '.</span>' +
        '<span class="rname">' + esc(r.name) + '</span>' +
        '<span class="rscore">' + r.score + '</span></li>';
    });
    html += '</ol><div class="btn-row" style="margin-top:12px">' +
      '<button type="button" class="btn-primary" data-action="rematch">Neues Spiel, gleiche Spieler</button>' +
      '</div>';
    card.innerHTML = html;
  }

  function renderTable(game) {
    var t = totals(game);
    var best = Math.max.apply(null, t);
    var anyRounds = game.rounds.length > 0;

    var head = '<thead><tr><th>#</th>' + game.players.map(function (name, i) {
      var leader = anyRounds && t[i] === best;
      return '<th class="' + (leader ? 'leader' : '') + '">' +
        '<span class="pname">' + esc(name) + '</span>' +
        '<span class="ptotal">' + t[i] + '</span></th>';
    }).join('') + '</tr></thead>';

    var running = game.players.map(function () { return 0; });
    var rows = game.rounds.map(function (r, ri) {
      return '<tr><td>' + (ri + 1) + '</td>' + game.players.map(function (_, p) {
        var delta = roundScore(r.bids[p], r.tricks[p]);
        running[p] += delta;
        return '<td><span class="cum">' + running[p] + '</span>' +
          '<span class="detail">' + r.bids[p] + '/' + r.tricks[p] + ' · ' +
          '<span class="delta ' + (delta >= 0 ? 'pos' : 'neg') + '">' + fmtSigned(delta) + '</span></span></td>';
      }).join('') + '</tr>';
    });

    var body = '<tbody>' + (rows.length
      ? rows.reverse().join('')
      : '<tr><td colspan="' + (game.players.length + 1) + '" class="muted small" style="text-align:center">Noch keine Runde gewertet.</td></tr>') +
      '</tbody>';

    $('score-table').innerHTML = head + body;
  }

  $('round-card').addEventListener('click', function (e) {
    var game = activeGame();
    if (!game || isFinished(game)) return;
    var cur = game.current;
    var cards = currentRoundIndex(game) + 1;

    var step = e.target.closest('[data-step]');
    if (step) {
      var list = step.getAttribute('data-step') === 'bid' ? cur.bids : cur.tricks;
      var p = Number(step.getAttribute('data-player'));
      list[p] = Math.max(0, Math.min(cards, list[p] + Number(step.getAttribute('data-delta'))));
      touch(game);
      renderRound(game);
      return;
    }

    var action = e.target.closest('[data-action]');
    if (!action) return;
    switch (action.getAttribute('data-action')) {
      case 'confirm-bids':
        if (game.options.noEvenBids && sum(cur.bids) === cards) return;
        cur.phase = 'tricks';
        // Stiche mit den Ansagen vorbelegen, falls sie zusammen aufgehen.
        cur.tricks = sum(cur.bids) === cards ? cur.bids.slice() : zeros(game.players.length);
        break;
      case 'back-to-bids':
        cur.phase = 'bid';
        break;
      case 'finish-round':
        if (sum(cur.tricks) !== cards) return;
        game.rounds.push({ bids: cur.bids.slice(), tricks: cur.tricks.slice() });
        game.current = newCurrent(game);
        if (isFinished(game)) toast('Spiel beendet!');
        break;
      default:
        return;
    }
    touch(game);
    renderGame();
  });

  $('result-card').addEventListener('click', function (e) {
    var action = e.target.closest('[data-action="rematch"]');
    var game = activeGame();
    if (!action || !game) return;
    var n = game.players.length;
    var next = createGame(game.players.slice(), (game.firstDealer + 1) % n, game.options.noEvenBids);
    store.games[next.id] = next;
    store.activeId = next.id;
    saveStore();
    renderGame();
    window.scrollTo(0, 0);
  });

  $('undo-round').addEventListener('click', function () {
    var game = activeGame();
    if (!game || game.rounds.length === 0) return;
    if (!confirm('Letzte Runde (' + game.rounds.length + ') wieder öffnen? Eingaben der aktuellen Runde gehen verloren.')) return;
    var last = game.rounds.pop();
    game.current = { phase: 'tricks', bids: last.bids, tricks: last.tricks };
    touch(game);
    renderGame();
  });

  $('to-overview').addEventListener('click', function () {
    store.activeId = null;
    saveStore();
    showSetup();
  });

  // ---------- Start ----------

  if (activeGame()) openGame(); else showSetup();
})();
