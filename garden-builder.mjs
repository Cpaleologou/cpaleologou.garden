import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';

// --- CONFIGURATION ---
const VAULT_PATH = '/Users/christianpaleologou/Library/Mobile Documents/iCloud~md~obsidian/Documents';
const SOURCE_ROOT = path.join(VAULT_PATH, 'Thoughts/03-Permanent Notes'); 
const SOURCE_IMAGES = path.join(VAULT_PATH, 'Thoughts/99-Files'); 

const DEST_CONTENT = './content';
const DEST_WRITINGS = './content/writing';
const DEST_IMAGES = './content/assets'; 

// --- EXECUTION ---
async function buildGarden() {
    console.log("🌱 Starting Garden Build...");
    console.log(`📂 Looking for notes in: ${SOURCE_ROOT}`);

    // 1. Clean Destination
    await fs.emptyDir(DEST_CONTENT);
    await fs.ensureDir(DEST_WRITINGS);
    await fs.ensureDir(DEST_IMAGES);

    await fs.writeFile(path.join(DEST_CONTENT, 'CNAME'), 'christianp.space');

    const publicFiles = new Set();
    const filesToProcess = [];

    // --- CHECK ROOT FOLDER ---
    if (!await fs.pathExists(SOURCE_ROOT)) {
        console.error(`❌ CRITICAL ERROR: Source path does not exist!\n   -> ${SOURCE_ROOT}`);
        return;
    }

    const rootItems = await fs.readdir(SOURCE_ROOT);
    console.log(`Found ${rootItems.length} items in Root folder.`);

    for (const item of rootItems) {
        if (item.endsWith('.md')) {
            await stageFile(item, SOURCE_ROOT, DEST_CONTENT, publicFiles, filesToProcess);
        }
    }

    // --- CHECK WRITING FOLDER ---
    const writingPath = path.join(SOURCE_ROOT, 'writing'); 
    if (await fs.pathExists(writingPath)) {
        const writingItems = await fs.readdir(writingPath);
        console.log(`Found ${writingItems.length} items in Writing folder.`);
        
        for (const item of writingItems) {
            if (item.endsWith('.md')) {
                await stageFile(item, writingPath, DEST_WRITINGS, publicFiles, filesToProcess);
            }
        }
    } else {
        console.warn(`⚠️  Warning: 'writing' folder NOT found at: ${writingPath}`);
    }

    // --- PROCESS FILES ---
    console.log(`\n🔄 Processing ${filesToProcess.length} valid files...`);

    for (const { fileName, sourceDir, destDir, content } of filesToProcess) {
        let finalBody = content.content;

        // Image Processing
        const imageRegex = /!\[\[(.*?)(?:\|.*?)?\]\]/g;
        let imgMatch;
        while ((imgMatch = imageRegex.exec(finalBody)) !== null) {
            const imageName = imgMatch[1];
            const srcImgPath = path.join(SOURCE_IMAGES, imageName);
            const destImgPath = path.join(DEST_IMAGES, imageName);

            if (await fs.pathExists(srcImgPath)) {
                await fs.copy(srcImgPath, destImgPath);
            } else {
                console.warn(`⚠️  Missing Image: ${imageName} in ${fileName}`);
            }
        }

        // --- ENHANCED LINK SANITIZATION ---
        const linkRegex = /\[\[(.*?)(?:\|.*?)?\]\]/g;
        finalBody = finalBody.replace(linkRegex, (match, linkTarget) => {
            // 1. Clean the target for checking existence (remove alias | and anchor #)
            // Example: "🟢 The Book#^123|Alias" becomes "🟢 The Book"
            let coreFilename = linkTarget.split('|')[0].split('#')[0]; 
            
            // 2. Also strip emojis from the CHECK specifically? 
            // If your file on disk is actually named "🟢 The Book.md", keep this line commented out.
            // If the file is "The Book.md" but you link it as "🟢 The Book", uncomment next line:
            // coreFilename = coreFilename.replace(/^[🟢🟡] /, '');

            if (publicFiles.has(coreFilename)) {
                return match; // It's a valid public note, keep the link!
            } else {
                // It's a private/book link. We need to pretty-print the text.
                // Step A: Remove the Alias pipe (take the left side usually, or right if you prefer alias)
                let displayText = linkTarget.split('|')[0]; 

                // Step B: Remove the Anchor (everything after #)
                displayText = displayText.split('#')[0];

                // Step C: Remove the Emojis (Green or Yellow circle followed by optional space)
                displayText = displayText.replace(/^[🟢🟡]\s?/, '');

                return displayText; // Return just the clean title (e.g., "The Ethics of Authenticity")
            }
        });

        // --- DATE FIXER --- 
        if (content.data.Date) {                 
            content.data.date = content.data.Date; 
            delete content.data.Date;              
        }                                        

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
    
    // --- ROBUST DRAFT CHECK ---
    const isDraft = parsed.data.draft === true || parsed.data.draft === 'true';

    if (isDraft) {
        return; 
    }

    publicSet.add(fileName.replace('.md', ''));
    processList.push({
        fileName,
        sourceDir: sourcePath, 
        destDir: destPath,
        content: parsed
    });
}

buildGarden();