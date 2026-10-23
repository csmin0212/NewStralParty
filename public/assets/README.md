# NewParty game assets

Blue Archive의 청백색 애니메이션 미술 방향을 참고해 내장 image_gen으로 제작한 NewParty 전용 에셋입니다.

- board/background.webp — 보드 영역 배경, 1672×941
- tiles/base.webp — 본부, 512×512
- tiles/coin-plus.webp — 코인+, 512×512
- tiles/spawn.webp — 균열, 512×512
- enemies/slime/idle.webp — ⚠ WebP 변환이 실패해 0바이트. 에너미가 학원 도시 적(경비 로봇 · 정찰 드론 · 불량배)으로 바뀌어 지금은 쓰지 않는다 (원본 PNG는 assets-raw에 있음)

배경 외 이미지는 투명 알파를 보존했습니다. 원본과 생성 프롬프트, 변환 스크립트는 로컬 assets-raw/phase-1-blue-archive/에 보관하며 Git에서 제외됩니다. 준비된 에셋의 경로는 src/ui/assets.ts에서 관리합니다. 아직 생성하지 않은 칸·에너미는 기존 이모지 표시를 유지합니다.
