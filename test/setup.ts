import { DOMParser } from '@xmldom/xmldom'

/**
 * Global Test Setup
 * Shims DOMParser for logic/simple/parsers.ts which expects a global DOMParser
 * when running in Node.js environment during tests.
 */
(globalThis as any).DOMParser = DOMParser
