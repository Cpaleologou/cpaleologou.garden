import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';

// --- CONFIGURATION ---
const VAULT_PATH = '/Users/christianpaleologou/Library/Mobile Documents/iCloud~md~obsidian/Documents';
const SOURCE_ROOT = path.join(VAULT_PATH, 'Thoughts/03-Permanent Notes'); 
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
        name: 'Notes', // Renamed from 'writing'
        source: path.join(SOURCE_ROOT, 'notes'),
        dest: './content/notes'
    },
    {
        name: 'Writing', // The future folder you mentioned
        source: path.join(SOURCE_ROOT, 'writing'),
        dest: './content/writing'
    }
];

// --- EXECUTION ---
async function buildGarden() {
    console.log("🌱 Starting Garden Build...");

    // 1. Clean Destination (Wipe content folder fresh)
    await fs.emptyDir('./content');
    
    // Ensure all destination subfolders exist
    await fs.ensureDir(DEST_IMAGES);
    for (const folder of FOLDERS_TO_SYNC) {
        if (folder.dest !== './content') { // content is already created by emptyDir
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
                // Only process .md files (ignore folders here to prevent recursion issues)
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

        // --- SMARTER IMAGE PROCESSING ---
        const imageRegex = /!\[\[(.*?)(?:\|.*?)?\]\]/g;
        let imgMatch;
        while ((imgMatch = imageRegex.exec(finalBody)) !== null) {
            const originalLink = imgMatch[1];
            
            // 1. Sanitize: Remove subfolders from the link and fix spaces (%20)
            // e.g. "99-Files/My Image.png" -> "My Image.png"
            const cleanImageName = path.basename(decodeURIComponent(originalLink));

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
                await fs.copy(srcImgPath, destImgPath);
            } else {
                console.warn(`⚠️  Missing Image in ${fileName}: ${cleanImageName} (Checked: ${SOURCE_IMAGES})`);
            }
        }

        // --- ENHANCED LINK SANITIZATION ---
        const linkRegex = /(!)?\[\[(.*?)(?:\|.*?)?\]\]/g;
        
        finalBody = finalBody.replace(linkRegex, (match, isImage, linkTarget) => {
            if (isImage) return match; 

            // Clean the target for checking existence
            let coreFilename = linkTarget.split('|')[0].split('#')[0]; 
            // Also handle cases where linkTarget includes a path like "notes/Some Note"
            coreFilename = path.basename(coreFilename);

            if (publicFiles.has(coreFilename)) {
                return match; // Valid public note, keep link
            } else {
                // Private/missing link: Pretty-print text
                let displayText = linkTarget.split('|')[0].split('#')[0]; 
                // Remove status icons if present
                displayText = displayText.replace(/^[🟢🟡]\s?/, '');
                // Ensure we display just the name, not the path
                return path.basename(displayText); 
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