import * as fs from 'node:fs';
import * as path from 'node:path';

export class SheepShuttle {
    /**
     * Generate a JSON file containing only src and tgt from ShWvData.
     * @param data ShWvData instance
     * @param outputPath Path to save the JSON file
     */
    public static exportToJson(data: ShWvData, outputPath: string): void {
        const pairs = data.body.units.map(unit => ({
            src: unit.src,
            tgt: unit.tgt || unit.pre || ""
        }));

        fs.writeFileSync(outputPath, JSON.stringify(pairs, null, 2), 'utf-8');
    }

    /**
     * Generate a CSV file containing src and tgt from ShWvData.
     * @param data ShWvData instance
     * @param outputPath Path to save the CSV file
     */
    public static exportToCsv(data: ShWvData, outputPath: string): void {
        const header = "src,tgt\n";
        const rows = data.body.units.map(unit => {
            const src = `"${unit.src.replace(/"/g, '""')}"`;
            const tgtText = unit.tgt || unit.pre || "";
            const tgt = `"${tgtText.replace(/"/g, '""')}"`;
            return `${src},${tgt}`;
        });

        fs.writeFileSync(outputPath, header + rows.join('\n'), 'utf-8');
    }

    /**
     * Export units as TM (src/tgt pairs) and terms as TB.
     * @param data ShWvData instance
     * @param tmPath Path to save the TM JSON file
     * @param tbPath Path to save the TB JSON file
     */
    public static exportAsTmTb(data: ShWvData, tmPath: string, tbPath: string): void {
        this.exportAsTm(data, tmPath);
        this.exportAsTb(data, tbPath);
    }

    public static exportAsTm(data: ShWvData, tmPath: string): void {
        const tm = data.body.units.map(unit => ({
            src: unit.src,
            tgt: unit.tgt || unit.pre || ""
        }));
        fs.writeFileSync(tmPath, JSON.stringify(tm, null, 2), 'utf-8');
    }

    public static exportAsTb(data: ShWvData, tbPath: string): void {
        const tb = data.body.terms || [];
        fs.writeFileSync(tbPath, JSON.stringify(tb, null, 2), 'utf-8');
    }

    // ==========================================
    // 2. 蛻・牡繝ｻ蜷井ｽ・(Split / Merge)
    // ==========================================

    /**
     * ShWvData 繧偵ヵ繧｡繧､繝ｫ蜊倅ｽ阪〒蛻・牡縺励※ JSON 繝輔ぃ繧､繝ｫ鄒､繧貞・蜉帙＠縺ｾ縺吶・     * @param data ShWvData instance
     * @param outDir 蜃ｺ蜉帛・繝・ぅ繝ｬ繧ｯ繝医Μ
     */
    public static splitByFile(data: ShWvData, outDir: string): void {
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }

