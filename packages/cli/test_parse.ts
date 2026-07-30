import { parseFile } from './src/pipeline.js';

async function main() {
  try {
    const segs = await parseFile('data/src/ルナリウムTM.tmx');
    console.log(`Parsed ${segs.length} segments.`);
  } catch(e) {
    console.error("Error:", e);
  }
}
main();
