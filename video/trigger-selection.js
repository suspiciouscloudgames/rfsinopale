export function chooseVideo(list,previous,random=Math.random){
 const choices=list.length>1?list.filter(url=>url!==previous):list
 if(!choices.length)throw new Error('Empty trigger video list')
 return choices[Math.floor(random()*choices.length)]
}
