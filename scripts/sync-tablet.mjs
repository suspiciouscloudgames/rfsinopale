import {readFile,writeFile,mkdir,cp,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const source=path.resolve(process.argv[2]||path.join(root,'../gamepoem/site'));
const target=path.join(root,'desktop/tablet');
const files=execFileSync('git',['-C',source,'ls-files','-z'],{encoding:'utf8'}).split('\0').filter(p=>p&&!p.startsWith('.')&&p!=='HANDOFF.md');
const hashes={};
for(const file of files){const out=path.join(target,file);await mkdir(path.dirname(out),{recursive:true});await cp(path.join(source,file),out);hashes[file]=createHash('sha256').update(await readFile(out)).digest('hex');}
// Include newly added photographs even before the artist commits them to Git.
const pictures=(await readdir(path.join(source,'pictures'),{withFileTypes:true})).filter(entry=>entry.isFile()&&/\.(jpe?g|png|webp|avif)$/i.test(entry.name)).map(entry=>entry.name).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
await mkdir(path.join(target,'pictures'),{recursive:true});
for(const name of pictures){const file=path.join('pictures',name),out=path.join(target,file);await cp(path.join(source,file),out);hashes[file]=createHash('sha256').update(await readFile(out)).digest('hex');}
const pictureManifest=JSON.stringify(pictures,null,2)+'\n';
await writeFile(path.join(target,'pictures/manifest.json'),pictureManifest);
hashes['pictures/manifest.json']=createHash('sha256').update(pictureManifest).digest('hex');
// Older tablet checkouts need the bridge; current published sources already include it.
const integratedSource=(await readFile(path.join(target,'connection.js'),'utf8')).includes('const events=new SentenceEvents(sender)')&&(await readFile(path.join(target,'app.js'),'utf8')).includes('const pendingTriggers=[],knownLines=new Set()');
if(!integratedSource){
function replace(source,from,to){if(!source.includes(from))throw new Error('Tablet source changed: '+from);return source.replace(from,to)}
let connection=await readFile(path.join(target,'connection.js'),'utf8');
connection="import {SentenceEvents,validSentenceEvent} from './sentence-events.js'\n"+connection;
connection=replace(connection,'getState,onControl,onProgress}', 'getState,onControl,onProgress,onTrigger,screenSession}');
connection=replace(connection,"const role=display?'display':'tablet'",`const role=display?'display':'tablet'
  const events=new SentenceEvents(sender)
  const screenAck=()=>packet('ack',screenSession?{screenSession}:{})
  function flushEvents(){for(const event of events.packets()){const data=packet('sentence-trigger',{event,room});channel?.postMessage(data);send(upstream,data)}}`);
connection=replace(connection,"if(data.type==='ack') {",`if(data.type==='trigger-ack'&&!display&&data.room===room){events.acknowledge(data.eventId,data.sessionId);return}
    if(data.type==='sentence-trigger'&&display&&data.room===room&&screenSession&&validSentenceEvent(data.event,screenSession)){
      onTrigger?.(data.event,()=>{const ack=packet('trigger-ack',{room,eventId:data.event.eventId,sessionId:screenSession});conn?send(conn,ack):channel?.postMessage(ack)})
      return
    }
    if(data.type==='ack') {
      if(!display&&data.screenSession){events.setSession(data.screenSession);flushEvents()}`);
connection=connection.replaceAll("packet('ack')","screenAck()");
connection=replace(connection,"send(conn,packet('hello'));sync(conn)","send(conn,packet('hello'));sync(conn);flushEvents()");
connection=replace(connection,"if(!display)status(","if(!display){flushEvents();document.documentElement.dataset.triggerPending=String(events.pending.size)}\n    if(!display)status(");
connection=replace(connection,'return {publish,reportProgress','return {publish,publishTrigger(phraseId){events.enqueue(phraseId);flushEvents()},reportProgress');
await writeFile(path.join(target,'connection.js'),connection);
let app=await readFile(path.join(target,'app.js'),'utf8');
app=replace(app,'let network,pendingState,disposed=false',`let network,pendingState,disposed=false
const pendingTriggers=[],knownLines=new Set()
function publishPoem(items){
  if(!items.length)knownLines.clear()
  for(const fill of items.find(item=>item.kind==='poem')?.fills||[]){
    if(knownLines.has(fill.lineId))continue
    knownLines.add(fill.lineId)
    if(network)network.publishTrigger(fill.sentenceId);else pendingTriggers.push(fill.sentenceId)
  }
  if(network)network.publish(items);else pendingState=items
}`);
app=replace(app,'network=transport.connectScreen(options)','network=transport.connectScreen(options)\n    for(const id of pendingTriggers.splice(0))network.publishTrigger(id)');
app=replace(app,'startConnection({display:true,room,onState:renderLayers})',`const acknowledgements=new Map(),screenSession=params.get('screenSession')
  const parentOrigin=parent!==window&&document.referrer?new URL(document.referrer).origin:null
  window.addEventListener('message',event=>{
    if(event.source!==parent||event.origin!==parentOrigin||event.data?.type!=='sentence-ack'||event.data.sessionId!==screenSession)return
    acknowledgements.get(event.data.eventId)?.();acknowledgements.delete(event.data.eventId)
  })
  startConnection({display:true,room,onState:renderLayers,screenSession:parentOrigin?screenSession:null,onTrigger(event,ack){
    if(!parentOrigin)return
    acknowledgements.set(event.eventId,ack)
    parent.postMessage({type:'sentence-trigger',event,room},parentOrigin)
  }})`);
app=replace(app,'send(items){if(network)network.publish(items);else pendingState=items}','send:publishPoem');
await writeFile(path.join(target,'app.js'),app);
}
await writeFile(path.join(target,'snapshot.json'),JSON.stringify({source:'gamepoem/site',revision:execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),adapter:'scripts/sync-tablet.mjs',hashes},null,2)+'\n');
console.log(`Synced ${files.length} author tablet files with the installation event bridge.`);
