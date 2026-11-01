# 복제해서 새 프로젝트 시작하기

복제한 코드를 **처음 배포하기 전에** 아래 값을 수정하세요. GitHub 저장소 이름만 바꾸면 GCP와 Cloudflare 설정은 기존 프로젝트를 계속 가리킵니다.

## 1. 수정할 값 한눈에 보기

| 위치 | 설정 | 현재 값 | 새 프로젝트에서 할 일 |
| --- | --- | --- | --- |
| `wrangler.jsonc` | `name` | `api-for-anythingllm-check` | **변경 필수.** 새 Worker 이름으로 변경합니다. 같은 계정에서 이름이 같으면 기존 Worker를 업데이트합니다. |
| `wrangler.jsonc` | `account_id` | `fce63723d5997d0f4c2b904404cf0592` | 배포할 Cloudflare 계정 ID로 변경합니다. 같은 계정이면 유지합니다. 이메일 주소가 아닙니다. |
| `wrangler.jsonc` → `vars` | `GCP_PROJECT_ID` | `api-for-anythingllm-1` | 새 GCP 프로젝트 **ID**를 입력합니다. 기존 프로젝트를 재사용하면 유지합니다. |
| `wrangler.jsonc` → `vars` | `GCS_BUCKET` | `bucket_2611__1` | 이미지가 저장될 기존/신규 버킷 이름입니다. `gs://`는 붙이지 않습니다. 프로젝트별 저장을 분리하려면 별도 버킷을 사용합니다. |
| `wrangler.jsonc` → `vars` | `VERTEX_MODEL` | `gemini-3.8-flash` | 사용할 모델 ID입니다. 모델을 그대로 사용하면 유지합니다. |
| `wrangler.jsonc` → `vars` | `VERTEX_LOCATION` | `global` | 모델이 지원하는 리전으로 지정합니다. 그대로 지원하면 유지합니다. |
| 새 Worker의 Secret | `GCP_SERVICE_ACCOUNT_JSON` | Cloudflare에만 보관 | **새 Worker에 별도 등록 필수.** 서비스 계정 JSON 전체를 Secret으로 넣습니다. GitHub 복제로 Secret이 복사되지 않습니다. |
| 개발 환경 / CI 보안 설정 | `CLOUDFLARE_API_TOKEN` | 저장소에 없음 | 새 Worker를 배포할 계정에 권한이 있는 토큰을 등록합니다. 같은 계정·권한이면 재사용할 수 있습니다. |
| 개발 환경 / CI 환경변수 | `CLOUDFLARE_ACCOUNT_ID` | 실행 환경마다 다름 | 설정되어 있다면 위 `account_id`와 일치시킵니다. 기존 환경의 이메일·다른 계정 값이 남아 있지 않은지 확인합니다. |
| `package.json` 및 `package-lock.json` | `name` | `gcp-image-workbench` | 선택 사항. 앱 구분용 이름입니다. 변경 후 `npm install --package-lock-only`로 lockfile도 갱신합니다. |
| `README.md` 및 웹 화면 | 제목·설명·배포 주소 | 원본 프로젝트 정보 | 새 프로젝트에 맞춰 변경합니다. 화면은 `src/page.js`에 있습니다. |

`main`, `compatibility_date`, `workers_dev`, Secret **변수명**은 단순 복제만으로 바꿀 필요가 없습니다. 날짜는 런타임 호환성을 검토할 때 변경합니다. R2, 호출 확인 키, 별도 GCP API 키는 필요하지 않습니다.

## 2. GCP 준비

- 새 프로젝트를 사용한다면 결제 연결과 **Vertex AI API**, **Cloud Vision API**, **Cloud Storage JSON API** 활성화를 확인합니다.
- 새 버킷은 GCP에서 먼저 생성합니다. `GCS_BUCKET`에 이름을 적는 것만으로 생성되지 않습니다.
- 서비스 계정에 Vertex AI 호출과 Cloud Vision 호출 권한을 부여합니다. 사용자 프로젝트로 비용을 지정하는 OCR 호출에는 Service Usage Consumer 권한이 필요할 수 있습니다.
- 해당 버킷에만 객체 생성·조회·삭제 권한을 부여합니다. 버킷은 공개로 만들 필요가 없습니다. 이미지는 Worker가 읽어 전달합니다.
- 다른 프로젝트의 서비스 계정·버킷을 재사용하면 해당 리소스에 대한 권한도 확인합니다.

## 3. 설치 → 첫 배포 → Secret 등록

Node.js 24와 Cloudflare 인증을 준비합니다. 계정 ID는 공개 식별자이고 API 토큰·서비스 계정 개인 키는 비밀 값입니다.

```sh
npm ci
npm run build
npm run deploy
```

첫 배포로 **새 이름의 Worker**를 만든 다음 Cloudflare → Workers & Pages → 새 Worker → Settings → Variables and Secrets → Add에서 다음을 등록합니다.

- 유형: **Secret**
- 이름: **`GCP_SERVICE_ACCOUNT_JSON`**
- 값: 올바른 서비스 계정 JSON 전체 (`{`부터 `}`까지)
- 저장 후 **Deploy**로 적용

CLI를 사용하는 경우에도 값을 명령줄에 쓰지 않고 입력 프롬프트로 등록할 수 있습니다.

```sh
npx wrangler secret put GCP_SERVICE_ACCOUNT_JSON
```

GitHub 저장소를 연결하는 자동 배포도 새 Worker에 별도로 설정해야 합니다. 이 저장소에는 GitHub Actions 배포 워크플로가 없습니다. 커밋·푸시만으로 자동 배포된다고 가정하지 마세요.

## 4. 동작 확인

배포 명령이 출력한 **새 Worker 주소**를 엽니다. `/setup` 페이지에서 현재 GCP 설정과 Secret 등록 여부를 확인할 수 있습니다. Secret 등록 표시 자체는 인증 성공을 뜻하지 않습니다.

- Vertex AI 연결 확인에서 응답을 받는지 확인합니다.
- 이미지를 선택해 OCR을 실행하고 실제 문자가 인식되는지 확인합니다. 이어서 Vertex AI가 중요한 특징과 원문 근거를 자동 표시하는지 확인합니다. 분석 실패 시 OCR 원문을 유지한 채 다시 분석할 수 있습니다.
- 버킷에 이미지를 저장하고, 저장된 이미지를 뷰어에서 다시 엽니다.
- **저장된 이미지 보기** 버튼으로 목록을 불러와 저장 이미지를 뷰어에서 엽니다. 목록 조회에는 해당 버킷의 객체 목록 조회 권한(`storage.objects.list`)도 필요합니다.
- GCP 버킷의 `uploads/` 경로에 이미지가 저장됐는지 확인합니다. 업로드 이미지는 자동 삭제하지 않습니다.

호출 확인 키와 사용자 인증 단계는 없습니다. 이미지 URL을 알면 볼 수 있고 API 호출은 사용량에 포함됩니다. 기존 버킷을 재사용하면 새 앱도 같은 버킷의 `uploads/` 경로를 사용합니다.

## 로컬 개발

`.dev.vars.example`을 `.dev.vars`로 복사하고 로컬에서 사용할 서비스 계정 JSON을 직접 입력한 뒤 `npm run dev`를 실행합니다. 실제 GCP API·버킷을 호출하므로 로컬 실행도 리소스를 사용합니다. `.dev.vars`는 Git에서 제외됩니다. Cloudflare에 등록한 Secret은 GitHub나 로컬로 자동 복사되지 않습니다.
