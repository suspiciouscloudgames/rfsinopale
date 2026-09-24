import test from 'node:test'
import assert from 'node:assert/strict'
import {SentenceEvents,validSentenceEvent} from '../desktop/tablet/sentence-events.js'
test('fast input is retained until exact acknowledgment, retries keep IDs',()=>{
 const q=new SentenceEvents('tablet');q.enqueue('a');q.enqueue('b');assert.equal(q.packets().length,0)
 q.setSession('screen');const packets=q.packets();assert.equal(packets.length,2);assert.ok(validSentenceEvent(packets[0],'screen'))
 assert.deepEqual(q.packets(),packets);q.acknowledge(packets[0].eventId,'wrong');assert.equal(q.pending.size,2)
 q.acknowledge(packets[0].eventId,'screen');assert.equal(q.pending.size,1)
})
test('new screening session discards stale bound events, keeps new unbound events',()=>{
 const q=new SentenceEvents('tablet');q.enqueue('a');q.setSession('old');q.setSession('new');assert.equal(q.pending.size,0);assert.equal(q.discarded,1)
 q.enqueue('b');assert.equal(q.packets()[0].sessionId,'new')
 assert.equal(validSentenceEvent({...q.packets()[0],eventId:'spoof'},'new'),false)
})
