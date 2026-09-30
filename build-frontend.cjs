const fs = require('node:fs');
const path = require('node:path');
const out = path.join(__dirname, 'dist/frontend');
fs.mkdirSync(out, {recursive:true});
for (const name of fs.readdirSync(__dirname)) {
  if (/\.(js|css|html)$/.test(name) || name === 'demo-quest.json') fs.copyFileSync(path.join(__dirname,name),path.join(out,name));
}
fs.mkdirSync(path.join(out,'vendor'),{recursive:true});
for(const name of fs.readdirSync(path.join(__dirname,'vendor')))fs.copyFileSync(path.join(__dirname,'vendor',name),path.join(out,'vendor',name));
console.log('Frontend ready: dist/frontend');
