import {accessToken,google} from './google.js';
export const MAX_IMAGE=8*1024*1024;
export async function readImage(request) {
  if(Number(request.headers.get('Content-Length'))>MAX_IMAGE+65536)throw new Error('이미지는 8MB 이하로 업로드하세요.');
  const reader=request.body?.getReader();if(!reader)throw new Error('이미지를 선택하세요.');
  let size=0;const chunks=[];
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_IMAGE+65536){await reader.cancel();throw new Error('이미지는 8MB 이하로 업로드하세요.');}chunks.push(value);}
  const form=await new Response(new Blob(chunks),{headers:{'Content-Type':request.headers.get('Content-Type')||''}}).formData();
  const file=form.get('image');if(!file || typeof file.arrayBuffer!=='function' || file.size===0 || file.size>MAX_IMAGE)throw new Error('8MB 이하 이미지를 선택하세요.');
  const bytes=new Uint8Array(await file.arrayBuffer());let type,extension;
  if(bytes[0]===137 && bytes[1]===80 && bytes[2]===78 && bytes[3]===71){type='image/png';extension='png';}
  else if(bytes[0]===255 && bytes[1]===216 && bytes[2]===255){type='image/jpeg';extension='jpg';}
  else if(String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP'){type='image/webp';extension='webp';}
  else if(['GIF87a','GIF89a'].includes(String.fromCharCode(...bytes.slice(0,6)))){type='image/gif';extension='gif';}
  else throw new Error('PNG, JPG, WEBP, GIF 이미지만 지원합니다.');
  return {bytes,type,extension};
}
export async function recognize(image,env) {
  let binary='';for(let i=0;i<image.bytes.length;i+=8192)binary+=String.fromCharCode(...image.bytes.subarray(i,i+8192));
  const data=await google('https://vision.googleapis.com/v1/images:annotate',await accessToken(env),{method:'POST',headers:{'Content-Type':'application/json','x-goog-user-project':env.GCP_PROJECT_ID},body:JSON.stringify({requests:[{image:{content:btoa(binary)},features:[{type:'DOCUMENT_TEXT_DETECTION'}]}]})});
  const result=data.responses?.[0];if(result?.error)throw new Error('OCR: '+String(result.error.message).slice(0,1000));
  if(!result)throw new Error('OCR 응답이 비어 있습니다.');
  return {text:result.fullTextAnnotation?.text||result.textAnnotations?.[0]?.description||'',message:'OCR 처리 완료'};
}
export async function saveImage(image,env) {
  const key='uploads/'+crypto.randomUUID()+'.'+image.extension;
  await google(`https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(env.GCS_BUCKET)}/o?uploadType=media&name=${encodeURIComponent(key)}`,await accessToken(env),{method:'POST',headers:{'Content-Type':image.type},body:image.bytes});
  return {object:key,bucket:env.GCS_BUCKET,url:'/api/image?object='+encodeURIComponent(key),message:'이미지 버킷 저장 완료'};
}
export async function viewImage(request,env) {
  const key=new URL(request.url).searchParams.get('object')||'';
  if(!/^uploads\/[0-9a-f-]{36}\.(png|jpg|webp|gif)$/.test(key))return new Response('잘못된 이미지 경로',{status:400});
  const response=await fetch(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(env.GCS_BUCKET)}/o/${encodeURIComponent(key)}?alt=media`,{headers:{Authorization:'Bearer '+await accessToken(env)},signal:AbortSignal.timeout(25000)});
  if(!response.ok)return new Response('이미지를 불러올 수 없습니다.',{status:response.status===404?404:502});
  const type={png:'image/png',jpg:'image/jpeg',webp:'image/webp',gif:'image/gif'}[key.split('.').pop()];
  return new Response(response.body,{headers:{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'}});
}
export async function listImages(request,env){
  const pageToken=new URL(request.url).searchParams.get('pageToken');
  if(pageToken && pageToken.length>2048)throw new Error('잘못된 페이지 요청입니다.');
  const params=new URLSearchParams({prefix:'uploads/',maxResults:'24',fields:'items(name,size,updated,contentType),nextPageToken'});
  if(pageToken)params.set('pageToken',pageToken);
  const data=await google(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(env.GCS_BUCKET)}/o?${params}`,await accessToken(env));
  return {bucket:env.GCS_BUCKET,images:(data.items||[]).filter(item=>/^uploads\/[0-9a-f-]{36}\.(png|jpg|webp|gif)$/.test(item.name)).map(item=>({object:item.name,size:Number(item.size)||0,updated:item.updated,url:'/api/image?object='+encodeURIComponent(item.name)})),nextPageToken:data.nextPageToken||null};
}
