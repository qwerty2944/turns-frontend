// Generate Love Letter tarot-style card art using Gemini image generation.
// Usage: GEMINI_API_KEY=... node scripts/generate-cards.mjs
import fs from "node:fs/promises";
import path from "node:path";

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("GEMINI_API_KEY missing");
  process.exit(1);
}

const OUT_DIR = path.resolve(
  process.cwd(),
  "frontend/public/cards",
);

// gemini-2.5-flash-image-preview (formerly nano-banana) supports image generation
const MODEL = "gemini-3-pro-image-preview";

const STYLE = [
  "Vintage tarot card illustration in the style of the Rider-Waite tarot deck,",
  "rich gilded gold filigree border, mystical occult symbols at corners,",
  "deep indigo and crimson palette with aged parchment texture,",
  "intricate medieval line-work, painted with thick gouache and ink,",
  "centered single figure portrait, dramatic chiaroscuro lighting,",
  "no text, no numbers, no words anywhere on the card.",
].join(" ");

const CARDS = [
  { num: 1, name: "guard",     subject: "A vigilant medieval guardsman in burnished plate armor, holding a tall halberd, helmet plumed, watchful eyes" },
  { num: 2, name: "priest",    subject: "A solemn robed priest in ornate ceremonial vestments, clutching an illuminated codex, soft halo of candlelight" },
  { num: 3, name: "baron",     subject: "A haughty noble baron in a fur-trimmed velvet cloak, gripping a jeweled rapier, smug expression, gold rings" },
  { num: 4, name: "handmaid",  subject: "A graceful handmaid in a flowing pale blue gown holding a lace fan to her face, eyes serene and modest" },
  { num: 5, name: "prince",    subject: "A youthful prince in red and gold royal raiments, slender circlet on his brow, holding a single white lily" },
  { num: 6, name: "king",      subject: "A regal seated king on a tall throne, heavy crown, ermine cape, scepter and orb, severe gaze" },
  { num: 7, name: "countess",  subject: "An elegant elder countess in an embroidered black gown, lace ruff, holding a folding hand-fan, knowing smile" },
  { num: 8, name: "princess",  subject: "A radiant princess in a long ivory gown crowned with white roses, hands clasped in prayer, gentle aura" },
  { num: 0, name: "back",      subject: "An ornate tarot card BACK design with a centered radiant sunburst, eye of providence, symmetric arabesque pattern, no figures, no people" },
];

const buildBody = (prompt) => ({
  contents: [{ role: "user", parts: [{ text: prompt }] }],
  generationConfig: { responseModalities: ["IMAGE"] },
});

async function generate(card) {
  const target = path.join(OUT_DIR, `${card.name}.png`);
  try {
    await fs.access(target);
    console.log(`skip (exists): ${card.name}.png`);
    return;
  } catch {}

  const prompt = `${STYLE} Subject: ${card.subject}. Portrait orientation tarot card, single figure centered, ornamental frame.`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  console.log(`generating ${card.name}...`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildBody(prompt)),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error(`FAIL ${card.name}: ${res.status} ${t.slice(0, 300)}`);
    return;
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const img = parts.find((p) => p.inlineData?.data);
  if (!img) {
    console.error(`no image returned for ${card.name}`, JSON.stringify(data).slice(0, 400));
    return;
  }
  const buf = Buffer.from(img.inlineData.data, "base64");
  await fs.writeFile(target, buf);
  console.log(`wrote ${target} (${buf.length} bytes)`);
}

await fs.mkdir(OUT_DIR, { recursive: true });
for (const card of CARDS) {
  await generate(card);
  await new Promise((r) => setTimeout(r, 400));
}
console.log("all done");
