import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(new URL('..',import.meta.url).pathname);
const server=createServer(async(req,res)=>{
 try{const pathname=new URL(req.url,'http://localhost').pathname;const file=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));if(!file.startsWith(root+'/'))throw Error();const bytes=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[extname(file)]||'application/octet-stream');res.end(bytes);}catch{res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 let checks=0;
 const publicPage=await browser.newPage();const publicErrors=[];publicPage.on('pageerror',e=>publicErrors.push(e.message));await publicPage.goto(origin);assert.equal(await publicPage.locator('[data-topic]').count(),6);assert.deepEqual(publicErrors,[]);checks++;
 const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let draft=null,rev=0,live=null;const calls=[];
 await page.route('**/cms-config.js',route=>route.fulfill({contentType:'text/javascript',body:`window.ROSEAURA_CMS={url:'https://cms.test',key:'public-test'};`}));
 await page.route('https://cms.test/**',async route=>{
  const req=route.request();const url=new URL(req.url());calls.push(url.pathname);
  let result=[];
  if(url.pathname==='/auth/v1/token'||url.pathname==='/auth/v1/verify')result={access_token:'test-session',user:{id:'00000000-0000-0000-0000-000000000002'}};
  if(url.pathname==='/rest/v1/ra_roles')result=[{role:'content_manager'}];
  if(url.pathname==='/rest/v1/ra_draft')result=draft?[{id:1,content:draft,revision:rev}]:[];
  if(url.pathname==='/rest/v1/rpc/ra_write'){const b=req.postDataJSON();if(b.operation==='save')draft=b.payload;if(b.operation==='publish')live=structuredClone(draft);result=++rev;}
  if(url.pathname==='/rest/v1/ra_live')result=live?[{content:live}]:[];
  await route.fulfill({contentType:'application/json',body:JSON.stringify(result),headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'*'}});
 });
 await page.goto(origin+'/admin/');await page.waitForFunction(()=>typeof base!=='undefined'&&base!==null);
 await page.getByLabel('Courriel',{exact:true}).fill('gestionnaire@example.com');await page.getByLabel('Mot de passe',{exact:true}).fill('a-test-password');await page.getByRole('button',{name:'Se connecter'}).click();await page.locator('#workspace').waitFor({state:'visible'});
 assert.equal(await page.locator('#role').textContent(),'Gestionnaire de contenu');assert.equal(await page.locator('#accountsTab').isVisible(),false);assert.equal(await page.locator('#historyTab').isVisible(),false);checks++;
 assert.ok(await page.locator('#editor textarea').count()>50);checks++;
 await page.locator('#editor textarea').first().fill('Accueil RoseAura modifié');await page.getByRole('button',{name:'Enregistrer le brouillon'}).click();await page.waitForFunction(()=>dirty===false);
 assert.equal(draft.schemaVersion,'aura-2026-10');assert.equal(live,null);assert.equal(await page.locator('#publish').isDisabled(),true);checks++;
 await page.getByRole('button',{name:'Aperçu',exact:true}).click();await page.waitForFunction(()=>previewed===true);const frame=page.frameLocator('#previewFrame');assert.ok((await frame.locator('body').innerText()).includes('Accueil RoseAura modifié'));checks++;
 await page.getByRole('button',{name:'Fermer',exact:true}).click();page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Publier',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('publiés'));assert.equal(live.schemaVersion,'aura-2026-10');checks++;
 await page.getByRole('button',{name:'Articles',exact:true}).click();await page.getByRole('button',{name:'Ajouter',exact:true}).click();await page.locator('input[data-key=title]').fill('<img src=x onerror="window.bad=true">');await page.locator('textarea[data-key=body]').fill('Article de Melissa');await page.locator('input[data-key=published]').check();await page.getByRole('button',{name:'Aperçu',exact:true}).click();await page.waitForFunction(()=>previewed===true);assert.equal(await frame.locator('#cms-articles h2').textContent(),'<img src=x onerror="window.bad=true">');assert.equal(await page.frames().find(f=>f.url().includes('cms-preview')&&f!==page.frames()[1])?.evaluate(()=>window.bad),undefined);checks++;
 await page.getByRole('button',{name:'Fermer',exact:true}).click();await page.getByRole('button',{name:'Photos',exact:true}).click();await page.getByRole('button',{name:'Ajouter',exact:true}).click();assert.equal(await page.locator('#editor .card').count(),5);checks++;
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);checks++;
 await page.getByRole('button',{name:'Déconnexion',exact:true}).click();await page.locator('#workspace').waitFor({state:'hidden'});assert.equal(await page.locator('#workspace').isVisible(),false);assert.equal(await page.evaluate(()=>token), '');assert.deepEqual(errors,[]);checks++;
 await page.goto(origin+'/admin/#token_hash=test-token&type=recovery');await page.locator('#activate').waitFor({state:'visible'});await page.locator('#activateForm input[name=password]').fill('new-long-password');await page.locator('#activateForm input[name=confirm]').fill('new-long-password');await page.getByRole('button',{name:'Activer mon accès'}).click();await page.locator('#workspace').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>location.hash),'');checks++;
 console.log(`${checks} public rendering and administration interface checks passed (mock Auth/REST transport)`);
}finally{await browser.close();server.close();}
