import * as fs from 'node:fs'
import { SheepShuttle } from '../logic/shuttle/sheepShuttle.js'

async function run() {
    const filePath = "test_data/aov/AoV Japan(archived on 2025.05.06)_ja.xliff";
    const outPath = "test_data/aov/AoV Japan(archived on 2025.05.06)_ja_filtered.csv";
    
    console.log(`Loading file: ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    console.log(`Parsing file... (this may take a while)`);
    const shuttle = new SheepShuttle();
    await shuttle.parse([{ name: 'AoV_Japan_ja.xliff', content }], (msg) => {
        console.log(`[Progress] ${msg}`);
    });
    
    console.log(`Parsed ${shuttle.units.length} units.`);
    
    if (shuttle.units.length > 0) {
        console.log(`Applying filters (removing duplicates and alphanumeric DNTs)...`);
        shuttle.units = shuttle.processor.filter(shuttle.units, {
            toFilterDuplicate: true,
            toFilterDnt: 'digit eng'
        });
        console.log(`Filtered down to ${shuttle.units.length} units.`);

        console.log(`Exporting to CSV...`);
        const csvContent = shuttle.getCsv();
        fs.writeFileSync(outPath, csvContent, 'utf-8');
        console.log(`Successfully saved to ${outPath}`);
    } else {
        console.log(`No translation units found in the file.`);
    }
}

run().catch(err => {
    console.error("Fatal Error:", err)
    process.exit(1)
});
