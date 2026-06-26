const fs = require('fs');

const f1 = fs.statSync('./repo_extracted/PeladaBatista-main');
console.log('repo_extracted: ', f1.birthtime, f1.mtime);

const f2 = fs.statSync('./src');
console.log('src: ', f2.birthtime, f2.mtime);
