const fs = require('fs');

const f1 = fs.statSync('./repo_extracted/PeladaBatista-main/src/App.tsx');
const f2 = fs.statSync('./src/App.tsx');

console.log('repo_extracted App.tsx: ', f1.mtime);
console.log('workspace App.tsx: ', f2.mtime);
