import {accessToken,google} from './google.js';
import {ocrImage} from './fixture.js';
export async function check(service,env) {
  const token=await accessToken(env);
  if(service==='vertex') {
    const location=env.VERTEX_LOCATION;const host=location==='global'?'aiplatform.googleapis.com':location+'-aiplatform.googleapis.com';
    const url=`https://${host}/v1/projects/${encodeURIComponent(env.GCP_PROJECT_ID)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(env.VERTEX_MODEL)}:generateContent`;
    const data=await google(url,token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:'Reply with exactly OK.'}]}],generationConfig:{maxOutputTokens:1024,temperature:0}})});
    const text=data.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim();if(!text)throw new Error('Vertex AI 텍스트 없음: '+JSON.stringify({finishReason:data.candidates?.[0]?.finishReason,promptFeedback:data.promptFeedback,usage:data.usageMetadata}).slice(0,1000));
    return {message:'모델 응답 수신',response:text.slice(0,500),usage:data.usageMetadata};
  }
  if(service==='ocr') {
    const data=await google('https://vision.googleapis.com/v1/images:annotate',token,{method:'POST',headers:{'Content-Type':'application/json','x-goog-user-project':env.GCP_PROJECT_ID},body:JSON.stringify({requests:[{image:{content:ocrImage},features:[{type:'TEXT_DETECTION'}]}]})});
    const result=data.responses?.[0];if(result?.error)throw new Error('OCR: '+String(result.error.message).slice(0,1000));
    const text=result?.fullTextAnnotation?.text||result?.textAnnotations?.[0]?.description||'';if(!text.includes('HELLO')||!text.includes('123'))throw new Error('OCR이 테스트 이미지의 HELLO 123을 인식하지 못했습니다.');return {message:'테스트 이미지 문자 인식 성공',response:text};
  }
  if(service==='storage') {
    const key='diagnostics/'+crypto.randomUUID()+'.json';const bucket=encodeURIComponent(env.GCS_BUCKET);const value={check:'gcs',id:crypto.randomUUID()};let written=false;
    try {
      await google(`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(key)}`,token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});written=true;
      const read=await google(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(key)}?alt=media`,token);if(read.id!==value.id)throw new Error('Storage 읽기 결과 불일치');
    } finally {if(written)try{await google(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(key)}`,token,{method:'DELETE'});}catch{throw new Error('Storage 테스트 객체 삭제 실패: '+key+' (버킷에서 수동 정리 필요)');}}
    return {message:'GCP 버킷 테스트 JSON 저장·읽기·삭제 성공'};
  }
  throw new Error('지원하지 않는 서비스');
}
