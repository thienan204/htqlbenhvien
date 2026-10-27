const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getGitInfo() {
    let commitCount = '548';
    let commitHash = 'latest';
    let lastCommitDate = '';

    try {
        commitCount = execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim();
        commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
        lastCommitDate = execSync('git log -1 --format=%cd --date=format:"%d/%m/%Y %H:%M"', { encoding: 'utf8' }).trim();
    } catch (e) {
        // Fallback if git is not available (e.g. inside docker build without .git)
    }

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const currentDate = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
    const currentTime = `${currentDate} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    return {
        buildNumber: parseInt(commitCount, 10) || 548,
        commitHash,
        buildDate: currentDate,
        buildTime: lastCommitDate || currentTime,
        fullVersion: `v2.5.${commitCount}`
    };
}

const buildInfo = getGitInfo();
const targetPath = path.join(__dirname, '../src/config/buildInfo.json');

fs.writeFileSync(targetPath, JSON.stringify(buildInfo, null, 2), 'utf8');
console.log(`✅ Đã tạo buildInfo: Phiên bản ${buildInfo.fullVersion} (Build #${buildInfo.buildNumber} - ${buildInfo.commitHash})`);
