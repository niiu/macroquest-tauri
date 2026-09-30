// Each patch is built and snapshotted before the next change is started.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const version=process.argv[2];if(!/^0\.2\.[1-9][0-9]*$/.test(version))throw Error('Expected 0.2.x');
const dest=path.join('dist','releases',version);fs.mkdirSync(dest,{recursive:true});
for(const name of ['package.json','src-tauri/tauri.conf.json']){const data=JSON.parse(fs.readFileSync(name));data.version=version;fs.writeFileSync(name,JSON.stringify(data,null,2)+'\n');}
const lock=JSON.parse(fs.readFileSync('package-lock.json'));lock.version=version;lock.packages[''].version=version;fs.writeFileSync('package-lock.json',JSON.stringify(lock,null,2)+'\n');
fs.writeFileSync('src-tauri/Cargo.toml',fs.readFileSync('src-tauri/Cargo.toml','utf8').replace(/version = "0\.2\.\d+"/,'version = "'+version+'"'));
function run(name,command){const result=spawnSync(command,{shell:true,encoding:'utf8',maxBuffer:20*1024*1024});fs.writeFileSync(path.join(dest,name+'.log'),(result.stdout||'')+(result.stderr||''));if(result.status!==0){process.stderr.write((result.stdout||'')+(result.stderr||''));throw Error(name+' failed');}console.log(version+': '+name+' OK');}
run('tests','npm.cmd test');run('build','npm.cmd run build:windows');
for(const [source,name] of [['src-tauri/target/release/macroquest.exe','Macroquest-'+version+'.exe'],['src-tauri/target/release/bundle/nsis/Macroquest_'+version+'_x64-setup.exe','Macroquest-'+version+'-Setup.exe']])fs.copyFileSync(source,path.join(dest,name));
const source=path.join(dest,'source');fs.mkdirSync(source,{recursive:true});
function copy(from,to){fs.mkdirSync(to,{recursive:true});for(const entry of fs.readdirSync(from,{withFileTypes:true})){if(['target','gen','node_modules','dist','.git','.tmp','vendor'].includes(entry.name))continue;const a=path.join(from,entry.name),b=path.join(to,entry.name);if(entry.isDirectory()){if(['src-tauri','icons','capabilities','src','assets','characters'].includes(entry.name))copy(a,b);}else if(/\.(js|cjs|css|html|json|toml|rs|lock|md|svg|ico|png)$/.test(entry.name))fs.copyFileSync(a,b);}}
copy('.',source);console.log('Release ready: '+dest);
