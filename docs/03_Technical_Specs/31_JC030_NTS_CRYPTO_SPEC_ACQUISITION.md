# Archived Research — JC-030 NTS fcrypt 암호화 파일
> Created: 2026-07-07 01:45 KST
> Last Updated: 2026-07-10 16:01 KST

## 0. Flow Status

```text
[Flow]
현재: 연구 기록 보존 — Path 3 암호화 파일은 현재 제품 범위 밖
Gate: closed for implementation (사용자 결정 2026-07-10)
완료: 공식 입수 경로(홈택스 자료실 41·550) · fcrypt API 시그니처 · DLL 샘플(NTS nttSn=84076)
다음: 없음 — 별도 제품 범위 재승인 전에는 다운로드·PoC·구현을 재개하지 않음
```

라벨 — **[확실]** 공식 게시·DLL export 확인 · **[추정]** SemuAgent 미실측 항목 · **[미확인]** 라운드트립·적합성 검정

## 1. Purpose

이 문서는 과거에 검토했던 fcrypt 암호화 경로의 공식 자료와 기술 제약을
보존하는 **역사 기록**이다. 현재 JC-030 Path 1은 공식 비암호화 업로드 양식만
지원하며, 암호화 파일 생성은 제품 범위에서 제외한다.

본 문서는 구현 계약이나 활성 백로그가 아니다.

아래 입수 절차, 기술 사양, 구현 옵션과 체크리스트는 2026-07-07 당시의 조사
기록이다. 현재 작업 순서나 후속 구현 지시로 해석하지 않는다.

**중요:** 암호화 스펙은 `간이지급명세서(근로소득) 전산매체 제출요령` HWP에 **포함되지 않는다**.
레이아웃(HWP, Slice 1a)과 암호화(본 문서, Slice 2b)는 **세목 공통** 별도 규격이다.

## 2. Critical Distinction — 세 가지 이름

