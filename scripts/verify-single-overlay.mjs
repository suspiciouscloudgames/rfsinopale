import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const dir=await mkdtemp(path.join(os.tmpdir(),'sea-single-overlay-'));
const env={...process.env,SEA_TEST_DATA:dir};delete env.ELECTRON_RUN_AS_NODE;
let app;
try {
 app=await electron.launch({args:[path.resolve(import.meta.dirname,'..'),'--preview'],env});
 let page;
 for(let i=0;i<150;i++){
  page=app.windows().find(p=>p.url().includes('channel=A'));
  if(page)break;
  await new Promise(r=>setTimeout(r,100));
 }
 assert.ok(page);
 await page.waitForFunction(()=>!!window.installation);
 await page.route('**/single-overlay-list.json*',async route=>{
  await new Promise(r=>setTimeout(r,150));
  await route.fulfill({json:['/assets/tiggerVideos/web/Untitled_1.mp4']});
 });
 const result=await page.evaluate(async()=>{
  const {createOverlays}=await import('/video/overlays.js');
  const {validateSettings}=await import('/video/config.js');
  const root=document.createElement('div');root.style.cssText='position:fixed;width:800px;height:600px';document.body.append(root);
  const errors=[],o=createOverlays(root,e=>errors.push(e));
  const settings={...validateSettings({maxOverlays:4}),overlaySeconds:.5,triggerVideoUrl:'/single-overlay-list.json'};
  const migrated=settings.maxOverlays;
  // Exercise the asynchronous source-loading race with an old multi-video setting too.
  settings.maxOverlays=4;
  await Promise.all(Array.from({length:30},()=>o.play(settings)));
  const first=root.querySelector('video'),initialCount=o.count;
  const wait=async fn=>{const start=performance.now();while(!fn()){if(performance.now()-start>10000)throw Error('timeout');await new Promise(r=>setTimeout(r,20));}};
  await wait(()=>first.currentTime>.1);
  const time=first.currentTime;
  await Promise.all(Array.from({length:30},()=>o.play(settings)));
  const unchanged=root.querySelector('video')===first&&first.currentTime>=time&&o.count===1;
  await wait(()=>{o.frame();return o.count===0});
  await new Promise(r=>setTimeout(r,250));
  const noQueue=o.count===0;
  await o.play(settings);const restarts=o.count===1&&root.querySelector('video')!==first;
  o.clear();
  // Clearing while a load is pending must not release a newer request's slot.
  const slow={...settings,triggerVideoUrl:'/single-overlay-list.json?round=2'};
  const stale=o.play(slow);o.clear();const fresh=o.play(slow);await Promise.all([stale,fresh,o.play(slow)]);
  const clearRace=o.count===1;o.clear();root.remove();
  return {migrated,initialCount,unchanged,noQueue,restarts,clearRace,errors};
 });
 assert.equal(result.migrated,1);assert.equal(result.initialCount,1);
 for(const k of ['unchanged','noQueue','restarts','clearRace'])assert.equal(result[k],true,k);
 assert.deepEqual(result.errors,[]);console.log(JSON.stringify(result));
} finally {await app?.close();await rm(dir,{recursive:true,force:true});}
