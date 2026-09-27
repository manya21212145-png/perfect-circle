// Online duel on two devices: Duel lobby (create with code + QR, or join) and Duel play
// (3-2-1 countdown, opponent's live progress bar, round and match results).
// Routes: #/duel  and  #/duel/ABCD (opened from the QR code)

import type { Socket } from 'socket.io-client';
import { h, navButton, REASONS, shapeIcon, toast, topBar, type Screen } from './ui';
import { HAS_SERVER } from '../config';
import { Board } from './board';
import { getStage, showBadges } from './play';
import { SHAPE_NAMES } from '../scoring/templates';
import { modeName } from '../modes';
import { isRoomCode, type Countdown, type JoinReply, type MatchResult, type RoomState, type RoundResult, type Seat } from '../duel/room';
import { playSound } from '../render/sound';
import { addDuelWin, getSettings, session } from '../state';

const NICK_KEY = 'pc-guest-nick';
const other = (s: Seat): Seat => (s === 'host' ? 'guest' : 'host');

export const duelScreen: Screen = (root, params) => {
  let socket: Socket | null = null;
  let seat: Seat | null = null;
  let seatToken: string | undefined;
  let code: string | null = null;
  let room: RoomState | null = null;
  let board: Board | null = null;
  let round = 0;
  let lastProgress = 0;
  let countdownTimer = 0;
  let closed = false;

  const panel = h('main', { class: 'page' });
  const hud = h('div', { class: 'duel-hud', hidden: true });
  const meBar = h('div', { class: 'bar-fill' });
  const themBar = h('div', { class: 'bar-fill them' });
  const meName = h('span');
  const themName = h('span');
  hud.append(
    h('div', { class: 'bar' }, meName, h('div', { class: 'bar-track' }, meBar)),
    h('div', { class: 'bar' }, themName, h('div', { class: 'bar-track' }, themBar)));
  const big = h('div', { class: 'countdown', 'aria-live': 'assertive' });
  const banner = h('div', { class: 'banner', hidden: true, role: 'status' });
  const roundCard = h('section', { class: 'sheet', hidden: true, 'aria-live': 'polite' });
  root.append(topBar('Duel', '#/home'), panel, hud, big, banner, roundCard);

  const myName = () => session().nickname ?? localStorage.getItem(NICK_KEY) ?? '';
  const names = () => ({ me: room?.players[seat!] ?? 'You', them: room?.players[other(seat!)] ?? 'Opponent' });

  // ---------- lobby ----------
  function showLobby(prefill = '') {
    const signedIn = session().nickname;
    const nick = h('input', { name: 'nickname', value: myName(), required: true, pattern: '[A-Za-z0-9_\\-]{3,16}', placeholder: '3–16 letters or numbers', autocomplete: 'nickname' });
    const codeInput = h('input', { name: 'code', value: prefill, required: true, maxlength: 4, autocomplete: 'off', autocapitalize: 'characters', placeholder: 'ABCD', class: 'code-input', 'aria-label': 'Room code' });
    const nickField = signedIn
      ? h('p', {}, 'Playing as ', h('strong', {}, signedIn))
      : h('label', {}, 'Your nickname ', nick);
    const saveNick = () => { if (!signedIn) localStorage.setItem(NICK_KEY, nick.value.trim()); return signedIn ?? nick.value.trim(); };

    panel.replaceChildren(
      h('p', { class: 'muted' }, 'Both devices must be on the same Wi-Fi as the PC running the game.'),
      nickField,
      h('section', { class: 'card stack' },
        h('h2', {}, 'Start a duel'),
        h('button', { class: 'btn big', type: 'button', onclick: () => {
          if (!signedIn && !nick.reportValidity()) return;
          void connect().then((s) => s.emit('create', { nickname: saveNick() }, onJoined));
        } }, 'Create room')),
      h('form', { class: 'card stack', onsubmit: (e: Event) => {
        e.preventDefault();
        if (!signedIn && !nick.reportValidity()) return;
        const c = codeInput.value.trim().toUpperCase();
        if (!isRoomCode(c)) { toast('Room codes have 4 letters or numbers'); return; }
        void connect().then((s) => s.emit('join', { code: c, nickname: saveNick() }, onJoined));
      } },
      h('h2', {}, 'Join a friend'),
      h('label', {}, 'Room code ', codeInput),
      h('button', { class: 'btn secondary big', type: 'submit' }, 'Join room')));
  }

  // ---------- connection ----------
  async function connect(): Promise<Socket> {
    if (socket) return socket;
    const { io } = await import('socket.io-client');
    const s = io({ reconnectionDelayMax: 2000 });
    socket = s;
    s.on('connect', () => {
      banner.hidden = true;
      if (code && seatToken) s.emit('join', { code, seatToken, nickname: myName() }, (r: JoinReply) => { if (!r.ok) toast(r.error ?? 'Could not rejoin'); });
    });
    s.on('connect_error', () => { banner.textContent = 'Cannot reach the PC server. Is it running, and are you on the same Wi-Fi?'; banner.hidden = false; });
    s.on('disconnect', () => { if (!closed) { banner.textContent = 'Connection lost — reconnecting…'; banner.hidden = false; } });
    s.on('room', (r: RoomState) => { room = r; drawRoom(); });
    s.on('ready', (r: Record<Seat, boolean>) => drawReady(r));
    s.on('countdown', onCountdown);
    s.on('progress', (p: { value: number }) => { themBar.style.width = `${Math.round(p.value * 100)}%`; });
    s.on('round_result', onRoundResult);
    s.on('match_result', onMatchResult);
    return s;
  }

  function onJoined(r: JoinReply) {
    if (!r.ok) { toast(r.error ?? 'Could not join'); return; }
    seat = r.seat!;
    seatToken = r.seatToken;
    code = r.code!;
    history.replaceState(null, '', `#/duel/${code}`);
  }

  // ---------- waiting room ----------
  function drawRoom() {
    if (!room || !seat) return;
    const { me, them } = names();
    meName.textContent = me;
    themName.textContent = them;
    const oppGone = room.players[other(seat)] && !room.connected[other(seat)];
    if (room.status === 'playing' || !panel.isConnected) {
      if (oppGone) { banner.textContent = `${them} lost connection. They have 15 seconds to come back.`; banner.hidden = false; }
      else if (socket?.connected) banner.hidden = true;
      return;
    }
    if (room.status === 'finished') return;

    const qr = h('canvas', { class: 'qr', 'aria-label': `QR code to join room ${room.code}` });
    const link = `${location.origin}/#/duel/${room.code}`;
    void import('qrcode').then((QR) => QR.toCanvas(qr, link, { width: 180, margin: 1 }));
    const both = room.players.host && room.players.guest;
    panel.replaceChildren(
      h('section', { class: 'card stack center' },
        h('p', { class: 'muted' }, 'Room code'),
        h('p', { class: 'room-code' }, room.code),
        both ? null : h('div', { class: 'stack center' }, qr, h('p', { class: 'muted small' }, 'Scan to join, or type the code on the other device.')),
        h('ul', { class: 'players' },
          h('li', {}, room.players.host ?? '…', seat === 'host' ? ' (you)' : '', ' — host'),
          h('li', {}, room.players.guest ?? 'Waiting for a friend…', room.players.guest && seat === 'guest' ? ' (you)' : '')),
        oppGone ? h('p', { class: 'warn' }, `${them} lost connection.`) : '',
        both ? h('button', { class: 'btn big', type: 'button', id: 'ready-btn', onclick: () => {
          socket?.emit('ready');
          (document.getElementById('ready-btn') as HTMLButtonElement).disabled = true;
        } }, 'Ready') : '',
        h('p', { class: 'muted small', id: 'ready-note' }, both ? 'Best of 3 rounds. The PC picks the shape and mode.' : '')));
  }

  function drawReady(r: Record<Seat, boolean>) {
    if (!seat) return;
    const note = document.getElementById('ready-note');
    if (note) note.textContent = r[seat] ? `Waiting for ${names().them} to tap Ready…` : r[other(seat)] ? `${names().them} is ready!` : '';
  }

  // ---------- rounds ----------
  function onCountdown(c: Countdown) {
    round = c.round;
    const localStart = performance.now() + (c.startAt - c.serverNow);
    panel.hidden = true;
    roundCard.hidden = true;
    hud.hidden = false;
    meBar.style.width = '0%';
    themBar.style.width = '0%';

    const settings = { shape: c.shape, mode: c.mode, limitS: c.limitS as 5 | 3 | 2 | undefined, offHand: false };
    board = new Board(settings);
    board.retryOnTap = false;
    board.onProgress = (v) => {
      meBar.style.width = `${Math.round(v * 100)}%`;
      const now = performance.now();
      if (now - lastProgress > 100) { lastProgress = now; socket?.emit('progress', v); } // 10 times a second
    };
    board.onFinish = (r) => {
      socket?.emit('stroke', { round, stroke: r.ok ? r.stroke128 : [], failed: r.ok ? undefined : r.reason });
      big.textContent = r.ok ? `${r.score.toFixed(1)}%` : REASONS[r.reason];
      big.className = 'countdown small';
      playSound(r.ok ? 'good' : 'bad', getSettings().sound);
    };
    const stage = getStage();
    stage.start([board]);
    stage.setTop(64);
    board.reset(localStart, true);

    big.className = 'countdown';
    big.replaceChildren(h('span', { class: 'round-label' }, shapeIcon(c.shape), ` Round ${c.round}: ${SHAPE_NAMES[c.shape]} · ${modeName(settings)}`), h('br'), '3');
    clearInterval(countdownTimer);
    let lastShown = '';
    countdownTimer = window.setInterval(() => {
      const left = localStart - performance.now();
      const text = left > 0 ? String(Math.ceil(left / 1000)) : 'Draw!';
      if (text !== lastShown) {
        lastShown = text;
        (big.lastChild as Text).textContent = text;
        playSound('tick', getSettings().sound);
      }
      if (left <= 0) {
        board?.unlock();
        clearInterval(countdownTimer);
        setTimeout(() => { if (big.textContent?.endsWith('Draw!')) big.textContent = ''; }, 700);
      }
    }, 50);
  }

  function onRoundResult(r: RoundResult) {
    board?.lock();
    if (board && board.phase === 'drawing') board.finish();
    if (!seat) return;
    const { me, them } = names();
    const mine = r.scores[seat];
    const theirs = r.scores[other(seat)];
    const why = (s: Seat) => (r.reasons[s] ? ` (${REASONS[r.reasons[s]!] ?? r.reasons[s]})` : '');
    const tie = mine === theirs;
    big.textContent = '';
    roundCard.replaceChildren(
      h('h2', {}, r.winner === seat ? `You win round ${r.round}!` : `${them} wins round ${r.round}`),
      h('p', {}, `${me}: ${mine.toFixed(1)}%${why(seat)}`),
      h('p', {}, `${them}: ${theirs.toFixed(1)}%${why(other(seat))}`),
      tie ? h('p', { class: 'muted small' }, 'Same score — the faster finish wins the round.') : '',
      h('p', { class: 'muted' }, `Wins: ${me} ${r.wins[seat]} – ${r.wins[other(seat)]} ${them}`));
    roundCard.hidden = false;
  }

  async function onMatchResult(m: MatchResult) {
    clearInterval(countdownTimer);
    board?.lock();
    if (!seat) return;
    const won = m.winner === seat;
    const them = m.players[other(seat)] ?? 'Your opponent';
    big.textContent = '';
    banner.hidden = true;
    roundCard.replaceChildren(
      h('h2', {}, won ? 'You win the duel! 🏆' : `${m.players[m.winner]} wins the duel`),
      m.reason === 'disconnect' ? h('p', {}, won ? `${them} left the duel, so you win.` : 'You were disconnected for too long.') : '',
      h('p', { class: 'muted' }, `Final score: ${m.wins[seat]} – ${m.wins[other(seat)]}`),
      h('div', { class: 'sheet-buttons' },
        m.reason === 'wins' ? h('button', { class: 'btn', type: 'button', onclick: (e: Event) => {
          socket?.emit('ready');
          (e.target as HTMLButtonElement).disabled = true;
          (e.target as HTMLButtonElement).textContent = 'Waiting for opponent…';
        } }, 'Rematch') : '',
        navButton('Home', '#/home', 'btn ghost')));
    roundCard.hidden = false;
    if (won) showBadges(await addDuelWin());
  }

  // ---------- start ----------
  const fromLink = params.path[1]?.toUpperCase();
  if (!HAS_SERVER) {
    panel.replaceChildren(
      h('p', {}, 'Online duels need the Perfect Circle server on your Wi-Fi.'),
      h('p', { class: 'muted' }, 'On this website you can still duel a friend on one device:'),
      navButton('Split-screen duel', '#/split', 'btn big'));
    return () => { getStage().stop(); };
  }
  if (fromLink && isRoomCode(fromLink) && myName()) {
    panel.replaceChildren(h('p', {}, `Joining room ${fromLink}…`));
    void connect().then((s) => s.emit('join', { code: fromLink, nickname: myName() }, (r: JoinReply) => {
      onJoined(r);
      if (!r.ok) showLobby(fromLink);
    }));
  } else {
    showLobby(fromLink ?? '');
  }

  return () => {
    closed = true;
    clearInterval(countdownTimer);
    socket?.disconnect();
    getStage().stop();
  };
};
