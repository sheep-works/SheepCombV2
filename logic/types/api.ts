export interface APIBodyUnitSchema {
    idx: number
    src: string
    tgt: string
    history?: { src: string; tgt: string }[]
}
