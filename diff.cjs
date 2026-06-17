const fs = require('fs');
const path = require('path');

function walk(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const stat = fs.statSync(path.join(dir, file));
    if (stat.isDirectory()) {
      fileList = walk(path.join(dir, file), fileList);
    } else {
      fileList.push(path.join(dir, file));
    }
  }
  return fileList;
}

const dir1 = './repo_extracted/PeladaBatista-main/src';
const dir2 = './src';
const files1 = walk(dir1).map(f => path.relative(dir1, f));

for (const file of files1) {
  const f1 = path.join(dir1, file);
  const f2 = path.join(dir2, file);
  if (fs.existsSync(f2)) {
    const c1 = fs.readFileSync(f1, 'utf8');
    const c2 = fs.readFileSync(f2, 'utf8');
    if (c1 !== c2) {
      console.log('Differ:', file);
    }
  } else {
    console.log('Only in repo:', file);
  }
}
