import fs from 'fs-extra';
import path from 'path';
import { pathToFileURL } from 'url';
import matter from 'gray-matter';

// --- CONFIGURATION ---
const VAULT_PATH = '/Users/christianpaleologou/Library/Mobile Documents/iCloud~md~obsidian/Documents';
const SOURCE_ROOT = path.join(VAULT_PATH, 'Thoughts/03-Garden'); 
const SOURCE_IMAGES = path.join(VAULT_PATH, 'Thoughts/99-Files'); 
const DEST_IMAGES = './content/assets'; 

// Define which folders to sync and where they go
const FOLDERS_TO_SYNC = [
    {
        name: 'Root',
        source: SOURCE_ROOT,
        dest: './content'
    },
    {
        name: 'Notes', 
        source: path.join(SOURCE_ROOT, 'notes'),
        dest: './content/notes'
    },
    {
        name: 'Writing', 
        source: path.join(SOURCE_ROOT, 'writing'),
        dest: './content/writing'
    },
    {
        name: 'Now', 
        source: path.join(SOURCE_ROOT, 'now'),
        dest: './content/now'
    },
    {
        name: 'Investing', 
        source: path.join(SOURCE_ROOT, 'investing'),
        dest: './content/investing'
    },
    {
        // Vault folder stays "library", but it publishes to /books so the
        // hand-built Library.md keeps /library for itself. Under Quartz 5 both
        // would otherwise slugify to the same URL and the folder listing would
        // shadow the curated page.
        name: 'Library',
        source: path.join(SOURCE_ROOT, 'library'),
        dest: './content/books'
    }
];

// Maps Readwise source note titles (exact filename without .md) to their
// published book note paths in the garden. Add an entry here whenever you
// create a new book note. Example:
// "The Ethics of Authenticity": "/notes/book-ethics-of-authenticity"
// NOTE: Quartz 5 lowercases and hyphenates all generated URLs, so these
// targets must be lowercase. (In v4 they preserved the source file's casing.)
// They live under /books, not /library — see FOLDERS_TO_SYNC above.
const BOOK_LINK_MAP = {
    "🟢 The Most Important Thing Uncommon Sense for the Thoughtful Investor": "/books/the-most-important-thing",
    "🟢 The Elements of Power": "/books/the-elements-of-power",
    "🟢 Breakneck": "/books/breakneck",
    "🟢 Capital Returns": "/books/capital-returns",
    "🟡 The Intelligent Investor": "/books/the-intelligent-investor"
};

// --- MARKDOWN SPACING NORMALIZER ---
// Obsidian is forgiving about missing blank lines; Quartz's renderer is not.
// This pass enforces consistent spacing so notes render the same way the
// vault does, regardless of how sloppily the blank lines were typed:
//   - blank line before AND after headings
//   - blank line before AND after standalone images
//   - blank line before tables, and after their last row
//   - blank line before blockquotes/callouts (not after — preserves lazy
//     continuation lines that belong to the quote)
//   - blank line around fenced code blocks (contents left untouched)
//   - runs of 2+ blank lines collapsed to one
// Lists are deliberately NOT touched: inserting blanks there flips tight
// lists to loose ones and changes rendering.
function normalizeSpacing(body) {
    const isBlank    = (l) => l.trim() === '';
    const isHeading  = (l) => /^#{1,6}\s/.test(l);
    const isImage    = (l) => /^\s*(!\[\[[^\]]+\]\]|!\[[^\]]*\]\([^)]+\))\s*$/.test(l);
    const isTableRow = (l) => /^\s*\|/.test(l);
    const isQuote    = (l) => /^\s*>/.test(l);
    const isFence    = (l) => /^\s*(```|~~~)/.test(l);

    const lines = body.split('\n');
    const out = [];
    let inFence = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const next = i + 1 < lines.length ? lines[i + 1] : null;

        // Code fences: pad around the block, never touch its contents
        if (isFence(line)) {
            if (!inFence && out.length && !isBlank(out[out.length - 1])) out.push('');
            out.push(line);
            if (inFence && next !== null && !isBlank(next)) out.push('');
            inFence = !inFence;
            continue;
        }
        if (inFence) {
            out.push(line);
            continue;
        }

        const prev = out.length ? out[out.length - 1] : null;

        const needsSpaceBefore =
            isHeading(line) ||
            isImage(line) ||
            (isTableRow(line) && prev !== null && !isTableRow(prev)) ||
            (isQuote(line) && prev !== null && !isQuote(prev));

        if (needsSpaceBefore && prev !== null && !isBlank(prev)) out.push('');

        out.push(line);

        const needsSpaceAfter =
            isHeading(line) ||
            isImage(line) ||
            (isTableRow(line) && next !== null && !isTableRow(next));

        if (needsSpaceAfter && next !== null && !isBlank(next)) out.push('');
    }

    // Collapse runs of blank lines to a single blank line
    const collapsed = [];
    let blanks = 0;
    for (const l of out) {
        if (isBlank(l)) {
            if (++blanks === 1) collapsed.push('');
        } else {
            blanks = 0;
            collapsed.push(l);
        }
    }

    // Trim leading/trailing blank lines
    while (collapsed.length && isBlank(collapsed[0])) collapsed.shift();
    while (collapsed.length && isBlank(collapsed[collapsed.length - 1])) collapsed.pop();

    return collapsed.join('\n');
}

// --- CURRENCY ESCAPER ---
// The Latex plugin treats a matched pair of `$` as inline math, so prose like
// "$10 of earnings while consuming $9" silently renders as math instead of
// two dollar amounts. Escaping currency to `\$` keeps Latex enabled for real
// equations while leaving money alone (as Quartz's Latex docs recommend).
//
// Rule: a `$` immediately followed by a digit is currency. Real inline math
// almost never opens on a digit — write `$$...$$` or `$ 5x$` for those cases.
// Skips fenced code blocks, inline code spans, and `$$` math blocks, and
// never double-escapes a `$` that is already escaped.
function escapeCurrency(body) {
    const lines = body.split('\n');
    const out = [];
    let inFence = false;
    let inMathBlock = false;

    for (const line of lines) {
        if (/^\s*(```|~~~)/.test(line)) {
            inFence = !inFence;
            out.push(line);
            continue;
        }
        if (!inFence && /^\s*\$\$\s*$/.test(line)) {
            inMathBlock = !inMathBlock;
            out.push(line);
            continue;
        }
        if (inFence || inMathBlock) {
            out.push(line);
            continue;
        }

        // Split on inline code spans so `$100` inside backticks stays literal.
        const escaped = line
            .split(/(`[^`]*`)/)
            .map((segment) =>
                segment.startsWith('`')
                    ? segment
                    : segment.replace(/(?<!\\)\$(?=\d)/g, '\\$'),
            )
            .join('');
        out.push(escaped);
    }

    return out.join('\n');
}

