const { execSync } = require('child_process');

try {
    const list = execSync('wmic process get ProcessId,Name,CommandLine /FORMAT:CSV').toString();
    const lines = list.split('\r\n');
    for (const line of lines) {
        if (line.includes('win-unpacked') || line.includes('Hunter Trades') || line.includes('resources') || line.includes('electron')) {
            console.log('Found matching process:', line);
            const parts = line.split(',');
            const pid = parts[parts.length - 1] || parts[parts.length - 2];
            if (pid && !isNaN(parseInt(pid))) {
                try {
                    console.log(`Killing PID ${pid}...`);
                    execSync(`taskkill /F /PID ${pid} /T`);
                } catch (e) {
                    console.log(`Error killing PID ${pid}:`, e.message);
                }
            }
        }
    }
} catch (e) {
    console.error('WMIC error:', e.message);
}