| 이름 | 정체 | SemuAgent 역할 |
|---|---|---|
| **fcrypt / 세무자료 암호화 API** | 국세청이 회계·급여 SW 제작사에 배포하는 **암호화 생성** 모듈 | **현재 구현 대상 아님** |
| **NTS-CRYPTO(-NX)** | 홈택스 브라우저 **복호화·형식검증** 클라이언트 모듈 ([통합설치](https://www.hometax.go.kr/html/pp/veraport/html/nx_veraportView.html)) | 구현 대상 **아님** — 사용자 PC에 설치 |
| **과거 Brief의 "NTS-CRYPTO 래퍼"** | 과거 제품 내부 명칭 | 폐기된 구현 가설 |

**판정:** TypeScript로 암호 알고리즘을 **순수 재구현하지 않는다**. 국세청 배포 모듈을 호출한다.

## 3. Historical Acquisition Record (Resolved)

### 3.1 1순위 — 홈택스 자료실

- URL: https://www.hometax.go.kr/ → **고객센터** → **자료실**
- 검색 키워드: `변환방식 전자신고 파일의 암호화`, `세무자료 암호화`, `550`

| 게시 | 제목 | 첨부(핵심) |
|---|---|---|
| **550** | `변환방식 전자신고 파일의 암호화 조치 안내(2018.11.14.부터 적용)` | 첨부1 전환 프로그램 · **첨부2 암호화 적용 API** · 첨부3 뷰어 |
| **41** | `[전자신고] 변환방식 전자신고파일의 보안강화 조치(2012.1월부터 적용)` | 동일 계열 원문 + 2018-04-27 **64bit·Java** 추가 안내 |

550번 첨부2 ZIP 내부(실무·블로그 기준, SemuAgent 미전체 해제) [확실·2차]:

```text
singo_encryption_api/_bin/enconly_stdcall/fcrypt_es.dll
singo_encryption_api/_bin/enconly_stdcall/MagicCrypto.dll
```

41번 글 덧붙임(2018-04-27) [확실·2차]:

| 첨부 | 내용 |
|---|---|
| `fcrypt_64bit.zip` | 64bit용 API |
| `fcrypt_java.zip` | **Java 암호화 모듈 + 가이드** |

### 3.2 2순위 — 국세청 프로그램 게시판 (DLL 샘플)

- 목록: https://www.nts.go.kr/nts/na/ntt/selectNttList.do?bbsId=1099&mi=2544
- 확인 게시: `2014년 귀속 일용근로소득 지급명세서 입력 프로그램` — nttSn **84076**
- 첨부 `일용입력프로그램.zip`에 `fcrypt_es.dll`, `MagicCrypto.dll` 포함 [확실, 2026-07-07 다운로드·DLL export 확인]
- fileKey(일용입력프로그램.zip): `d214c46b86c01a092266992a578016a9`

### 3.3 3순위 — 2차 실무 자료

- [구영민: Linux Python + fcrypt_es.dll](https://youngminz.netlify.app/posts/using-windows-dll-in-python-on-linux/) — `DSFC_EncryptFile` 호출 예시 [확실·실측 블로그]
- 네이버 블로그 미러: [홈택스 세무자료 암호화 안내](https://m.blog.naver.com/airwindtree/221982849735) — 550·41번 첨부 목록 [확실·2차]

### 3.4 입수하지 않는 경로

- 간이지급 HWP만으로 암호화 알고리즘 추론
- 전자세금계산서 CMS(3DES EnvelopedData) 스펙 — **다른 채널** ([별도 스펙](https://colinder.github.io/etax_process_02/))
- 민간 ERP `fcrypt_es(…).exe` 단독 — 국세청 원본 ZIP·Java 가이드보다 **2순위**
- **자동 다운로드·봇 우회** — 홈택스/국세청 첨부는 CAPTCHA·봇 탐지가 있어 프로그램 자동 수집 **금지** [확실, 2026-07-07 운영 원칙]

### 3.5 과거 수동 입수 절차 (미실행·보존)

국세청·홈택스 규격 첨부는 **사람이 브라우저로** 다운로드한다.

| 단계 | 담당 | 작업 |
|---|---|---|
| 1 | 사용자/팀 | 홈택스 자료실 **550번** 또는 **41번** 덧붙임에서 `첨부2_세무자료 암호화 적용 API.zip`, `fcrypt_java.zip` 수동 다운로드 |
| 2 | 사용자/팀 | `scratch/jc-030-reference/nts-crypto/`에 배치 (gitignore) |
| 3 | 개발 | ZIP 내용·API 가이드·`strings` 검증, 문서 갱신, PoC |

**금지:** CAPTCHA·봇 탐지 우회, 무인 스크래핑으로 첨부 수집. (이전 자동 다운로드 시도는 차단됨 — 동일 정책 유지)

**이미 입수(NTS 게시판 nttSn=84076):** `fcrypt_es.dll`, `MagicCrypto.dll` — `extracted/flat/` [확실]

## 4. Technical Specification (Pre-Implementation)

### 4.1 정책·운영 요건

| 항목 | 내용 | 근거 |
|---|---|---|
| 암호화 의무 | 변환방식 전자신고 파일은 **암호화 후** 제출 | 2012.1~ 보안강화, 2018.11.14~ 미암호화 제출 불가 [확실] |
| 적용 범위 | **모든 세목** 공통 (부가세·원천·지급명세·간이지급 포함) | JC-023 §2.1, 세무사회 보도 [확실] |
| 비밀번호 | **8자리 이상** (Brief: **8~15자리**) | 실무 안내·Layout Acquisition §4 [확실] |
| 홈택스 비밀번호 | 전자신고 암호와 **별개** | 실무 SW 매뉴얼 다수 [확실] |
| Plain 파일 | 내용 검토용; **제출에는 사용 불가** | 실무 안내 [확실] |

### 4.2 암호화 API (fcrypt_es.dll)

**확인된 export (NTS 84076 DLL, 2026-07-07 `strings` 분석):**

| 심볼 | 용도 |
|---|---|
| `DSFC_EncryptFile` | 파일 암호화 (Slice 2b 핵심) |
| `MC_EncryptInit` / `MC_EncryptUpdate` / `MC_EncryptFinal` | MagicCrypto 내부 블록 암호 호출 |

**호출 시그니처 (블로그 실측 + stdcall DLL) [확실·2차]:**

```c
// stdcall — windll.LoadLibrary
int DSFC_EncryptFile(
  HWND   hwnd,        // 0
  char*  srcPath,     // plain 파일 경로
  char*  dstPath,     // 암호화 출력 경로
  char*  password,    // 8자리 이상
  UINT   mode         // 실측 예: 1
);
// 반환 0 = 성공
```

**의존 DLL:** `MagicCrypto.dll` (Dream Security 검증필 암호모듈, KCMVP) [확실]

**바이너리 포맷:** proprietary — DLL 내부 구현. 공개 문서에 AES/SEED 등 알고리즘 상세는 **미확인**.
ZIP 첨부2·`fcrypt_java.zip` 가이드에 추가 함수·에러코드가 있을 수 있음 → **550번 수동 다운로드 후 보완**.

### 4.3 파일명 관례 (간이지급 SC)

| 단계 | 예시 | 근거 |
|---|---|---|
| Plain 레코드 | `SC1234567.890` | [Field Mapping §2](./29_JC030_SIMPLIFIED_WAGE_EFILING_FIELD_MAPPING.md), HWP §1 [확실] |
| 암호화 후 | `enc.SC1234567.890` / `ENC_…` / `enc.…` | SW·세목마다 상이 [추정] |

간이지급 HWP는 **암호화 후 파일명 규칙을 명시하지 않음**. 라운드트립 시 홈택스 검증 화면에서 확인.

### 4.4 홈택스 제출 관문 (복호화 측)

1. 변환 파일제출 → 간이지급명세서(근로소득) 선택
2. 암호화 파일 업로드
3. **파일형식검증** — 암호 입력 팝업(NTS-CRYPTO) → 형식·내용 검증 → 제출

[Layout Acquisition §4](./28_JC030_SIMPLIFIED_WAGE_EFILING_LAYOUT_ACQUISITION.md)와 동일. 암호는 Slice 2b 생성 시 사용자가 설정한 값과 **동일**해야 한다.

## 5. Archived Implementation Options

| 옵션 | 설명 | 판정 |
|---|---|---|
| **A. fcrypt_java** | 국세청 Java 모듈을 JVM sidecar에서 호출 | **미검증** — ZIP·가이드 수동 입수 전; Linux 친화 |
| **E. Windows VM microservice** | AWS/Azure 등 **윈도우 VM**에 작은 HTTP 서비스 배포 → `fcrypt_es.dll` 네이티브 호출 | **2b 1순위 후보** — DLL 실측 export 확인됨; SemuAgent(Vercel)는 그대로 |
| **B. fcrypt_es.dll + Wine** | Wine으로 DLL 래핑 | PoC·로컬 검증용만; 프로덕션 **비권장** |
| **C. 순수 TS 재구현** | 바이너리 포맷 역공학 | **금지** |
| **D. 사용자 수동 암호화** | plain + 홈택스 전환 프로그램 안내 | 제출 가능성은 별도 암호화 도구와 홈택스 검증 결과에 의존 |

**Vercel Functions 제약:** `fcrypt_es.dll`은 Windows 네이티브 + MagicCrypto 의존 → **엣지/Node 단독 배포 불가**.

**폐기된 아키텍처 가설 (2026-07-07 기록):**

```text
SemuAgent (Vercel, Next.js) — 변경 없음
      │  POST plain bytes + password (일회성, 비저장)
      ▼
[별도 트랙: 윈도우 암호화 microservice]  ← 신규 소형 프로그램 (미구현)
      │  DSFC_EncryptFile (fcrypt_es.dll)
      ▼
  encrypted bytes → SemuAgent → 사용자 다운로드
```

- SemuAgent **전체를 윈도우로 이전할 필요 없음** — 암호화만 외부 서비스.
- microservice 구현은 현재 제품 범위에서 폐기됐다. 아래 구조는 당시 검토 기록일 뿐이다.
- 과거 착수 가설(미실행): Windows DLL 검증 → microservice 설계 → `encrypt.ts` 클라이언트.

**트레이드오프:** Java(A)는 운영비 낮을 수 있으나 **미입수·미검증**. Windows VM(E)는 라이선스·VM 비용이 더 들 수 있으나 **이미 확보한 DLL**과 일치. 비용은 AWS/Azure 견적 후 결정 [미확인].

## 6. Historical Slice 2b Preconditions (활성 백로그 아님)

- [x] 공식 입수 경로 — 홈택스 자료실 41·550, NTS 게시판 84076
- [x] API 핵심 함수 — `DSFC_EncryptFile` (DLL export 확인)
- [x] 비밀번호 규칙 — 8~15자리 (Brief·실무 정합)
- [x] NTS-CRYPTO vs fcrypt 역할 분리 문서화
- [ ] **550번 첨부2·fcrypt_java.zip** 로컬 보관 — PoC 스크립트: `scratch/jc-030-reference/nts-crypto/poc/`
- [x] **plain fixture** 생성 — `generate-plain-sample.mjs` → `SC1234567890` 574 bytes (2026-07-07)
- [ ] **라운드트립** — Windows 환경에서 plain `SC…` → `DSFC_EncryptFile` → 홈택스 형식검증 [미확인]
- [ ] **적합성 검정** — 비인증 SW 파일 수용 여부 (JC-023 §2.5) [미확인]
- [x] **제품 범위 분리** — JC-030은 비암호화 Path 1 세목 확대, 과거 2b Windows microservice는 현재 제품 범위 밖 (§5, §10)

## 7. Closed Implementation Gate

- 현재 제품 범위에서는 2b 코드를 착수하지 않는다.
- `encrypt.ts`, Windows microservice, DLL 호출과 암호 입력 UI를 만들지 않는다.
- 별도 제품 범위가 명시적으로 재승인될 때만 이 역사 기록을 다시 검토한다.

## 8. Local Reference (gitignored)

`scratch/jc-030-reference/nts-crypto/` — [README](../../scratch/jc-030-reference/nts-crypto/README.md)

| 파일 | 출처 | 상태 |
|---|---|---|
| `ilryong-input-program.zip` | NTS nttSn=84076 | 2026-07-07 다운로드 |
| `extracted/flat/fcrypt_es.dll` | 위 ZIP | export `DSFC_EncryptFile` 확인 |
| `extracted/flat/MagicCrypto.dll` | 위 ZIP | 의존 모듈 |
| `첨부2_세무자료 암호화 적용 API.zip` | 홈택스 550 | **미입수** — 자료실 수동 다운로드 ([PoC README](../../scratch/jc-030-reference/nts-crypto/poc/README.md)) |
| `fcrypt_java.zip` | 홈택스 41 덧붙임 | **미입수** |
| `poc/output/SC1234567890` | `generate-plain-sample.mjs` | 2026-07-07 plain fixture (테스트 데이터) |

## 10. Track Split — JC-030 v1 vs Slice 2b (2026-07-07)

| 트랙 | 범위 | 상태 |
|---|---|---|
| **JC-030 Path 1** | 공식 비암호화 업로드 양식 생성·사전검증·다운로드·홈택스 안내 | 활성 제품 경로 |
| **과거 Slice 2b** | fcrypt 암호화·암호화 파일 다운로드·윈도우 microservice | **제품 범위 밖** |

활성 Path 1은 홈택스가 직접 수용한다고 확인된 **공식 비암호화 파일**만
구현한다. 암호화 전 plain 후보를 업로드 가능 파일처럼 표시하지 않으며,
fcrypt·적합성 검정은 완료선에 포함하지 않는다.

## 11. Related Documents

- [Pre-Code Brief §4.2 · §7](./30_JC030_EFILING_FILE_PRE_CODE_BRIEF.md)
- [Layout Acquisition §4·§5](./28_JC030_SIMPLIFIED_WAGE_EFILING_LAYOUT_ACQUISITION.md)
- [Field Mapping](./29_JC030_SIMPLIFIED_WAGE_EFILING_FIELD_MAPPING.md)
- [JC-023 Research §2.1·§2.5](./13_JC023_HOMETAX_AUTOSUBMIT_RESEARCH.md)
- [PII Policy](./27_JC030_EFILING_FILE_PII_POLICY.md)
- [Completion Contract §3 / JC-030](./22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md)
- [Backlog JC-030](../04_Logic_Progress/00_BACKLOG.md)
