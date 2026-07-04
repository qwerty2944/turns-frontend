/**
 * 타뷸라의 늑대 롤 카드 아트 생성기 — GLM CogView (타로 카드 스타일).
 * 실행: GLM_API_KEY=<키> node scripts/generate-mafia-art.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_KEY = process.env.GLM_API_KEY;
if (!API_KEY) {
  console.error("GLM_API_KEY env var required");
  process.exit(1);
}

const MODEL = "cogview-4-250304";
const SIZE = "864x1152";
const OUT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "games",
  "mafia",
);

const STYLE =
  "ornate tarot card illustration, art nouveau border, mystical medieval fantasy, rich gold and deep purple palette, dramatic candlelight, engraved linework, centered figure, no text, no letters, no watermark";

const PROMPTS = {
  back: "ornate tarot card back design, symmetrical pattern with a full moon and a wolf paw print at the center, stars and vines border, deep midnight purple and gold",
  wolf: "hooded werewolf standing in moonlit village square, glowing amber eyes under the hood, claws slightly visible, ominous full moon behind, tarot Death card mood",
  doctor: "medieval plague doctor healer pouring glowing elixir between two chalices, white and gold robes, calm serene pose, tarot Temperance card mood",
  seer: "mysterious fortune teller woman gazing into a glowing crystal ball, third-eye symbol on forehead, crescent moon crown, starry veil, tarot High Priestess mood",
  villager: "humble medieval farmer holding a single candle in the dark, hopeful worried face, wheat sheaf under arm, village at night behind, tarot Fool card mood",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const generateOne = async (id, subject) => {
  const outPath = path.join(OUT_DIR, `${id}.png`);
  if (fs.existsSync(outPath)) {
    console.log(`skip ${id}`);
    return true;
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch("https://open.bigmodel.cn/api/paas/v4/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ model: MODEL, prompt: `${STYLE}. ${subject}`, size: SIZE }),
      });
      const json = await res.json();
      const url = json?.data?.[0]?.url;
      if (!url) throw new Error(`no url: ${JSON.stringify(json).slice(0, 160)}`);
      let buf = null;
      for (let d = 1; d <= 5; d++) {
        const img = await fetch(url);
        if (img.ok) {
          buf = Buffer.from(await img.arrayBuffer());
          break;
        }
        await sleep(1200 * d);
      }
      if (!buf) throw new Error("download failed");
      fs.writeFileSync(outPath, buf);
      console.log(`✓ ${id} (${(buf.length / 1024).toFixed(0)}KB)`);
      return true;
    } catch (e) {
      console.warn(`retry ${id} #${attempt}: ${e.message}`);
      await sleep(1500 * attempt);
    }
  }
  console.error(`✗ FAILED ${id}`);
  return false;
};

const main = async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let failed = 0;
  for (const [id, subject] of Object.entries(PROMPTS)) {
    if (!(await generateOne(id, subject))) failed++;
  }
  console.log(failed ? `${failed} failed — rerun` : "all done");
  process.exit(failed ? 1 : 0);
};

main();
