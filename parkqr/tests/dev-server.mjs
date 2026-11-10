// Local copy of the site: static files + the Pages Functions on an in-memory SQLite database. Run: npm run dev  (http://localhost:8788)
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const ROOT=new URL('../site',import.meta.url).pathname,F=ROOT+'/functions/api/';
const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync(ROOT+'/schema.sql','utf8'));
const DB={prepare:(sql)=>{const st=db.prepare(sql);let a=[];const o={bind:(...x)=>{a=x;return o},run:async()=>{st.run(...a);return{}},first:async()=>st.get(...a)??null,all:async()=>({results:st.all(...a)})};return o}};
const routes=[['GET',/^\/api\/results$/,'results.js',()=>({})],['GET',/^\/api\/interest$/,'interest.js',()=>({})],['POST',/^\/api\/interest$/,'interest.js',()=>({})],['POST',/^\/api\/nudge$/,'nudge.js',()=>({})],['POST',/^\/api\/survey$/,'survey.js',()=>({})],['GET',/^\/api\/push-key$/,'push-key.js',()=>({})],['POST',/^\/api\/push-subscribe$/,'push-subscribe.js',()=>({})],['POST',/^\/api\/push-unsubscribe$/,'push-unsubscribe.js',()=>({})],['POST',/^\/api\/push-test$/,'push-test.js',()=>({})],['POST',/^\/api\/register$/,'register.js',()=>({})],['GET',/^\/api\/car$/,'car.js',()=>({})],['POST',/^\/api\/send$/,'send.js',()=>({})],['GET',/^\/api\/status$/,'status.js',()=>({})],
['GET',/^\/api\/inbox$/,'inbox.js',()=>({})],['POST',/^\/api\/inbox\/reply$/,'inbox/reply.js',()=>({})],['POST',/^\/api\/inbox\/pause$/,'inbox/pause.js',()=>({})]];
const types={'.png':'image/png','.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://l');let body='';for await(const c of req)body+=c;
  for(const [meth,re,file,pf] of routes){const m=u.pathname.match(re);if(m&&req.method===meth){
    const mod=await import(F+file);const fn=meth==='GET'?mod.onRequestGet:mod.onRequestPost;
    const r=await fn({request:new Request('http://l'+req.url,{method:meth,headers:{...req.headers,'cf-connecting-ip':'9.9.9.'+(Math.random()*200|0)},body:meth==='POST'?body:undefined}),params:pf(m),env:{DB,SALT:'x',ADMIN_KEY:'dev-admin-key'}});
    res.writeHead(r.status,Object.fromEntries(r.headers));res.end(await r.text());return}}
  let p=u.pathname;if(p==='/c')p='/c.html';if(p==='/manifest.webmanifest'){res.writeHead(200,{'content-type':'application/manifest+json'});res.end('{}');return}if(p==='/')p='/index.html';
  const fp=path.join(ROOT,p);if(!fp.startsWith(ROOT)||!fs.existsSync(fp)){res.writeHead(404);res.end('nf');return}
  res.writeHead(200,{'content-type':types[path.extname(fp)]||'text/plain'});res.end(fs.readFileSync(fp));
}).listen(8788,()=>console.log('up'));
