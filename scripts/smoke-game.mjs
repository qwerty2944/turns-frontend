// End-to-end smoke test:
// - Sign up two players
// - Player A creates room, Player B joins by id
// - Toggle ready, start, play a few cards
import { Client } from "@colyseus/sdk";

const BACK = process.env.BACKEND_URL || "http://localhost:2567";
const WS = process.env.COLYSEUS_URL || "ws://localhost:2567";

const signup = async (email) => {
  const res = await fetch(`${BACK}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "abcdef", passwordConfirm: "abcdef" }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (data.error?.includes("이미")) {
      const login = await fetch(`${BACK}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "abcdef" }),
      }).then((r) => r.json());
      return login;
    }
    throw new Error(`signup failed ${res.status} ${JSON.stringify(data)}`);
  }
  return res.json();
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const a = await signup(`a${Date.now()}@x.com`);
const b = await signup(`b${Date.now()}@x.com`);
console.log("auth ok:", a.user.email, "+", b.user.email);

const cA = new Client(WS);
const cB = new Client(WS);
const rA = await cA.create("love_letter", {
  token: a.token,
  roomName: "Test Table",
  maxPlayers: 2,
});
console.log("A created room", rA.roomId);
const rB = await cB.joinById(rA.roomId, { token: b.token });
console.log("B joined", rB.sessionId);

let lastPhase = "";
const states = [rA, rB].map((r, i) => {
  r.onStateChange((s) => {
    if (s.phase !== lastPhase) {
      lastPhase = s.phase;
      console.log(`[${i === 0 ? "A" : "B"}] phase=${s.phase} deck=${s.deckRemaining} players=${s.players.size}`);
    }
  });
  r.onMessage("hand", (m) => console.log(`[${i === 0 ? "A" : "B"}] hand`, m.cards));
  return r;
});

await wait(500);
rB.send("toggleReady");
await wait(500);
rA.send("startGame");
await wait(1000);

// Force both players to play a card sequentially.
let handA = [], handB = [];
rA.onMessage("hand", (m) => (handA = m.cards));
rB.onMessage("hand", (m) => (handB = m.cards));
await wait(800);

const playTurn = async (r, hand, sids) => {
  if (!hand.length) return;
  const card = hand[0];
  const target = sids.find((s) => s !== r.sessionId);
  const payload = { card, targetSessionId: target };
  if (card === 1) payload.guardGuess = 5;
  r.send("playCard", payload);
};

const sids = [rA.sessionId, rB.sessionId];
for (let i = 0; i < 4; i++) {
  await wait(400);
  await playTurn(rA, handA, sids);
  await wait(400);
  await playTurn(rB, handB, sids);
}

await wait(800);
console.log("done");
process.exit(0);
