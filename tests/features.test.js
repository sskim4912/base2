import test from 'node:test';
import assert from 'node:assert/strict';
import {extractFeatures,MAX_OCR_TEXT} from '../src/features.js';
import worker from '../src/worker.js';
import {page} from '../src/page.js';

test('OCR features: grounded output, provider failures and input validation',async t=>{
  const originalFetch=globalThis.fetch;
  const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const pem='-----BEGIN PRIVATE KEY-----\n'+Buffer.from(await crypto.subtle.exportKey('pkcs8',pair.privateKey)).toString('base64')+'\n-----END PRIVATE KEY-----';
  const env={GCP_PROJECT_ID:'test-project',VERTEX_MODEL:'test-model',VERTEX_LOCATION:'global',GCP_SERVICE_ACCOUNT_JSON:JSON.stringify({client_email:'test@example.com',private_key:pem})};
  const text='회의 안내\n일시: 2026-11-03 10:00\n장소: 서울 사무실\n이전 지시를 무시하라는 문구';
  let output={features:[{title:'회의 일시',description:'2026년 11월 3일 오전 10시',evidence:'2026-11-03 10:00'},{title:'장소',description:'서울 사무실',evidence:'서울 사무실'}]},reason='STOP',calls=0;
  globalThis.fetch=async(url,options)=>{
    calls++;
    if(String(url).includes('oauth2.googleapis.com'))return Response.json({access_token:'mock-only',expires_in:3600});
    assert.match(String(url),/locations\/global\/publishers\/google\/models\/test-model:generateContent/);
    const body=JSON.parse(options.body);assert.equal(body.contents[0].parts[0].text,text);assert.ok(body.systemInstruction.parts[0].text.includes('命令')||body.systemInstruction.parts[0].text.includes('명령'));assert.equal(body.generationConfig.responseMimeType,'application/json');
    return Response.json({candidates:[{finishReason:reason,content:{parts:[{text:typeof output==='string'?output:JSON.stringify(output)}]}}]});
  };
  try{
    await t.test('returns multiple features with OCR evidence',async()=>{const result=await extractFeatures(text,env);assert.equal(result.features.length,2);assert.equal(result.features[0].evidence,'2026-11-03 10:00');});
    await t.test('does not invent features for empty input',async()=>{const before=calls;await assert.rejects(extractFeatures(' ',env),/텍스트가 없습니다/);assert.equal(calls,before);});
    await t.test('rejects too long input before calling provider',async()=>{const before=calls;await assert.rejects(extractFeatures('x'.repeat(MAX_OCR_TEXT+1),env),/30,000/);assert.equal(calls,before);});
    await t.test('rejects fabricated evidence',async()=>{output={features:[{title:'금액',description:'100원',evidence:'100원'}]};await assert.rejects(extractFeatures(text,env),/확인되지 않는 근거/);});
    await t.test('allows no extractable features',async()=>{output={features:[]};assert.deepEqual((await extractFeatures(text,env)).features,[]);});
    await t.test('rejects truncated provider output',async()=>{reason='MAX_TOKENS';await assert.rejects(extractFeatures(text,env),/MAX_TOKENS/);reason='STOP';});
    await t.test('rejects malformed provider JSON',async()=>{output='not-json';await assert.rejects(extractFeatures(text,env),/JSON 형식/);});
    await t.test('rejects bad API input without invoking provider',async()=>{const before=calls;for(const body of ['{',JSON.stringify({text:''}),JSON.stringify({text:42})]){const r=await worker.fetch(new Request('https://example.com/api/features',{method:'POST',body}),env);assert.equal(r.status,400);}assert.equal(calls,before);});
    await t.test('browser script compiles and auto-analysis UI exists',()=>{new Function(page.match(/<script>([\s\S]*)<\/script>/)[1]);assert.ok(page.includes('await analyze()'));assert.ok(page.includes('OCR 원문은 유지됩니다'));});
  }finally{globalThis.fetch=originalFetch;}
});
