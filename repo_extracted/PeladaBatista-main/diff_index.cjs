const fs = require('fs');

const c1 = fs.readFileSync('./repo_extracted/PeladaBatista-main/src/index.css', 'utf8');
const c2 = fs.readFileSync('./src/index.css', 'utf8');

console.log("=== REPO EXTRACTED ===");
console.log(c1.substring(0, 300));
console.log("=== WORKSPACE ===");
console.log(c2.substring(0, 300));
