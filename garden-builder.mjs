import fs from 'fs-extra';
import path from 'path';
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
        name: 'Library', 
        source: path.join(SOURCE_ROOT, 'library'),
        dest: './content/library'
    }
];

// Maps Readwise source note titles (exact filename without .md) to their
// published book note paths in the garden. Add an entry here whenever you
// create a new book note. Example:
// "The Ethics of Authenticity": "/notes/book-ethics-of-authenticity"
const BOOK_LINK_MAP = {
    "🟢 The Most Important Thing Uncommon Sense for the Thoughtful Investor": "/library/The-Most-Important-Thing",
    "🟢 The Elements of Power": "/library/The-Elements-of-Power",
    "🟢 Breakneck": "/library/Breakneck",
    "🟢 Capital Returns": "/library/Capital-Returns",
    "🟡 The Intelligent Investor": "/library/The-Intelligent-Investor"
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

buildGarden();