        for (const file of data.meta.files) {
            const fileUnits = data.body.units.slice(file.start, file.end + 1);
            const pairs = fileUnits.map(unit => ({
                src: unit.src,
                tgt: unit.tgt || unit.pre || ""
            }));

            // Generate a safe file name based on original name
            const parsedName = path.parse(file.name);
            const outPath = path.join(outDir, `${parsedName.name}.json`);
            fs.writeFileSync(outPath, JSON.stringify(pairs, null, 2), 'utf-8');
        }
    }

    /**
     * ShWvData 繧呈枚蟄玲焚蜊倅ｽ阪〒蛻・牡縺励※隍・焚繝√Ε繝ｳ繧ｯ縺ｮ JSON 繝輔ぃ繧､繝ｫ鄒､繧貞・蜉帙＠縺ｾ縺吶・     * @param data ShWvData instance
     * @param maxLength 繝√Ε繝ｳ繧ｯ縺ｮ譛螟ｧ譁・ｭ玲焚・・SON譁・ｭ怜・蛹悶＠縺滄圀縺ｮ髟ｷ縺輔〒讎らｮ暦ｼ・     * @param outDir 蜃ｺ蜉帛・繝・ぅ繝ｬ繧ｯ繝医Μ
     */
    public static splitByLength(data: ShWvData, maxLength: number, outDir: string): void {
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }

        let chunkIdx = 0;
        let currentLen = 0;
        let currentChunk: any[] = [];

        for (const unit of data.body.units) {
            const tgtText = unit.tgt || unit.pre || "";
            const pair = { src: unit.src, tgt: tgtText };
            const pairStr = JSON.stringify(pair);
            const len = pairStr.length;

            if (currentLen + len > maxLength && currentChunk.length > 0) {
                const outPath = path.join(outDir, `chunk_${chunkIdx.toString().padStart(3, '0')}.json`);
                fs.writeFileSync(outPath, JSON.stringify(currentChunk, null, 2), 'utf-8');

                chunkIdx++;
                currentChunk = [];
                currentLen = 0;
            }

            currentChunk.push(pair);
            currentLen += len;
        }

        if (currentChunk.length > 0) {
            const outPath = path.join(outDir, `chunk_${chunkIdx.toString().padStart(3, '0')}.json`);
            fs.writeFileSync(outPath, JSON.stringify(currentChunk, null, 2), 'utf-8');
        }
    }

    /**
     * 蛻・牡縺輔ｌ縺・JSON 繝輔ぃ繧､繝ｫ繧偵☆縺ｹ縺ｦ隱ｭ縺ｿ霎ｼ縺ｿ縲・縺､縺ｮ驟榊・縺ｨ縺励※邨仙粋繝ｻ蜃ｺ蜉帙＠縺ｾ縺吶・     * @param inputDir 蜈･蜉帙ョ繧｣繝ｬ繧ｯ繝医Μ
     * @param outputFile 蜃ｺ蜉帛・繝輔ぃ繧､繝ｫ繝代せ
     */
    public static mergeFiles(inputDir: string, outputFile: string): void {
        const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.json')).sort();
        const merged: any[] = [];

        for (const f of files) {
            const content = fs.readFileSync(path.join(inputDir, f), 'utf-8');
            try {
                const parsed = JSON.parse(content);
                if (Array.isArray(parsed)) {
                    merged.push(...parsed);
                }
            } catch (e) {
                console.error(`Failed to parse ${f}`);
            }
        }

        fs.writeFileSync(outputFile, JSON.stringify(merged, null, 2), 'utf-8');
    }

    // ==========================================
    // 3. SheepLint 縺ｨ縺ｮ騾｣謳ｺ (SheepLint Integration)
    // ==========================================

    /**
     * {src, tgt, history: [{src, tgt}, ...]} 蠖｢蠑上・ JSONL 繝輔ぃ繧､繝ｫ繧貞・蜉帙＠縺ｾ縺吶・     * history 縺ｫ縺ｯ TM 縺ｪ縺ｩ縺ｮ蜿ら・諠・ｱ繧貞沂繧∬ｾｼ縺ｿ縺ｾ縺吶・     * @param data ShWvData instance
     * @param outputPath 蜃ｺ蜉帛・繝輔ぃ繧､繝ｫ繝代せ
     */
    public static exportToJsonl(data: ShWvData, outputPath: string): void {
        const stream = fs.createWriteStream(outputPath, { encoding: 'utf-8' });
        for (const unit of data.body.units) {
            const tgtText = unit.tgt || unit.pre || "";
            const historyObj = (unit.ref && unit.ref.tms) ? unit.ref.tms.map(tm => ({ src: tm.src, tgt: tm.tgt })) : [];

            const obj = {
                src: unit.src,
                tgt: tgtText,
                history: historyObj
            };
            stream.write(JSON.stringify(obj) + '\n');
        }
        stream.end();
    }

    /**
     * SheepLint 繝ｪ繧ｯ繧ｨ繧ｹ繝育畑縺ｫ縲＋index, src, tgt, history: ...} 縺ｮ驟榊・繧偵メ繝｣繝ｳ繧ｯ縺斐→縺ｮ JSON 驟榊・縺ｫ縺ｾ縺ｨ繧√・     * 1陦後↓1縺､縺ｮ驟榊・・医メ繝｣繝ｳ繧ｯ・峨ｒ蜃ｺ蜉帙☆繧句､牙援 JSONL 蠖｢蠑上・譁・ｭ怜・繧定ｿ斐＠縺ｾ縺吶・     * @param data ShWvData instance
     * @param maxCharsPerLine 1陦後≠縺溘ｊ縺ｮ譛螟ｧ譁・ｭ玲焚・域ｦらｮ暦ｼ・     * @returns 繝√Ε繝ｳ繧ｯ蛻・牡縺輔ｌ縺溷､牙援 JSONL 譁・ｭ怜・
     */
    public static chunkJsonl(data: ShWvData, maxCharsPerLine: number): string {
        const lines: string[] = [];
        let currentChunk: any[] = [];
        let currentLen = 0;

        for (const unit of data.body.units) {
            const tgtText = unit.tgt || unit.pre || "";
            const historyObj = (unit.ref && unit.ref.tms) ? unit.ref.tms.map(tm => ({ src: tm.src, tgt: tm.tgt })) : [];

            const obj = {
                index: unit.idx,
                src: unit.src,
                tgt: tgtText,
                history: historyObj
            };
            const strObj = JSON.stringify(obj);
            const len = strObj.length;

            if (currentLen + len > maxCharsPerLine && currentChunk.length > 0) {
                lines.push(JSON.stringify(currentChunk));
                currentChunk = [];
                currentLen = 0;
            }

            currentChunk.push(obj);
            currentLen += len;
        }

        if (currentChunk.length > 0) {
            lines.push(JSON.stringify(currentChunk));
        }

        return lines.join('\n');
    }

    /**
     * 螟牙援 JSONL 繝輔ぃ繧､繝ｫ縺九ｉ繝・・繧ｿ繧定ｪｭ縺ｿ霎ｼ縺ｿ縲ヾhWvData 繧呈峩譁ｰ縺励∪縺吶・     * - tgt 縺檎ｩｺ縺ｮ蝣ｴ蜷・ 蜑咲ｿｻ險ｳ (MT) 縺ｨ縺ｿ縺ｪ縺励｝re 縺ｫ莉｣蜈･縺励∪縺吶・     * - tgt 縺後≠繧句ｴ蜷・ 譬｡豁｣/菫ｮ豁｣邨先棡縺ｨ縺ｿ縺ｪ縺励》gt 繧呈峩譁ｰ縺励∪縺吶・     * @param data ShWvData instance
     * @param jsonlPath 蜈･蜉帙☆繧・JSONL 繝輔ぃ繧､繝ｫ繝代せ
     */
    public static updateFromJsonl(data: ShWvData, jsonlPath: string): void {
        if (!fs.existsSync(jsonlPath)) return;

        const content = fs.readFileSync(jsonlPath, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
            if (line.trim().length === 0) continue;

            try {
                const chunk = JSON.parse(line);
                if (Array.isArray(chunk)) {
                    for (const item of chunk) {
                        const unit = data.body.units.find(u => u.idx === item.index);
                        if (unit) {
                            if (item.tgt && item.tgt.trim() !== "") {
                                // tgt 縺悟ｭ伜惠縺吶ｋ蝣ｴ蜷茨ｼ壽｡豁｣邨先棡縺ｨ縺励※ tgt 繧呈峩譁ｰ
                                unit.tgt = item.tgt;
                            } else {
                                // tgt 縺檎ｩｺ縺ｮ蝣ｴ蜷茨ｼ壼燕鄙ｻ險ｳ邨先棡縺ｨ縺励※ pre 繧呈峩譁ｰ
                                unit.pre = item.src;
                            }
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to parse JSONL line", e);
            }
        }
    }
}
