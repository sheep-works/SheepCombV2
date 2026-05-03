import flexsearch from 'flexsearch';
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

    constructor() {
        // Initialize FlexSearch Document index
        // Using character-level tokenization for robust matching in CJK text
        this.index = new (flexsearch as any).Document({
            document: {
                id: "id",
                index: ["src", "tgt"],
                store: ["src", "tgt", "file", "note"]
            },
            tokenize: "strict",
            // Custom encoder to generate N-grams (Bi-gram + Uni-gram)
            // This solves the CJK noise issue without requiring language-specific tokenizers
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
        });
    }

    /**
     * Index raw TranslationPair array.
     */
    public indexUnits(units: TranslationPair[]): void {
        this.entries = units.map((u, i) => ({
            id: i,
            src: u.src,
            tgt: u.tgt || '',
            note: u.note || ''
        }));

        for (const entry of this.entries) {
            this.index.add(entry);
        }
    }

    /**
     * Index structured ShWvData.
     */
    public indexShwvData(data: ShWvData): void {
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

        for (const entry of this.entries) {
            this.index.add(entry);
        }
    }

    /**
     * Perform a concordance search.
     * @param query The search string
     * @param limit Maximum results (default 100)
     */
    public search(query: string, limit: number = 100) {
        if (!query || query.trim() === '') return [];

        // Fetch more candidates to allow for strict post-filtering
        // Using "and" boolean logic ensures all n-grams from the query must be present
        const results = this.index.search(query, {
            limit: limit * 10,
            enrich: true,
            bool: "and"
        });

        // Flatten and unique the candidates
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

        // Exact substring post-filtering for true Concordance precision
        // This perfectly filters out "any single character" noise
        const q = query.toLowerCase();
        const finalResults = candidates.filter(entry => {
            return (entry.src && entry.src.toLowerCase().includes(q)) ||
                (entry.tgt && entry.tgt.toLowerCase().includes(q));
        });

        return finalResults.slice(0, limit);
    }

    public clear(): void {
        this.entries = [];
        // Resetting the index is simplest by re-initializing in the constructor-like logic
        // but for now we just clear the local entries reference.
    }

    /**
     * Export the internal FlexSearch index data.
     */
    public async exportIndexData(): Promise<Record<string, any>> {
        const dump: Record<string, any> = {};
        try {
            const promise = this.index.export((key: string | number, data: any) => {
                dump[key] = data;
            });
            if (promise && typeof promise.then === 'function') {
                await promise;
            }
        } catch (e) {
            console.error('Failed to export index:', e);
        }
        return dump;
    }

    /**
     * Get the list of entries that have been indexed.
     */
    public getEntries(): SearchEntry[] {
        return this.entries;
    }
}