// Stable per-instance variation; elapsed time is measured only while visible.
export function jellyPosition(index,aspect=1.6,elapsed=0,seed=0){
 const random=n=>{const v=Math.sin((index+1)*127.1+n*311.7+seed*74.7)*43758.5453;return v-Math.floor(v)}
 const layer=index%3,depth=[5.5,10.5,18][layer]+random(1)*2
 const speed=[.0038,.0026,.0017][layer]
 const start=.2+random(2)*.55,progress=(start+elapsed*speed)%1
 const lane=(random(3)-.5)*.12
 const u=.24+progress*.52+lane,v=.76-progress*.52+lane
 const height=2*Math.tan(35*Math.PI/360)*depth
 const size=[.25,.18,.12][layer]*(.85+random(4)*.35)
 // A brief shrink at the recycling boundary avoids teleporting visible models.
 const edge=Math.min(1,progress/.025,(1-progress)/.025)
 return {x:(u-.5)*height*aspect,y:(.5-v)*height,z:-depth,scale:height*size,layer,u,v,edge}
}

// One reserved individual crosses the camera plane from the viewer's side.
export function cameraPassPosition(elapsed,aspect=1.6){
 const t=Math.max(0,elapsed),z=3.2-Math.min(t,65)*.2
 const travel=Math.max(0,Math.min(1,(t-23)/42))
 const ease=travel*travel*(3-2*travel)
 const depth=Math.max(.1,-z),height=2*Math.tan(35*Math.PI/360)*depth
 return {x:height*aspect*.24*ease,y:-.35+height*.24*ease,z,scale:3.8,edge:1,layer:0,u:.5+.24*ease,v:.5-.24*ease}
}
