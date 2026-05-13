// Full play smoke: 2 players, start game, play 4 turns, then exit cleanly.
import { Client } from "@colyseus/sdk";

const BACK = "http://localhost:2567";
const WS = "ws://localhost:2567";

const signup = async (email) => {
  const r = await fetch(`${BACK}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "abcdef", passwordConfirm: "abcdef" }),
  }).then((x) => x.json());
  if (r.error?.includes("이미")) {
    return fetch(`${BACK}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "abcdef" }),
    }).then((x) => x.json());
  }
  return r;
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const a = await signup(`p1+${Date.now()}@x.com`);
const b = await signup(`p2+${Date.now()}@x.com`);

const cA = new Client(WS);
const cB = new Client(WS);
const rA = await cA.create("love_letter", {
  token: a.token,
  roomName: "Smoke",
  maxPlayers: 2,
});
const rB = await cB.joinById(rA.roomId, { token: b.token });
console.log("rooms:", rA.roomId, "A=", rA.sessionId, "B=", rB.sessionId);

let handA = [];
let handB = [];
rA.onMessage("hand", (m) => (handA = m.cards));
rB.onMessage("hand", (m) => (handB = m.cards));

let stateA = null;
rA.onStateChange((s) => (stateA = s));
rB.onStateChange(() => {});

await wait(500);
rB.send("toggleReady");
await wait(300);
rA.send("startGame");
await wait(1500);
console.log("phase:", stateA?.phase, "deck:", stateA?.deckRemaining);
console.log("handA:", handA, "handB:", handB);

const sids = [rA.sessionId, rB.sessionId];
const myTurn = (r) =>
  stateA?.turnOrder?.[stateA.turnIndex] === r.sessionId;

const pickPlayable = (hand) => {
  // Countess must be played if holding King or Prince
  if (hand.includes(7) && (hand.includes(6) || hand.includes(5))) return 7;
  // Avoid Princess auto-discard
  const safe = hand.filter((c) => c !== 8);
  if (safe.length > 0) return safe[0];
  return hand[0];
};

for (let i = 0; i < 6 && stateA?.phase === "playing"; i++) {
  await wait(300);
  if (myTurn(rA) && handA.length > 0) {
    const card = pickPlayable(handA);
    const payload = { card };
    if ([1, 2, 3, 5, 6].includes(card)) payload.targetSessionId = rB.sessionId;
    if (card === 1) payload.guardGuess = 5;
    console.log(`turn ${i}: A plays`, card);
    rA.send("playCard", payload);
  } else if (myTurn(rB) && handB.length > 0) {
    const card = pickPlayable(handB);
    const payload = { card };
    if ([1, 2, 3, 5, 6].includes(card)) payload.targetSessionId = rA.sessionId;
    if (card === 1) payload.guardGuess = 5;
    console.log(`turn ${i}: B plays`, card);
    rB.send("playCard", payload);
  }
  await wait(600);
}

await wait(500);
console.log("final phase:", stateA?.phase);
console.log("--- log ---");
if (stateA?.log) {
  for (const e of stateA.log) {
    console.log(`[${e.kind}] ${e.text}`);
  }
}
process.exit(0);
