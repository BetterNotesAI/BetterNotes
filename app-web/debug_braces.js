
const fs = require('fs');
const content = fs.readFileSync('c:/Users/pedro/GitHub/BetterNotes/app-web/app/(app)/workspace/page.tsx', 'utf8');
const lines = content.split('\n');
let level = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const char of line) {
        if (char === '{') level++;
        if (char === '}') level--;
    }
    if (i >= 30 && i <= 300) {
        console.log(`${i + 1}: [Level ${level}] ${line}`);
    }
}
