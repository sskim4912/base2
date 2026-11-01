# GCP 이미지 작업실

Cloudflare Worker에서 이미지를 미리 보고 Cloud Vision OCR을 실행하거나 GCP Cloud Storage 버킷에 저장합니다. 저장한 이미지는 **저장된 이미지 보기** 버튼으로 목록과 미리보기를 조회하고, Worker의 이미지 뷰어로 다시 열 수 있습니다. 이미지 확대·축소·회전·전체 화면과 OCR 텍스트 복사를 지원합니다. OCR 완료 후 Vertex AI가 원문에서 중요한 특징을 최대 5개 추출하고 각 항목에 OCR 근거를 함께 표시합니다. 특징 분석이 실패해도 OCR 원문은 유지되며 다시 분석할 수 있습니다.

배포 주소: https://api-for-anythingllm-check.sskim4912.workers.dev

## 다른 프로젝트의 토대로 복제하기

**처음 배포하기 전에 [복제 설정 안내](SETUP.md)를 확인하세요.** 변경할 값·현재 값·입력 위치를 표로 정리했습니다. 특히 Worker `name`을 바꾸고 새 Worker에 `GCP_SERVICE_ACCOUNT_JSON` Secret을 따로 등록해야 합니다. 배포 후 `/setup` 페이지에서도 설정 안내를 볼 수 있습니다.

## 개발 및 배포

Node.js 24에서 실행합니다.

```sh
npm ci
npm run dev
npm test
npm run build
npm run deploy
```

배포에는 Cloudflare 인증이 필요합니다. CI에서는 `CLOUDFLARE_API_TOKEN`을 보안 변수로 제공하세요. `CLOUDFLARE_ACCOUNT_ID`를 설정한다면 `wrangler.jsonc`의 계정 ID와 일치해야 합니다.

Cloudflare Worker의 Secret `GCP_SERVICE_ACCOUNT_JSON`에 서비스 계정 JSON 전체를 등록합니다. 로컬 개발 시에는 Git에서 제외된 `.dev.vars`를 사용하고 JSON 문자열 안의 줄바꿈을 이스케이프합니다. 인증 정보를 저장소에 커밋하지 마세요.

GCP 프로젝트·버킷·Vertex 모델·리전은 `wrangler.jsonc`에 설정합니다. 서비스 계정에는 Vertex AI 호출, Cloud Vision OCR 호출, 해당 버킷 객체 생성·조회·삭제 권한이 필요합니다. 관련 GCP API도 활성화되어 있어야 합니다.

## API

- `GET /api/status`: 설정 조회
- `POST /api/ocr`: multipart 필드 `image`의 이미지 OCR
- `POST /api/features`: JSON `{ "text": "OCR 원문" }`으로 중요한 특징 추출 (1~30,000자)
- `POST /api/upload`: multipart 필드 `image`를 기존 GCP 버킷의 `uploads/UUID.ext`에 저장
- `GET /api/images`: 저장 이미지 목록 (24개씩, `pageToken`으로 다음 페이지)
- `GET /api/image?object=uploads/UUID.ext`: 저장된 이미지를 스트리밍
- `POST /api/check/vertex`, `/api/check/ocr`, `/api/check/storage`: 연결 진단

PNG·JPEG·WEBP·GIF, 최대 8MB를 지원합니다. OCR과 이미지 저장은 독립적인 작업이며 업로드 이미지는 자동 삭제하지 않습니다. Storage 연결 진단용 JSON만 저장·읽기 후 삭제합니다. R2는 사용하지 않습니다.

사용자 요청에 따라 호출 확인 키와 인증 단계가 없습니다. 저장 이미지 URL을 알면 조회할 수 있습니다. Google 서비스 계정 개인 키와 OAuth 토큰은 서버에서만 사용합니다. 외부 API 호출과 저장은 GCP 사용량에 포함됩니다.

## 검증

배포된 Worker에서 Vertex AI의 `OK` 응답, 테스트 이미지의 `HELLO 123` OCR, GCP 버킷 JSON 저장·읽기·삭제, 이미지 업로드 후 바이트 단위 재조회 일치를 확인했습니다. 로컬에서 이미지 형식·크기·경로 검증과 브라우저 스크립트 구문도 검사했습니다.

특징 분석은 OCR 텍스트만 사용하며 이미지 외형을 추정하지 않습니다. 원문에서 확인할 수 없는 인용 근거는 오류로 처리합니다. OCR 인식 오류나 AI 해석 오류가 있을 수 있으므로 표시된 원문 근거를 함께 확인하세요.
