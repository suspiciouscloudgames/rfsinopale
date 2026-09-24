import {SentenceEvents} from '../desktop/tablet/sentence-events.js'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
const source=readFileSync(new URL('../desktop/tablet/connection.js',import.meta.url),'utf8').replace(/^import .*\n/, '').replace('export function','function')+'\nglobalThis.connectScreen=connectScreen'
function fixture(display=false,legacy=false){
  let now=100000;const peers=[],timers=[],renders=[],controls=[],progress=[]
  class Events{constructor(){this.events={}}on(name,fn){(this.events[name]??=[]).push(fn)}emit(name,arg){for(const fn of this.events[name]||[])fn(arg)}}
  class Conn extends Events{constructor(){super();this.open=false;this.sent=[]}send(data){this.sent.push(data)}close(){this.open=false;this.emit('close')}ready(){this.open=true;this.emit('open')}}
  class Peer extends Events{constructor(id){super();this.id=typeof id==='string'?id:'random';this.open=false;this.links=[];peers.push(this)}connect(){const c=new Conn();this.links.push(c);return c}destroy(){this.open=false;this.links.forEach(c=>c.close())}ready(){this.open=true;this.emit('open')}}
  const context=vm.createContext({SentenceEvents,Date:{now:()=>now},crypto:legacy?{}:{randomUUID:()=> 'local'},Peer,window:{Peer,addEventListener(){},removeEventListener(){}},document:{hidden:false,documentElement:{dataset:{}},addEventListener(){},removeEventListener(){}},setTimeout(fn,delay){const t={fn,at:now+delay};timers.push(t);return t},clearTimeout(t){if(t)t.done=true},setInterval(fn,delay){const t={fn,at:now+delay,delay};timers.push(t);return t},clearInterval(t){if(t)t.done=true}})
  vm.runInContext(source,context)
  const api=context.connectScreen({display,room:'test',onState:s=>renders.push(s),onControl:c=>controls.push(c),onProgress:p=>progress.push(p),getState:()=>[]})
  function advance(ms){const end=now+ms;while(true){const t=timers.filter(t=>!t.done&&t.at<=end).sort((a,b)=>a.at-b.at)[0];if(!t)break;now=t.at;if(t.delay)t.at+=t.delay;else t.done=true;t.fn()}now=end}
  const state=(changedAt,items,sender='remote')=>({app:'gamepoem-v2',type:'state',sender,changedAt,revision:1,items})
  return {api,peers,renders,controls,progress,advance,Conn,state}
}
{
 const f=fixture();f.peers[0].ready();const c=f.peers[0].links[0];c.ready();f.advance(4000)
 assert.equal(c.sent.filter(p=>p.type==='state').length,0,'idle tabs never send empty snapshots')
 f.api.publish([{id:'0-0',active:true}]);assert.equal(c.sent.filter(p=>p.type==='state').length,1)
 c.emit('data',{app:'gamepoem-v2',sender:'screen',type:'ack'});f.advance(4000)
 assert.equal(c.sent.filter(p=>p.type==='state').length,1,'heartbeats do not become fresh edits')
}
{
 const f=fixture(true);f.peers[0].ready();const c=new f.Conn();c.ready();f.peers[0].emit('connection',c)
 c.emit('data',f.state(100000,[{id:'0-0',active:true}]))
 c.emit('data',f.state(99999,[],'idle'))
 c.emit('data',f.state(100000,[{id:'0-0',active:true}]))
 assert.equal(f.renders.length,1,'old and duplicate snapshots cannot overwrite active tablet')
 f.advance(96000);assert.equal(f.renders.at(-1).length,0,'abandoned layers expire')
}
{
 const f=fixture();f.peers[0].ready();f.advance(12000)
 assert.ok(f.peers[0].links.length>=2,'stalled connection is retried without menu or refresh')
}
{
 const f=fixture(true);f.peers[0].emit('error',{type:'unavailable-id'});f.advance(300)
 assert.equal(f.peers[1].id,'random','duplicate screen becomes a follower')
 f.peers[1].ready();const c=f.peers[1].links[0];c.ready();c.emit('data',f.state(100300,[{id:'0-0',active:true}]))
 assert.equal(f.renders.length,1,'follower screen receives the same layers')
}
console.log('Passed: idle-tab isolation, latest gesture ownership, layer expiry, stalled retry, duplicate screen following')

