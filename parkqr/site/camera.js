// Live camera only. Opens a full-screen camera, takes ONE picture from the video stream and returns it as a JPEG data URL
// (or null if cancelled / camera unavailable). There is no gallery picker, so the picture cannot be an old or generated file.
function liveCapture(){
  return new Promise(async resolve=>{
    let stream=null;
    const ov=document.createElement('div');ov.className='liveCam';
    ov.innerHTML='<video playsinline muted autoplay></video><img alt="" hidden><div class="lcMsg"></div><button type="button" class="lcX" aria-label="إغلاق">×</button><div class="lcBar"><button type="button" class="lcShot" aria-label="التقط"><i></i></button><button type="button" class="lcAgain" hidden>إعادة</button><button type="button" class="lcOk" hidden>إرسال</button></div>';
    document.body.appendChild(ov);document.body.style.overflow='hidden';
    const $=s=>ov.querySelector(s),v=$('video'),im=$('img'),shot=$('.lcShot'),again=$('.lcAgain'),ok=$('.lcOk');let data=null;
    const done=r=>{if(stream)stream.getTracks().forEach(t=>t.stop());ov.remove();document.body.style.overflow='';resolve(r)};
    $('.lcX').onclick=()=>done(null);
    again.onclick=()=>{data=null;im.hidden=true;v.hidden=false;shot.hidden=false;again.hidden=true;ok.hidden=true};
    ok.onclick=()=>done(data);
    shot.onclick=()=>{
      if(!v.videoWidth)return;
      const w=Math.min(960,v.videoWidth),h=Math.round(v.videoHeight*w/v.videoWidth),c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(v,0,0,w,h);
      let q=.72,d=c.toDataURL('image/jpeg',q);while(d.length>250000&&q>.3){q-=.1;d=c.toDataURL('image/jpeg',q)}
      data=d;im.src=d;im.hidden=false;v.hidden=true;shot.hidden=true;again.hidden=false;ok.hidden=false;
    };
    try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280}},audio:false});v.srcObject=stream}
    catch(e){$('.lcMsg').textContent=e&&e.name==='NotAllowedError'?'فعّل الكاميرا من إعدادات المتصفح وجرّب كمان مرة.':'ما قدرنا نفتح الكاميرا.';shot.hidden=true}
  });
}
