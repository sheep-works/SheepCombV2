import * as flexsearch from 'flexsearch';
import type { TranslationPair, ShWvData } from '../../types/shwv.js';

export interface SearchEntry {
    id: number;
    src: string;
    tgt: string;
    file?: string;
    note?: string;
}

/**
 * Component for character-level concordance search using FlexSearch.
 * Optimized for CJK (Chinese, Japanese, Korean) text.
 */
export class ShuttleSearch {
    private index: any;
    private entries: SearchEntry[] = [];
    private config: any;

    constructor() {
        // Store config for consistent re-initialization
        this.config = {
            document: {
                id: "id",
                index: ["src", "tgt"],
                store: ["src", "tgt", "file", "note"]
            },
            tokenize: "strict",
            // Custom encoder to generate N-grams (Bi-gram + Uni-gram)
            encode: (str: string) => {
                if (!str) return [];
                const s = str.toLowerCase();
                const tokens: string[] = [];
                for (let i = 0; i < s.length; i++) {
                    tokens.push(s[i]!); // Uni-gram
                    if (i < s.length - 1) {
                        tokens.push(s.substring(i, i + 2)); // Bi-gram
                    }
                }
                return tokens;
            }
        };
        const fs: any = flexsearch;
        const FlexSearchDoc = fs && (fs.Document || fs.default?.Document);
        if (!FlexSearchDoc) {
            throw new Error("Failed to load FlexSearch Document constructor.");
        }
        this.index = new FlexSearchDoc(this.config);
    }

    /**
     * Index raw TranslationPair array.
     */
    public indexUnits(units: TranslationPair[], onProgress?: (msg: string) => void): void {
        this.entries = units.map((u, i) => ({
            id: i,
            src: u.src,
            tgt: u.tgt || '',
            note: u.note || ''
        }));

        for (let i = 0; i < this.entries.length; i++) {
            if (onProgress && i % 1000 === 0) onProgress(`Indexing raw units... ${i} / ${this.entries.length}`);
            this.index.add(this.entries[i]);
        }
    }

    /**
     * Index structured ShWvData.
     */
    public indexShwvData(data: ShWvData, onProgress?: (msg: string) => void): void {
        this.entries = data.body.units.map(u => {
            const fileInfo = data.meta.files.find(f => u.idx >= f.start && u.idx <= f.end);
            return {
                id: u.idx,
                src: u.src,
                tgt: u.tgt || u.pre || '',
                file: fileInfo?.name || '',
                note: u.note || ''
            };
        });

        for (let i = 0; i < this.entries.length; i++) {
            if (onProgress && i % 1000 === 0) onProgress(`Indexing search data... ${i} / ${this.entries.length}`);
            this.index.add(this.entries[i]);
        }
    }

    /**
     * Perform a concordance search.
     * @param query The search string
     * @param limit Maximum results (default 100)
     */
    public search(query: string, limit: number = 100) {
        if (!query || query.trim() === '') return [];

        const results = this.index.search(query, {
            limit: limit * 10,
            enrich: true,
            bool: "and"
        });

        const seenIds = new Set<number>();
        const candidates: SearchEntry[] = [];

        for (const fieldRes of results) {
            for (const item of fieldRes.result) {
                if (!seenIds.has(item.id)) {
                    seenIds.add(item.id);
                    candidates.push(item.doc as SearchEntry);
                }
            }
        }

        const q = query.toLowerCase();
        const finalResults = candidates.filter(entry => {
            return (entry.src && entry.src.toLowerCase().includes(q)) ||
                (entry.tgt && entry.tgt.toLowerCase().includes(q));
        });

        return finalResults.slice(0, limit);
    }

    /**
     * Clear all indexed data and reset the index instance.
     */
    public clear(): void {
        this.entries = [];
        const fs: any = flexsearch;
        const FlexSearchDoc = fs && (fs.Document || fs.default?.Document);
        this.index = new FlexSearchDoc(this.config);
    }

    /**
     * Export the full search state (index + entries).
     */
    public async exportFullData(): Promise<{ index: Record<string, any>, entries: SearchEntry[] }> {
        const indexDump: Record<string, any> = {};
        try {
            const promise = this.index.export((key: string | number, data: any) => {
                indexDump[key] = data;
            });
            if (promise && typeof promise.then === 'function') {
                await promise;
            }
        } catch (e) {
            console.error('Failed to export index:', e);
        }
        return {
            index: indexDump,
            entries: this.entries
        };
    }

    /**
     * Import the full search state.
     */
    public async importFullData(data: { index: Record<string, any>, entries: SearchEntry[] }): Promise<void> {
        if (!data || !data.index) return;
        
        this.clear();
        this.entries = data.entries || [];
        
        try {
            const keys = Object.keys(data.index);
            for (const key of keys) {
                await this.index.import(key, data.index[key]);
            }
        } catch (e) {
            console.error('Failed to import index:', e);
        }
    }

    /**
     * Get the list of entries that have been indexed.
     */
    public getEntries(): SearchEntry[] {
        return this.entries;
    }
}