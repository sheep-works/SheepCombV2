# Simple Parser Test Plan

## Functions to Test

| Function | Arguments | Return Type | Description |
| :--- | :--- | :--- | :--- |
| `stripTags` | `text: string` | `string` | Strips HTML/XML-like tags from string. |
| `parseXliff` | `content: string` | `Segment[]` | Parses XLIFF content into segments. |
| `parseTmx` | `content: string`, `sourceLang?: string`, `targetLang?: string` | `Segment[]` | Parses TMX content into segments based on languages. |
| `parseXlsx` | `content: ArrayBuffer \| Buffer` | `Promise<Segment[]>` | Parses Excel (XLSX) first sheet into segments. |
| `parseDocx` | `content: ArrayBuffer \| Buffer` | `Promise<Segment[]>` | Parses Word (DOCX) tables based on detected tool formats. |
| `SimpleParser.parse` | `content: string \| ArrayBuffer \| Buffer`, `fileName: string` | `Promise<Segment[]>` | Universal entry point that routes to specific parsers. |

## Required Test File Formats / Variations

### XLIFF (`.xlf`, `.xliff`, `.sdlxliff`, `.mqxliff`)
- [ ] Basic XLIFF 1.2
- [ ] XLIFF with inline tags (verify `src`/`tgt` preservation vs `stripTags`)
- [ ] XLIFF without targets (only sources)
- [ ] Empty/Malformatted XLIFF

### TMX (`.tmx`)
- [ ] TMX with `ja` and `en` (default)
- [ ] TMX with different language codes (verify `sourceLang`/`targetLang` parameters)
- [ ] TMX with multiple `tuv` entries

### XLSX (`.xlsx`)
- [ ] Standard 3-column format (Source, Target, Note)
- [ ] XLSX with empty rows
- [ ] XLSX with only 1 or 2 columns

### DOCX (`.docx`)
- [ ] **memoQ Table RTF/DOCX**: 2nd column source, 3rd target, 4th note (starts from row 3).
- [ ] **Xbench Export**: 1st column source, 2nd target (preceded by a table with "Exported with ApSIC").
- [ ] **Phrase (Memsource) Table**: 4th column source, 5th target, 7th note (starts after 3 header tables).
- [ ] **Generic Table**: 1st column source, 2nd target.

## How to narrow down test targets

To focus on Simple Parser tests and exclude SheepShuttle:

1. **Run specific file**:
   ```bash
   yarn vitest test/logic_parser.test.ts
   ```

2. **Filter by test name pattern**:
   ```bash
   yarn vitest -t "Simple Parsers"
   ```

3. **Exclude SheepShuttle files**:
   If SheepShuttle tests are in specific files (e.g., `test/shuttle.test.ts`), you can just avoid running them.
   If you want to run everything *except* them:
   ```bash
   yarn vitest --exclude "**/shuttle/**"
   ```
