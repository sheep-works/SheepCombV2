import { SheepShuttle } from "./SheepShuttle.js";
import * as fs from "node:fs";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rl = readline.createInterface({ input, output });

const FILE_NAME = "./demo/LostCastle2.json"

async function main() {
    const demoFilePath = FILE_NAME;
    if (!fs.existsSync(demoFilePath)) {
        console.error(`Error: Sample file "${demoFilePath}" not found.`);
        process.exit(1);
    }

    const data: ShWvData = JSON.parse(fs.readFileSync(demoFilePath, "utf-8"));

    console.log("\n--- SheepShuttle CLI ---");
    console.log("Choose a function to execute:");
    console.log("1. exportToJson");
    console.log("2. exportToCsv");
    console.log("3. splitByFile");
    console.log("4. splitByLength");
    console.log("5. mergeFiles");
    console.log("6. exportToJsonl");
    console.log("7. chunkJsonl");
    console.log("8. updateFromJsonl");
    console.log("9. exportAsTmTb");
    console.log("0. Exit");

    const answer = await rl.question("\nEnter number (0-9): ");

    switch (answer) {
        case "1": {
            const outputPath = await rl.question("Enter output path (default ./demo/export.json): ");
            SheepShuttle.exportToJson(data, outputPath || "./demo/export.json");
            console.log("Exported to ./demo/export.json");
            break;
        }
        case "2": {
            const outputPath = await rl.question("Enter output path (default ./demo/export.csv): ");
            SheepShuttle.exportToCsv(data, outputPath || "./demo/export.csv");
            console.log("Exported to ./demo/export.csv");
            break;
        }
        case "3": {
            const outDir = await rl.question("Enter output directory (default ./demo/split_files): ");
            SheepShuttle.splitByFile(data, outDir || "./demo/split_files");
            console.log("Files split into ./demo/split_files");
            break;
        }
        case "4": {
            const length = await rl.question("Enter max length per chunk (default 1000): ");
            const maxLength = length ? parseInt(length, 10) : 1000;
            SheepShuttle.splitByLength(data, maxLength, "./demo/split_chunks");
            console.log(`Chunks split into ./demo/split_chunks with max length ${maxLength}`);
            break;
        }
        case "5": {
            const inputDir = await rl.question("Enter input directory (default ./demo/split_chunks): ");
            const outputFile = await rl.question("Enter output file (default ./demo/merged.json): ");
            SheepShuttle.mergeFiles(inputDir || "./demo/split_chunks", outputFile || "./demo/merged.json");
            console.log("Merged files from ./demo/split_chunks to ./demo/merged.json");
            break;
        }
        case "6": {
            const outputPath = await rl.question("Enter output path (default ./demo/export.jsonl): ");
            SheepShuttle.exportToJsonl(data, outputPath || "./demo/export.jsonl");
            console.log("Exported to ./demo/export.jsonl");
            break;
        }
        case "7": {
            const lineLength = await rl.question("Enter max chars per line (default 2000): ");
            const maxChars = lineLength ? parseInt(lineLength, 10) : 2000;
            const result = SheepShuttle.chunkJsonl(data, maxChars);
            fs.writeFileSync("./demo/chunked.jsonl", result, "utf-8");
            console.log(`Chunked JSONL saved to ./demo/chunked.jsonl`);
            break;
        }
        case "8": {
            const jsonlPath = await rl.question("Enter JSONL path (default ./demo/export.jsonl): ");
            SheepShuttle.updateFromJsonl(data, jsonlPath || "./demo/export.jsonl");
            console.log("Updated data from ./demo/export.jsonl");
            break;
        }
        case "9": {
            const tmPath = await rl.question("Enter TM output path (default ./demo/export_tm.json): ");
            const tbPath = await rl.question("Enter TB output path (default ./demo/export_tb.json): ");
            SheepShuttle.exportAsTmTb(data, tmPath || "./demo/export_tm.json", tbPath || "./demo/export_tb.json");
            console.log(`Exported TM to ${tmPath || "./demo/export_tm.json"} and TB to ${tbPath || "./demo/export_tb.json"}`);
            break;
        }
        case "0": {
            console.log("Exiting...");
            break;
        }
        default: {
            console.log("Invalid choice.");
            break;
        }
    }

    rl.close();
}

main().catch(err => {
    console.error(err);
    rl.close();
});