// --- INTERNAL LINK CASING ---
// Quartz 5 lowercases and hyphenates every generated URL, so absolute internal
// links typed in Obsidian with natural casing ("/library/The-Intelligent-Investor",
// "/Library") would 404. Normalize the path portion to match v5's slugs.
//
// Only touches links beginning with a single "/" — external URLs, protocol-
// relative "//" links, anchors and relative image paths are left untouched.
// Query strings and fragments keep their original casing.
function lowercaseInternalLinks(body) {
    const normalizePath = (p) => {
        const split = p.search(/[?#]/);
        const pathPart = split === -1 ? p : p.slice(0, split);
        const rest = split === -1 ? '' : p.slice(split);
        let normalized = pathPart.toLowerCase().replace(/\s+/g, '-');
        // The vault's "library" folder publishes to /books (see FOLDERS_TO_SYNC),
        // so book links hand-written as /library/<book> in Obsidian — e.g. the
        // cover grid in Library.md — must be remapped. The bare /library page
        // itself is the curated grid and stays put.
        normalized = normalized.replace(/^\/library\/(?=.)/, '/books/');
        return normalized + rest;
    };

    return body
        // Markdown links: [text](/Some/Path)
        .replace(/\]\((\/(?!\/)[^)\s]*)\)/g, (_m, p) => `](${normalizePath(p)})`)
        // Raw HTML hrefs: href="/Some/Path"
        .replace(/href="(\/(?!\/)[^"]*)"/g, (_m, p) => `href="${normalizePath(p)}"`);
}

