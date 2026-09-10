# GYMNOTE

로그인 없이 날짜별 운동을 기록하는 모바일 PWA입니다. HTML, CSS, JavaScript와 브라우저의 IndexedDB만 사용합니다. 런타임 패키지, 서버, 유료 API가 없습니다.

## 기능

- 요구사항의 5개 부위, 14개 운동 선택
- 날짜별 세트 추가·삭제, 세트별 중량(kg)·반복 횟수 수정
- 각 세트의 `중량 × 반복 횟수`를 합산하여 하루 총 볼륨 계산
- 중량은 0~2,000 kg, 소수점 둘째 자리까지, 반복은 1~999회 정수
- 입력 즉시 기기에 자동 저장, 저장 실패 표시 및 재시도
- 월별 달력, 날짜별 기록과 볼륨 조회
- 기간별 JSON 백업, CSV 내보내기, JSON 복원
- OS 파일 공유를 통해 사용자가 Google Drive 등으로 저장. 지원하지 않으면 다운로드 후 업로드
- 홈 화면 설치, 최초 온라인 로딩 및 캐시 완료 후 오프라인 사용

빈 세트는 초안으로 보관하며 볼륨과 기록한 세트 수에 포함하지 않습니다. 0 kg의 유효한 세트는 세트 수에 포함되지만 볼륨은 0입니다. 원 암 덤벨 로우 등은 사용자가 입력한 무게와 총 반복만 계산하며 좌우 횟수를 임의로 두 배 하지 않습니다.

## 실행과 검증

Node.js 22 이상과 Python 3을 사용합니다. 의존성 설치는 필요 없습니다.

```sh
npm run dev
npm test
npm run check
```

로컬 주소: http://127.0.0.1:4173

## 무료 배포

`dist/` 전체를 HTTPS 정적 호스팅에 올리면 됩니다. 앱의 경로는 상대 경로이므로 루트 도메인과 `/gymnote-app/` 같은 하위 경로 모두 지원합니다.

GitHub Free의 공개 저장소에서는 GitHub Pages를 무료로 사용할 수 있습니다. [GitHub 공식 안내](https://docs.github.com/en/pages/getting-started-with-github-pages)

1. 코드를 자신의 공개 GitHub 저장소에 올립니다.
2. Settings → Pages → Source에서 GitHub Actions를 선택합니다.
3. 포함된 `Deploy GitHub Pages` 워크플로를 수동 실행합니다. 이 워크플로는 검증을 통과한 `dist/`만 배포합니다.

Sites 검토용 배포는 소유자 전용 접근 제어가 적용될 수 있습니다. 앱 자체에는 로그인이나 사용자 계정이 없지만, 검토용 URL의 플랫폼 로그인과 앱 로그인을 구분해야 합니다. 누구나 로그인 없이 사용하는 배포는 공개 HTTPS 호스팅으로 진행합니다.

## 모바일 설치와 클라우드 보관

- iPhone/iPad: Safari → 공유 → 홈 화면에 추가
- Android: Chrome 메뉴 → 앱 설치 또는 홈 화면에 추가
- 백업: 백업 탭 → 기간과 형식 선택 → 공유하여 저장 → 기기에 설치된 Drive 등 선택
- 공유 지원이 없거나 해당 앱이 공유 대상에 나타나지 않으면 다운로드 후 Drive에 직접 업로드합니다.
- JSON은 복원용, CSV는 Excel/Google Sheets에서 조회하는 용도입니다. JSON 복원 시 겹치는 날짜는 명시적 확인 후 덮어쓰고 다른 날짜는 유지합니다.

[PWA 설치](https://web.dev/learn/pwa/installation), [Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API)

## 데이터와 오프라인

운동 데이터는 현재 사이트 주소와 브라우저에 연결된 IndexedDB에 저장합니다. 서버로 전송하지 않습니다. URL/브라우저/기기/설치 앱이 달라지면 별도 저장 공간이므로 JSON으로 옮겨야 합니다. 브라우저 데이터 삭제, 비공개 모드 종료, 저장 공간 정리 등으로 기록을 잃을 수 있습니다. 영구 저장을 요청하지만 허용 여부는 브라우저가 결정하므로 주기적인 백업이 필요합니다. 클라우드 자동 동기화는 없습니다.

앱 업데이트 시 `dist/sw.js`의 `CACHE` 이름을 변경해야 합니다. 기존 앱 창을 모두 닫고 다시 열면 대기 중인 새 버전이 활성화됩니다. 서비스 워커는 앱 정적 파일만 캐시하며 IndexedDB 기록은 업데이트 시 삭제하지 않습니다.

## 검증 범위

계산, 날짜 경계, JSON 왕복, 잘못된 백업, CSV 내용을 Node 테스트로 검증합니다. HTML 파일 참조, JavaScript 문법, PNG 크기와 서비스 워커 캐시 목록도 검사합니다. 실제 iOS/Android 설치, OS 공유 대상, 브라우저 오프라인·IndexedDB 동작과 시각적 QA는 기기에서 추가 확인해야 합니다. 선택적 WebMCP는 미지원 브라우저에서 자동으로 생략합니다.

## 구성

- `dist/app.js`: 한국어 UI, 자동 저장, 파일 공유/복원
- `dist/model.js`: 운동 목록, 볼륨, 날짜, 데이터 검증과 내보내기
- `dist/storage.js`: IndexedDB 트랜잭션
- `dist/sw.js`, `dist/manifest.webmanifest`: 오프라인 및 설치
- `dist/webmcp.js`: 지원 브라우저의 선택적 도구 인터페이스

MIT License.
