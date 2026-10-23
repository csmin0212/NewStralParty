# NewParty game assets

Blue Archive의 청백색 애니메이션 미술 방향을 참고해 내장 image_gen으로 제작한 NewParty 전용 에셋입니다.

- board/background.webp — 보드 영역 배경, 1672×941
- tiles/base.webp — 본부, 512×512
- tiles/coin-plus.webp — 코인+, 512×512
- tiles/spawn.webp — 균열, 512×512
- tiles/coin-minus.webp, card.webp, heal.webp, warp.webp, empty.webp — 나머지 발판 5종, 각 512×512
- enemies/robot/{idle,hit}.webp — 경비 로봇, 각 768×768
- enemies/drone/{idle,hit,evade}.webp — 정찰 드론, 각 768×768
- enemies/delinquent/{idle,attack,hit}.webp — 불량배, 각 768×768
- ui/{coin,heart,star}.webp — 코인·HP·레벨 아이콘, 각 256×256
- ui/card-back.webp — 카드 뒷면, 512×720
- ui/logo.webp — NewParty 로고, 1600×600
- cards/{dash,double-dice,bandage}.webp — 아이템 3종, 각 512×720
- board/path.webp — 선택용 보행로 조각, 256×64 (현재 맵은 SVG 보행로 사용)

2026-10-23에 캐릭터·보스를 제외한 남은 22종을 추가했습니다. 전체보기는 gallery.html입니다. 추가한 WebP 22개는 합계 약 1.52MB입니다.

배경 외 이미지는 투명 알파를 보존했습니다. 1차 원본은 assets-raw/phase-1-blue-archive/, 추가 원본·프롬프트·변환 스크립트·검증 기록은 assets-raw/remaining-assets/에 보관하며 Git에서 제외됩니다. 준비된 에셋의 경로는 src/ui/assets.ts에서 관리합니다. 일반 에너미는 전투 이벤트에 따라 대기·공격·피격·회피 그림이 전환됩니다. 설정이 있는 캐릭터와 보스는 사용자 요청에 따라 이번 제작에서 제외했습니다.

enemies/slime/idle.webp는 과거 테마의 미사용 파일이며 현재 게임에서는 참조하지 않습니다.

## 인카운터·전투 추가분 (7종)

- enemies/{robot,drone,delinquent}/encounter.webp — 화면을 향한 큰 인카운터 그림, 각 1024×1024, 투명
- battle/stage.webp — 빈 원형 무대, 1920×640, 투명
- battle/background.webp — 해 질 무렵 학원 옥상, 1920×1080, 불투명
- fx/{impact,smoke}.webp — 충격·연기, 각 512×512, 투명

내장 image_gen으로 제작했으며 7개 WebP 합계 약 1.15MB입니다. assets-raw/battle-assets/에 원본·전체 프롬프트·변환 스크립트·검증 기록이 있습니다. 배경은 1672×941 원본에서 최종 규격으로 변환했고 다른 원본은 최종 규격보다 큽니다. 전투 시작·회피에 연기, 피격에 충격이 연결됩니다.

## 뭇별 (mutbyeol)

사용자 제공 캐릭터 참고 이미지와 승인한 스탠딩을 기준으로 내장 image_gen으로 제작했습니다.

- characters/mutbyeol/main.webp — 승인한 기본 스탠딩, 1024×1536
- characters/mutbyeol/{token,portrait}.webp — 보드 SD 토큰·초상화, 각 512×512
- characters/mutbyeol/battle-{idle,attack,hit,block,evade,down}.webp — 오른쪽을 보는 SD 전투 6종, 각 768×768

모든 파일은 투명 배경이며, 전투 그림은 공통 배율과 발 기준선으로 정렬했습니다. CHARACTER_ART.mutbyeol에 이름·경로를 등록했습니다. 캐릭터 선택이나 플레이어 배정은 아직 연결하지 않았습니다. 생성 원본·전체 프롬프트·변환 스크립트·검증 결과는 assets-raw/characters/mutbyeol/에 있습니다.