// --- EXECUTION ---
async function buildGarden() {
    console.log("🌱 Starting Garden Build...");

    // 1. Clean Destination (Wipe content folder fresh)
    await fs.emptyDir('./content');
    
    // Ensure all destination subfolders exist
    await fs.ensureDir(DEST_IMAGES);
    for (const folder of FOLDERS_TO_SYNC) {
        if (folder.dest !== './content') { 
            await fs.ensureDir(folder.dest);
        }
    }

    const publicFiles = new Set();
    const filesToProcess = [];

    // --- STAGE FILES FROM ALL FOLDERS ---
    for (const folder of FOLDERS_TO_SYNC) {
        if (await fs.pathExists(folder.source)) {
            console.log(`📂 Checking ${folder.name} folder: ${folder.source}`);
            const items = await fs.readdir(folder.source);
            
            let count = 0;
            for (const item of items) {
                // Ignore dotfiles (like .DS_Store) and only grab markdown
                if (item.endsWith('.md')) {
                    await stageFile(item, folder.source, folder.dest, publicFiles, filesToProcess);
                    count++;
                }
            }
            console.log(`   -> Found ${count} markdown files.`);
        } else {
            console.warn(`⚠️  Skipping ${folder.name}: Path not found (${folder.source})`);
        }
    }

    // --- PROCESS FILES ---
    console.log(`\n🔄 Processing ${filesToProcess.length} valid files...`);

    for (const { fileName, sourceDir, destDir, content } of filesToProcess) {
        let finalBody = content.content;

        // --- FIXED IMAGE PROCESSING (Handles Wikilinks AND Standard Links) ---
        
        // Helper function to find and copy an image
        const processImage = async (rawLink) => {
            // 1. Sanitize: Remove query params or tooltips if present in standard links
            let cleanLink = rawLink.split(' ')[0]; 
            const cleanImageName = path.basename(decodeURIComponent(cleanLink));

            const destImgPath = path.join(DEST_IMAGES, cleanImageName);
            
            // 2. Look in the main SOURCE_IMAGES folder
            let srcImgPath = path.join(SOURCE_IMAGES, cleanImageName);
            let imageFound = false;

            if (await fs.pathExists(srcImgPath)) {
                imageFound = true;
            } else {
                // 3. Fallback: Look in the same folder as the note (Relative path)
                const localPath = path.join(sourceDir, cleanImageName);
                if (await fs.pathExists(localPath)) {
                    srcImgPath = localPath;
                    imageFound = true;
                }
            }

            if (imageFound) {
                // Check if file already exists at dest to avoid redundant copies
                if (!(await fs.pathExists(destImgPath))) {
                    await fs.copy(srcImgPath, destImgPath);
                }
            } else {
                console.warn(`⚠️  Missing Image in ${fileName}: ${cleanImageName}`);
            }
        };

        // Pass 1: Obsidian Wikilinks -> ![[Image.png]]
        const wikiRegex = /!\[\[(.*?)(?:\|.*?)?\]\]/g;
        let wikiMatch;
        while ((wikiMatch = wikiRegex.exec(finalBody)) !== null) {
            await processImage(wikiMatch[1]);
        }

        // Pass 2: Standard Markdown Links -> ![Alt](Image.png)
        const mdRegex = /!\[.*?\]\((.*?)\)/g;
        let mdMatch;
        while ((mdMatch = mdRegex.exec(finalBody)) !== null) {
            await processImage(mdMatch[1]);
        }

        // --- ENHANCED LINK SANITIZATION ---
        const linkRegex = /(!)?\[\[(.*?)(?:\|.*?)?\]\]/g;
        
        finalBody = finalBody.replace(linkRegex, (match, isImage, linkTarget) => {
            if (isImage) return match; 

            // Clean the target for checking existence
            let coreFilename = linkTarget.split('|')[0].split('#')[0]; 
            coreFilename = path.basename(coreFilename);

            if (publicFiles.has(coreFilename)) {
                return match;
            } else if (BOOK_LINK_MAP[coreFilename]) {
                const alias = linkTarget.split('|')[1];
                const displayText = alias ? alias : coreFilename;
                return `[${displayText}](${encodeURI(BOOK_LINK_MAP[coreFilename])})`;
            } else {
                // Private/missing link: Pretty-print text
                let displayText = linkTarget.split('|')[0].split('#')[0]; 
                displayText = displayText.replace(/^[🟢🟡]\s?/, '');
                return path.basename(displayText); 
            }
        });

        // --- DATE FIXER --- 
        if (content.data.Date) {                 
            content.data.date = content.data.Date; 
            delete content.data.Date;              
        }                                        

        // --- SPACING NORMALIZER ---
        finalBody = normalizeSpacing(finalBody);

        // --- CURRENCY ESCAPER ---
        finalBody = escapeCurrency(finalBody);

        // --- INTERNAL LINK CASING (Quartz 5) ---
        finalBody = lowercaseInternalLinks(finalBody);

        // Write File
        const finalContent = matter.stringify(finalBody, content.data);
        await fs.writeFile(path.join(destDir, fileName), finalContent);
    }

    console.log(`✅ Garden Sync Complete!`);
}

async function stageFile(fileName, sourcePath, destPath, publicSet, processList) {
    const fullPath = path.join(sourcePath, fileName);
    const raw = await fs.readFile(fullPath, 'utf8');
    const parsed = matter(raw);
    
    // --- PUBLISH CHECK ---
    const isPublished = parsed.data.publish === true || parsed.data.publish === 'true';

    if (!isPublished) {
        return; 
    }

    // Add clean filename to public set (remove extension)
    publicSet.add(fileName.replace('.md', ''));
    
    processList.push({
        fileName,
        sourceDir: sourcePath, 
        destDir: destPath,
        content: parsed
    });
}

// Only sync when run directly (`node garden-builder.mjs`), so the transform
// helpers above can be imported by maintenance scripts without triggering
// a full vault sync as a side effect.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    buildGarden();
}

export { normalizeSpacing, escapeCurrency, lowercaseInternalLinks };