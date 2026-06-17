const fs = require('fs');

const m = require('child_process').execSync('cd ./repo_extracted/PeladaBatista-main && git log -1').toString();
console.log(m);
