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

    // 1. Clean Destination (Wipe content but recreate folders)
    await fs.emptyDir(DEST_CONTENT);
    await fs.ensureDir(DEST_WRITINGS);
    await fs.ensureDir(DEST_IMAGES);

    // 2. Prepare Lists
    const publicFiles = new Set(); // To store "My Note Name" for link checking
    const filesToProcess = [];

    // 3. READ THE FILES
    // A. Read Root Files (index.md, about.md)
    const rootItems = await fs.readdir(SOURCE_ROOT);
    for (const item of rootItems) {
        if (item.endsWith('.md')) {
            // This captures index.md and about.md
            await stageFile(item, SOURCE_ROOT, DEST_CONTENT, publicFiles, filesToProcess);
        }
    }

    // B. Read Writings Folder (Recursively go into 'writings')
    const writingsPath = path.join(SOURCE_ROOT, 'writings');
    if (await fs.pathExists(writingsPath)) {
        const writingItems = await fs.readdir(writingsPath);
        for (const item of writingItems) {
            if (item.endsWith('.md')) {
                // This captures notes inside /writings and sets destination to /content/writings
                await stageFile(item, writingsPath, DEST_WRITINGS, publicFiles, filesToProcess);
            }
        }
    } else {
        console.warn(`⚠️  Warning: 'writings' folder not found at ${writingsPath}`);
    }

    // 4. PROCESS CONTENT (Fix Links & Images)
    for (const { fileName, sourceDir, destDir, content } of filesToProcess) {
        let finalBody = content.content;

        // A. IMAGE PROCESSING
        // Finds ![[image.png]]
        const imageRegex = /!\[\[(.*?)(?:\|.*?)?\]\]/g;
        let imgMatch;
        while ((imgMatch = imageRegex.exec(finalBody)) !== null) {
            const imageName = imgMatch[1];
            const srcImgPath = path.join(SOURCE_IMAGES, imageName);
            const destImgPath = path.join(DEST_IMAGES, imageName);

            if (await fs.pathExists(srcImgPath)) {
                await fs.copy(srcImgPath, destImgPath);
                // console.log(`🖼️  Copied: ${imageName}`); // Uncomment for verbose logs
            } else {
                console.warn(`⚠️  Missing Image: ${imageName} in ${fileName}`);
            }
        }

        // B. LINK SANITIZATION
        // Finds [[Link]]
        const linkRegex = /\[\[(.*?)(?:\|.*?)?\]\]/g;
        finalBody = finalBody.replace(linkRegex, (match, linkTarget) => {
            // Obsidian links are usually filename only, even across folders
            const cleanTarget = linkTarget.split('|')[0]; 
            
            if (publicFiles.has(cleanTarget)) {
                return match; // Link is valid, keep it
            } else {
                return linkTarget; // Link is private/missing, strip brackets
            }
        });

        // 5. WRITE FILE
        const finalContent = matter.stringify(finalBody, content.data);
        await fs.writeFile(path.join(destDir, fileName), finalContent);
    }

    console.log(`✅ Garden Sync Complete! Processed ${filesToProcess.length} files.`);
}

// Helper function to read file, check draft status, and stage for processing
async function stageFile(fileName, sourcePath, destPath, publicSet, processList) {
    const fullPath = path.join(sourcePath, fileName);
    const raw = await fs.readFile(fullPath, 'utf8');
    const parsed = matter(raw);

    if (parsed.data.draft === true) return; // Skip drafts

    publicSet.add(fileName.replace('.md', ''));
    processList.push({
        fileName,
        sourceDir: sourcePath, // Remember where it came from
        destDir: destPath,     // Remember where it needs to go
        content: parsed
    });
}

buildGarden();