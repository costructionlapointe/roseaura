import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(new URL('..',import.meta.url).pathname);
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpeg':'image/jpeg'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
// An old CMS publication must never overwrite the new layout.
await page.route('**/rest/v1/ra_live**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify([{content:{texts:[{id:'0',value:'OLD SHOP'}]}}])}));
for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});await page.goto(origin);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await page.locator('h1').innerText(),'Rendre visible\nl’invisible.');await page.locator('img').evaluateAll(imgs=>imgs.forEach(i=>i.loading='eager'));await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));assert.equal(await page.locator('img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)),true);await page.screenshot({path:`/workspace/scratch/73654156f1a1/preview-${width}.png`,fullPage:width===390});}
await page.setViewportSize({width:390,height:844});await page.locator('#menu').click();assert.equal(await page.locator('#menu').getAttribute('aria-expanded'),'true');await page.locator('#navigation a').first().click();assert.equal(await page.locator('#menu').getAttribute('aria-expanded'),'false');
for(let i=0;i<6;i++){await page.locator(`[data-lens="${i}"]`).click();assert.equal(await page.locator('[data-lens][aria-pressed=true]').count(),1);assert.equal(await page.locator('#lens-question').innerText(),await page.evaluate(i=>LENSES[i][1],i));}
await page.locator('#search').fill('émotions');assert.equal(await page.locator('[data-topic]:visible').count(),1);await page.locator('#search').fill('zzzz');assert.equal(await page.locator('#empty').isVisible(),true);await page.locator('#search').fill('');assert.equal(await page.locator('[data-topic]:visible').count(),6);
await page.locator('[data-request="Le livre MOI"]').click();assert.equal(await page.locator('#interest').inputValue(),'Le livre MOI');
assert.equal(await page.evaluate(()=>[...document.querySelectorAll('a[href^="#"]')].every(a=>document.querySelector(a.getAttribute('href')))),true);
await page.emulateMedia({media:'print'});assert.equal(await page.locator('.print-lenses article:visible').count(),6);assert.equal(await page.locator('#contact').isVisible(),false);assert.deepEqual(errors,[]);console.log('Aura checks passed: 3 viewport sizes, all 6 lenses, mobile navigation, accent search, empty state, inquiry selection, anchors, images, print and legacy CMS protection.');
}finally{await browser.close();server.close();}
