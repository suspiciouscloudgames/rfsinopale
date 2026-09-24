// Keep the tablet's finalized-poem protocol at the edge of the existing show controller.
export function createPoemEnding(iframe, origin) {
  const send = data => iframe.contentWindow?.postMessage(data, origin);
  return {
    progress(time, duration, phase, cycle) {
      send({type:'film-progress', progress:duration ? Math.min(1,time/duration) : 0, currentTime:time, phase, cycle});
    },
    finish() {
      return new Promise((resolve, reject) => {
        let token = null;
        const done = (result, error) => {
          clearTimeout(timer); window.removeEventListener('message', receive);
          error ? reject(error) : resolve(result);
        };
        let timer = setTimeout(() => done(null, new Error('아이패드 엔딩 연결 응답 없음')), 4000);
        function receive(event) {
          if(event.source !== iframe.contentWindow || event.origin !== origin) return;
          const data = event.data;
          if(data?.type === 'poem-ending') {
            if(data.duration === 0) { done({token:null}); return; }
            if(data.duration !== 10000 || typeof data.token !== 'string') return;
            token = data.token; clearTimeout(timer);
            timer = setTimeout(() => done(null, new Error('시 엔딩 완료 응답 없음')), 13000);
          } else if(data?.type === 'poem-finished' && token && data.token === token) done({token});
        }
        window.addEventListener('message', receive);
        send({type:'film-ended'});
      });
    },
    reset(token) { send({type:'film-restarted', resetToken:token}); }
  };
}
