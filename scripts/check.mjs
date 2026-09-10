import { readFile, readdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
const root=path.resolve('dist');
for(const name of await readdir(root))if(name.endsWith('.js'))execFileSync(process.execPath,['--check',path.join(root,name)]);
const html=await readFile(path.join(root,'index.html'),'utf8');
for(const [,file] of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g))assert.ok((await stat(path.join(root,file))).isFile(),file);
const manifest=JSON.parse(await readFile(path.join(root,'manifest.webmanifest'),'utf8'));
for(const icon of manifest.icons){const file=await readFile(path.join(root,icon.src));assert.equal(file.toString('hex',0,8),'89504e470d0a1a0a');assert.equal(`${file.readUInt32BE(16)}x${file.readUInt32BE(20)}`,icon.sizes);}
const sw=await readFile(path.join(root,'sw.js'),'utf8');
const list=sw.match(/const ASSETS = (\[[^;]+\]);/)[1];
for(const file of JSON.parse(list.replaceAll("'",'"')))await stat(path.join(root,file));
assert.equal(manifest.display,'standalone');
assert.ok(!html.includes('http://')&&!html.includes('https://'),'All shell assets are local');
console.log('JavaScript syntax, HTML assets, PWA manifest, PNG sizes and offline cache assets: PASS');
