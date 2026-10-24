import fs from 'node:fs';import {spawnSync,spawn} from 'node:child_process';import https from 'node:https';import http from 'node:http';import {Client} from 'pg';
const step=(name,cmd,args,env=process.env)=>{const r=spawnSync(cmd,args,{env,encoding:'utf8',maxBuffer:20e6});if(r.status!==0){console.error(name+' FAILED');throw Error(name);}console.log(name+' PASS');return r.stdout;};
let proxy,web;
try{
 const raw=step('Local status','npx',['--yes','supabase@2.116.0','status','-o','json']);const status=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1));
 if(status.API_URL!=='http://127.0.0.1:56421'||new URL(status.DB_URL).hostname!=='127.0.0.1'||new URL(status.DB_URL).port!=='56422')throw Error('Local target guard');
 const db=new Client({connectionString:status.DB_URL});await db.connect();try{
 const result=await db.query(fs.readFileSync('supabase/tests/crm_quote_service_location.test.sql','utf8'));
 for(const r of Array.isArray(result)?result:[result])for(const row of r.rows??[])for(const v of Object.values(row))if(typeof v==='string'&&/^not ok/m.test(v))throw Error('SQL TAP failure');
 }finally{await db.end();}console.log('Service-location and invoice evidence SQL PASS');
 step('Review SQL lifecycle','node',['supabase/tests/crm_quote_review_local.mjs'],{...process.env,WASHOPS_REVIEW_SQL_QA:'true',WASHOPS_REVIEW_LOCAL_DATABASE_URL:status.DB_URL});
 step('Generate disposable TLS','openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout','.ci/key.pem','-out','.ci/cert.pem','-days','1','-subj','/CN=127.0.0.1']);
 proxy=https.createServer({key:fs.readFileSync('.ci/key.pem'),cert:fs.readFileSync('.ci/cert.pem')},(req,res)=>{const u=http.request({hostname:'127.0.0.1',port:56421,path:req.url,method:req.method,headers:{...req.headers,host:'127.0.0.1:56421'}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});u.on('error',()=>res.end());req.pipe(u);});await new Promise(r=>proxy.listen(56429,'127.0.0.1',r));
 const env={...process.env,VITE_BUILDER_PUBLICATION_PERSISTENCE:'supabase',VITE_BUILDER_MEDIA_PERSISTENCE:'supabase',VITE_ENABLE_BROWSER_FIXTURES:'false',VITE_SUPABASE_URL:'https://127.0.0.1:56429',VITE_SUPABASE_ANON_KEY:status.ANON_KEY,WASHOPS_REVIEW_AUTH_QA:'true',WASHOPS_LOCAL_QA_STATUS:JSON.stringify(status)};
 step('Production build','npm',['run','build'],env);
 web=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4218'],{env,stdio:'ignore'});
 for(let n=0;n<50;n++){try{if((await fetch('http://127.0.0.1:4218')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 fs.copyFileSync('.ci/accepted-ci.spec.ts','tests/e2e/accepted-ci.spec.ts');
 // Asynchronous child keeps the local TLS proxy responsive.
 const code=await new Promise(resolve=>{const p=spawn('node',['node_modules/@playwright/test/cli.js','test','--config','.ci/playwright.config.ts'],{env,stdio:['ignore','pipe','pipe']});let output='';p.stdout.on('data',b=>output+=b);p.stderr.on('data',b=>output+=b);p.on('close',c=>{const safe=output.replace(/https?:\/\/[^\s"'<>]+/g,'[URL]').replace(/\b[a-f0-9]{64}\b/gi,'[TOKEN]').replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g,'[JWT]');console.log(safe);resolve(c);});});if(code!==0)throw Error('Browser assertions');console.log('Browser gates PASS');
}catch(e){console.error('CI gate failed: '+(e.code??e.message));process.exitCode=1;}finally{web?.kill();proxy?.close();}
