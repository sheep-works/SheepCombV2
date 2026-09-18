import { DOMParser } from '@xmldom/xmldom'

// Shim DOMParser globally for tests
;(globalThis as any).DOMParser = DOMParser
