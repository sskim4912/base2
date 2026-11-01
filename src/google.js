let cached;
const encode = value => btoa(String.fromCharCode(...new TextEncoder().encode(value))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
export async function accessToken(env) {
  if (!env.GCP_SERVICE_ACCOUNT_JSON) throw new Error('GCP_SERVICE_ACCOUNT_JSON Secret을 등록하세요.');
  if(cached && cached.source===env.GCP_SERVICE_ACCOUNT_JSON && cached.until>Date.now()+60000)return cached.token;
  let account;
  try {account=JSON.parse(env.GCP_SERVICE_ACCOUNT_JSON);}catch {throw new Error('서비스 계정 Secret이 올바른 JSON이 아닙니다.');}
  if(!account.client_email || !account.private_key)throw new Error('서비스 계정 JSON에 client_email 또는 private_key가 없습니다.');
  const now=Math.floor(Date.now()/1000);
  const unsigned=encode(JSON.stringify({alg:'RS256',typ:'JWT'}))+'.'+encode(JSON.stringify({iss:account.client_email,scope:'https://www.googleapis.com/auth/cloud-platform',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
  let key;
  try {const pem=account.private_key.replace(/-----[^-]+-----/g,'').replace(/\s/g,'');key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);}catch {throw new Error('서비스 계정 개인 키 형식이 올바르지 않습니다.');}
  const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned));
  const jwt=unsigned+'.'+btoa(String.fromCharCode(...new Uint8Array(signature))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt}),signal:AbortSignal.timeout(20000)});
  const data=await response.json();
  if(!response.ok || !data.access_token)throw new Error('Google OAuth 인증 실패 ('+response.status+'): '+String(data.error_description||data.error||'unknown').slice(0,600));
  cached={source:env.GCP_SERVICE_ACCOUNT_JSON,token:data.access_token,until:Date.now()+data.expires_in*1000};return cached.token;
}
export async function google(url,token,options={}) {
  const response=await fetch(url,{...options,headers:{Authorization:'Bearer '+token,...options.headers},signal:AbortSignal.timeout(25000)});
  const text=await response.text();let data;try{data=JSON.parse(text);}catch{data={};}
  if(!response.ok)throw new Error('Google API HTTP '+response.status+': '+String(data.error?.message||response.statusText).slice(0,1200));
  return data;
}
