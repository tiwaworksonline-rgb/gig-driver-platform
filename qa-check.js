const fs=require('fs'),path=require('path');
const root=__dirname;
const html=fs.readdirSync(root).filter(x=>x.endsWith('.html'));
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const routes=new Set([...server.matchAll(/app\.(?:get|post|put|patch|delete)\(['\"]([^'\"]+)/g)].map(m=>m[1]));
let errors=[]; let links=0,assets=0,fetches=0,buttons=0;
for(const f of html){
 const s=fs.readFileSync(path.join(root,f),'utf8');
 buttons += (s.match(/<button\b/g)||[]).length;
 for(const m of s.matchAll(/href=['\"]([^'\"]+)/g)){
   const x=m[1]; links++;
   if(/^(https?:|mailto:|#|javascript:)/.test(x)) continue;
   const clean=x.split('?')[0]; if(clean && !fs.existsSync(path.join(root,clean))) errors.push(`${f}: missing href ${x}`);
 }
 for(const m of s.matchAll(/src=['\"]([^'\"]+)/g)){
   const x=m[1]; if(x.startsWith('data:')||x.includes('${')) continue; assets++;
   const clean=x.split('?')[0]; if(clean && !fs.existsSync(path.join(root,clean))) errors.push(`${f}: missing asset ${x}`);
 }
 for(const m of s.matchAll(/fetch\((?:`|'|\")([^`'\"]+)/g)){
   const x=m[1]; if(!x.startsWith('/api/')&&!x.startsWith('/health')) continue; fetches++;
   const base=x.split('?')[0].replace(/\$\{.*$/,'');
   if(![...routes].some(r=>base===r || (r==='*'))) errors.push(`${f}: frontend endpoint not found ${base}`);
 }
}
console.log(JSON.stringify({htmlPages:html.length,buttons,links,assets,frontendApiCalls:fetches,serverRoutes:[...routes],errors},null,2));
if(errors.length) process.exit(1);
