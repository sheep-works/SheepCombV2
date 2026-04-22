declare interface TranslationPair {
    idx: number;
    src: string;
    tgt: string;
    note?: string;
    isSub?: boolean;
}

declare interface ShWvFileInfo {
    name: string;
    start: number;
    end: number;
}

declare interface ShWvMeta {
    bilingualPath: string;
    files: ShWvFileInfo[];
    sourceLang: string;
    targetLang: string;
}

declare interface ShWvBody {
    units: ShWvUnit[];
    terms: { src: string, tgt: string }[]
}

declare interface ShWvUnit {
    idx: number;
    src: string;
    pre: string;
    tgt: string;
    note?: string;
    isSub?: boolean;
    ref: ShWvRef;
    placeholders?: Record<number, string>;
}

declare interface ShWvRef {
    tms: ShWvRefTm[];
    tb: ShWvRefTb[];
    quoted: number[][];
}

declare interface ShWvRefTm {
    idx: number;
    src: string;
    diff?: string;
    tgt: string;
    ratio: number;
    freeze?: boolean;
}

declare interface ShWvRefTb {
    src: string;
    tgts: string[];
    note?: string;
}

declare interface ShWvData {
    meta: ShWvMeta;
    body: ShWvBody;
}
