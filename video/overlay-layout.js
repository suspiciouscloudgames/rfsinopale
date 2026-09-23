// Reveal centers can occupy the entire film, including its center and edges.
export function overlayPlacement(sequence,random=Math.random){
 const width=1+random()*.48,height=1+random()*.48
 return {x:random()-width/2,y:random()-height/2,width,height,seed:random()*1000}
}
export function revealEnvelope(time,duration=17){
 const t=Math.max(0,time),fade=duration*7/17,holdEnd=duration*10/17
 const smooth=x=>x*x*(3-2*x)
 const rise=Math.max(0,Math.min(1,t/fade))
 const fall=Math.max(0,Math.min(1,(duration-t)/fade))
 return {spread:smooth(rise),opacity:t<fade?smooth(rise):t<=holdEnd?1:smooth(fall)}
}

// Accumulate media time across loops so short clips keep the reveal alive.
export function overlayTimeStep(previous,current,duration){
 return current>=previous?current-previous:Math.max(0,duration-previous+current)
}