{
 const f=fixture(false,true);f.peers[0].ready();const c=f.peers[0].links[0];c.ready();f.api.publish([{id:'0-0',active:true}]);
 assert.ok(c.sent.find(p=>p.type==='state').sender.startsWith('tablet-'),'older Safari without randomUUID can publish gestures')
 console.log('Passed: Safari without crypto.randomUUID')
}

{
 const f=fixture(true);f.peers[0].ready();const c=new f.Conn();c.ready();f.peers[0].emit('connection',c)
 c.emit('data',f.state(100000,[{kind:'poem',token:'draft-1',lines:['a','b']}]))
 f.advance(320000)
 assert.equal(f.renders.at(-1)[0].token,'draft-1','poem survives the whole five-minute film')
 f.api.completePoem('draft-1');assert.equal(c.sent.at(-1).type,'cycle')
 assert.equal(c.sent.at(-1).token,'draft-1','completion identifies the exact poem')
}
{
 const f=fixture();f.peers[0].ready();const c=f.peers[0].links[0];c.ready()
 const packet={app:'gamepoem-v2',type:'cycle',role:'display',sender:'screen',token:'draft-1',eventId:'end-1'}
 c.emit('data',packet);c.emit('data',packet)
 assert.equal(f.controls.length,1,'duplicate end notifications reset only once')
}
console.log('Passed: full-film poem persistence and deduplicated cross-device completion')

{
 const screen=fixture(true);screen.peers[0].ready();screen.api.reportProgress(.75,'playing')
 const c=new screen.Conn();screen.peers[0].emit('connection',c);c.ready()
 const packet=c.sent.find(p=>p.type==='progress')
 assert.equal(packet.progress,.75,'late join receives current film position')
 const tablet=fixture();tablet.peers[0].ready();const link=tablet.peers[0].links[0];link.ready()
 const incoming={...packet,sender:'screen'};link.emit('data',incoming);link.emit('data',incoming)
 assert.equal(tablet.progress.length,1,'progress echoes are deduplicated')
 assert.equal(tablet.progress[0].progress,.75)
 assert.equal(link.sent.filter(p=>p.type==='state').length,0,'progress never publishes empty tablet state')
 link.emit('data',{...incoming,eventId:'bad',progress:4});assert.equal(tablet.progress.length,1)
 screen.api.reportProgress(1,'ending');assert.equal(c.sent.at(-1).phase,'ending')
 screen.api.reportProgress(0,'playing');assert.equal(c.sent.at(-1).progress,0,'new film cycle empties the box')
}
console.log('Passed: film progress late join, validation, deduplication and cycle reset')

{
 const f=fixture(); f.peers[0].ready();const c=f.peers[0].links[0];c.ready();
 f.api.publishTrigger('sentence-1');assert.equal(c.sent.filter(x=>x.type==='sentence-trigger').length,0);
 c.emit('data',{app:'gamepoem-v2',sender:'screen',type:'ack',screenSession:'installation-1'});
 const first=c.sent.find(x=>x.type==='sentence-trigger');assert.equal(first.event.phraseId,'sentence-1');
 f.advance(2000);assert.equal(c.sent.filter(x=>x.type==='sentence-trigger').at(-1).event.eventId,first.event.eventId);
 c.emit('data',{app:'gamepoem-v2',sender:'screen',room:'test',type:'trigger-ack',sessionId:'installation-1',eventId:first.event.eventId});
 const before=c.sent.filter(x=>x.type==='sentence-trigger').length;f.advance(2000);
 assert.equal(c.sent.filter(x=>x.type==='sentence-trigger').length,before);
 console.log('Passed: new tablet uses the installation session, retries unchanged events, stops after acknowledgment');
}
