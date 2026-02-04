const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const distDir = path.join(__dirname, 'dist');

// Ensure dist directory exists
if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir);

// Helper to copy directory
function copyDir(src, dest) {
    if (!fs.existsSync(src)) {
        console.warn(`Source directory not found: ${src}`);
        return;
    }
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Helper to build React app if needed
function buildReactApp(projectPath) {
    const buildPath = path.join(projectPath, 'build');
    console.log(`Preparing ${projectPath}...`);

    // Install dependencies if missing
    if (!fs.existsSync(path.join(projectPath, 'node_modules'))) {
        console.log('Installing dependencies...');
        try {
            execSync('npm install', { cwd: projectPath, stdio: 'inherit' });
        } catch (error) {
            console.error('Failed to install dependencies:', error);
            return;
        }
    }

    // Build if 'build' folder is missing or we are in a CI environment (like Netlify)
    // We assume CI environment if 'CI' env var is true (Netlify sets this)
    if (!fs.existsSync(buildPath) || process.env.CI) {
        console.log('Building React app...');
        try {
            execSync('npm run build', { cwd: projectPath, stdio: 'inherit' });
        } catch (error) {
            console.error('Failed to build React app:', error);
        }
    } else {
        console.log('Build folder exists, skipping build (local mode).');
    }
}

console.log('Building for Netlify...');

// 1. Copy Root Files (index.html, script.js, style.css, images)
console.log('Copying root files...');
const rootFiles = ['index.html', 'script.js', 'style.css', 'favicon.ico', 'robots.txt'];
rootFiles.forEach(file => {
    if (fs.existsSync(path.join(__dirname, file))) {
        fs.copyFileSync(path.join(__dirname, file), path.join(distDir, file));
    }
});

// Copy root images folder if exists
if (fs.existsSync(path.join(__dirname, 'images'))) {
    copyDir(path.join(__dirname, 'images'), path.join(distDir, 'images'));
}

// Copy portfolio images (root level images)
const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.pdf'];
fs.readdirSync(__dirname).forEach(file => {
    if (imageExtensions.includes(path.extname(file).toLowerCase())) {
        fs.copyFileSync(path.join(__dirname, file), path.join(distDir, file));
    }
});

// 2. Copy GAMS (gams/public -> dist/gams)
console.log('Copying GAMS...');
copyDir(path.join(__dirname, 'gams/public'), path.join(distDir, 'gams/public'));
// Also copy to root of gams folder in dist to support /gams/file.html structure if needed
// Actually, our local-server serves gams/public at /gams, so we should map gams/public to dist/gams
const gamsDist = path.join(distDir, 'gams');
copyDir(path.join(__dirname, 'gams/public'), gamsDist);
// Create index.html from dashboard.html for GAMS
if (fs.existsSync(path.join(gamsDist, 'dashboard.html'))) {
    fs.copyFileSync(path.join(gamsDist, 'dashboard.html'), path.join(gamsDist, 'index.html'));
}


// 3. Copy Legal (legal/frontend/public -> dist/legal)
console.log('Copying Legal Web...');
copyDir(path.join(__dirname, 'legal/frontend/public'), path.join(distDir, 'legal/frontend/public'));
// Map legal/frontend/public to dist/legal for /legal/ URL access
const legalDist = path.join(distDir, 'legal');
copyDir(path.join(__dirname, 'legal/frontend/public'), legalDist);
// Create index.html from dashboard.html for Legal
if (fs.existsSync(path.join(legalDist, 'dashboard.html'))) {
    fs.copyFileSync(path.join(legalDist, 'dashboard.html'), path.join(legalDist, 'index.html'));
}


// 4. Copy Healthcare Web (healthcare-web -> dist/healthcare-web)
console.log('Copying Healthcare Web...');
copyDir(path.join(__dirname, 'healthcare-web'), path.join(distDir, 'healthcare-web'));

// 5. Copy CashTracking (CashTracking/frontend/build -> dist/cashtracking)
console.log('Copying CashTracking...');
const cashTrackingPath = path.join(__dirname, 'CashTracking/frontend');
buildReactApp(cashTrackingPath);
copyDir(path.join(cashTrackingPath, 'build'), path.join(distDir, 'cashtracking'));

console.log('Build complete! Output directory: dist');
