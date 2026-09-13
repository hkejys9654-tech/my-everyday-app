# Everyday Checkup iPhone 첫 버전

기존 index.html을 WKWebView 안에서 실행하고 Apple HealthKit의 최근 30일 운동을 읽습니다. 기본 Apple Watch 운동 앱으로 기록한 운동을 가져올 수 있으며, 별도 Watch 앱은 필요하지 않습니다. 가져올 날짜와 운동을 선택하고 기존 ‘기록 저장하기’를 누르면 건강 운동 요약도 함께 보관됩니다.

## 구현 범위

- 건강 데이터 읽기 권한 요청. 건강 앱에 쓰거나 원본 운동을 삭제하지 않음.
- 운동 종류, 시작/종료 시각, 운동 시간, 지원되는 거리·활동 칼로리·평균/최대 심박수.
- 값이 없는 지표는 표시하지 않음. 접근 거부와 실제 기록 없음은 HealthKit 정책상 구별하지 않음.
- 날짜별 선택, 운동 UUID 중복 방지, 선택 해제, 기록 목록 표시와 기존 JSON 백업/복구에 포함.
- 수동 가져오기. 백그라운드 자동 동기화와 Watch 세트/무게 입력은 후속 범위.

## Mac에서 실행

1. Mac에 Xcode와 XcodeGen을 설치합니다. XcodeGen은 https://github.com/yonaskolb/XcodeGen 의 설치 안내를 따릅니다.
2. 이 저장소를 내려받고 터미널에서 `cd ios` 후 `xcodegen generate`를 실행합니다.
3. 생성된 `EverydayCheckup.xcodeproj`를 Xcode로 엽니다.
4. Signing & Capabilities에서 자신의 개발 팀을 선택하고 Bundle Identifier를 고유한 값으로 변경합니다. HealthKit 기능과 프로비저닝이 활성화된 팀이 필요합니다.
5. 연결된 iPhone을 실행 대상으로 선택하고 Run합니다.
6. 앱에서 운동 가져오기를 누르고 필요한 건강 읽기 항목을 허용합니다.

생성 프로젝트에는 저장소 루트의 index.html이 번들 리소스로 들어갑니다. 웹 파일을 바꾼 뒤 앱을 다시 빌드하면 반영됩니다. 코드 변경 확인용 빌드는 `xcodebuild -project EverydayCheckup.xcodeproj -scheme EverydayCheckup -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO build`로 실행할 수 있습니다.

## 기존 기록 이전

Safari와 새 앱은 저장 공간이 다릅니다. Safari의 기존 사이트에서 데이터 내보내기로 JSON을 복사하고 새 앱의 데이터 가져오기에 붙여 넣으세요. 자동 이전되거나 두 화면이 자동 동기화되는 것은 아닙니다. 앱 삭제 시 로컬 기록이 사라질 수 있으므로 기존 내보내기로 백업하세요.

건강 기록은 앱의 로컬 웹 저장 공간에 보관하며 서버 전송 코드는 없습니다. 화면 폰트와 아이콘은 기존 외부 CDN을 사용합니다. 건강 데이터 읽기 기능은 앱에 포함한 로컬 문서의 최상위 프레임에만 허용하며 다른 페이지로의 이동을 차단합니다.

## 검증 상태와 실기기 확인 목록

Windows에서 Swift/iOS SDK 빌드는 실행할 수 없어 Xcode 컴파일 및 HealthKit 실기기 검증은 미완료입니다. 아래 항목을 iPhone에서 확인해야 합니다.

- 권한 허용/부분 허용/거부, 운동 없는 날짜, 네트워크 없는 상태.
- 실제 워치 운동의 시간·거리·심박수가 건강 앱과 일치하는지.
- 같은 운동 재가져오기 및 저장 시 중복 방지.
- 날짜 변경 시 선택 초기화, 선택 해제 후 저장.
- 저장 후 앱 재실행, JSON 백업/복구 후 운동 요약 유지.
- Safari 기록 이전, 글꼴/CDN 실패 시 화면과 가져오기 기능 동작.

의학적 분석이나 운동 종목·세트·무게 자동 추정은 하지 않습니다. 기타 앱에서 건강에 기록한 운동도 함께 조회하며 출처를 Apple Watch로 단정하지 않습니다.
