# 소리

코드: [src/ui/sound.ts](../src/ui/sound.ts) (효과음 · 파일 재생) · [src/ui/voice.ts](../src/ui/voice.ts) (목소리 · 아나운서) · [src/ui/bgm.ts](../src/ui/bgm.ts) (배경 음악)
파일: `public/assets/{sfx,voice,bgm}/` · 듣기: [public/assets/audio-gallery.html](../public/assets/audio-gallery.html) · 출처: [public/assets/AUDIO-CREDITS.txt](../public/assets/AUDIO-CREDITS.txt)
원본: `assets-raw/audio-2026-10-25/` (git 밖)

## 출처 (모두 CC0)

| 묶음 | 만든 이 | 쓰는 곳 | 수 |
|---|---|---|---:|
| [Female RPG Voice Starter Pack](https://opengameart.org/content/female-rpg-voice-starter-pack) | Cici Fyre | `voice/cute` · `calm` · `cool` | 90 |
| [Male Grunt/Yelling sounds](https://opengameart.org/content/male-gruntyelling-sounds) | HaelDB | `voice/male` | 19 |
| [Voiceover Pack](https://kenney.nl/assets/voiceover-pack) · [Fighter](https://kenney.nl/assets/voiceover-pack-fighter) | Kenney | `voice/announcer-f` · `announcer-m` | 70 |
| Interface · Casino · RPG · Impact · UI · Digital Audio | Kenney | `sfx` | 30 |
| [Helice Awesome Dance Adventure !!](https://opengameart.org/node/96795) | Komiku | `bgm` | 18 |
| [Happy Clappy Loop](https://opengameart.org/content/happy-clappy-loop) | OwlishMedia | `bgm/result` | 1 |
| [Determined Pursuit](https://opengameart.org/content/determined-pursuit-epic-orchestra-loop) | Emma_MA | `bgm/boss-garden` | 1 |
| [80 CC0 creature SFX](https://opengameart.org/content/80-cc0-creature-sfx) · [#2](https://opengameart.org/content/80-cc0-creture-sfx-2) | rubberduck | `voice/monster` | 54 |
| [Sea and river wave sounds](https://opengameart.org/content/sea-and-river-wave-sounds) | RandomMind | `bgm/amb-waves` | 1 |
| [Crickets Ambient Noise](https://opengameart.org/content/crickets-ambient-noise-loopable) | Wolfgang_ | `bgm/amb-crickets` | 1 |
| [Forest Ambience](https://opengameart.org/content/forest-ambience) | | `bgm/amb-forest` | 1 |

## 배경 음악

| 곡 | 때 | 원곡 |
|---|---|---|
| `lobby` | 로비 · 캐릭터 · 도감 | Pop City |
| `select` | 협동 챌린지 · 출격 준비 | The journey begins |
| `map-<맵>` | 보드 | Road 1~4 Chill · Cliff Road Chill · Little town before Big city · The Ruins · Rosa's Theme |
| `boss-<맵>` | 보스가 깨어난 뒤 | Road 1~4 Fight · Cliff Road Fight · Fighting the Sellers's machine · Big Boss Hélice · Determined Pursuit |
| `map-default` | 그 밖의 보드 | Hélice's Theme |
| `result` | 결과 | Happy Clappy Loop |

| 환경음 (음악 × 0.6) | 맵 |
|---|---|
| `amb-waves` | 드리마 · 워터 타운 · 드래곤 팰리스 |
| `amb-crickets` | 영혼 축전 · 유령 골목 |
| `amb-forest` | 가을숲 환상경 · 정원 안뜰 |

## 아나운서 (설정: 여성 · 남성)

| 때 | 줄 |
|---|---|
| 라운드 | `round` + 1~10 |
| 진행도 한계 3 이내 | `hurry_up` |
| 보스 등장 | `war_look_out` |
| 보스 전투 | `fight` (여성: `go`) |
| 보스 처치 | `war_target_destroyed` |
| 성 오름 | `level_up` |
| 승리 · 패배 | `mission_completed` · `mission_failed` |
| 설정에서 바꿀 때 | `ready` |

## 캐릭터 목소리

| 때 | 여성 | 남성 |
|---|---|---|
| 공격 | `attack1~3` | `attack1~6` |
| 맞음 | `damaged1~3` | `damaged1~6` |
| 회피 | `jump1~3` | `jump1~3` |
| 회복 | `healed1~3` | |
| KO | `damaged3` | `damaged1~6` |
| 액티브 | 캐릭터 주문 (`SKILL_LINE`) · 없으면 `attack` | `skill1~4` |

| 목소리 | 캐릭터 |
|---|---|
| cute | Soda · 모나 · 패니 · 파파라 · 렌 · 미미 · 루루 · 린 · 링링 · 최고귀염뽀짝천사 · 니디 걸 · 도로시 · 토노 한나 |
| calm | 뭇별 · 파루난 · 알라나 · 키이세이 · 자스민 · 낸시 루 · 유메 · 테루 · 보니 · 질 |
| cool | 라우엘 · 코마치 · 잉크 섀도우 · 펭 · 미사키 · 나르디스 · 루카 · 마무시 · 타치바나 세리 |
| male | 패드맨 · Z3000 · 판다맨 · AL · 메가스 · 모제스 · 사이크스 |

| 캐릭터 | 액티브 주문 |
|---|---|
| Soda | fire |
| 모나 · 루루 | bubbles |
| 라우엘 | hex |
| 알라나 | cure |
| 렌 | heal |
| 키이세이 | cyclone |
| 나르디스 | water |
| 유메 | wind |
| 테루 | burn |
| 마무시 | corruption |
| 토노 한나 | freeze |
| 타치바나 세리 | hellstorm |
| 최고귀염뽀짝천사 | twister |
| 보니 | curse |
| 린 | aqua |

## 몬스터 울음

| 때 | 파일 |
|---|---|
| 전투 공격 · 몬스터 차례 공격 | `<종류>-attack` |
| 맞음 | `<종류>-hurt` |
| 처치 | `<종류>-die` |
| 보스 등장 | `boss-attack` |

| 종류 | 몬스터 |
|---|---|
| boss | 보스 전부 |
| slime | 슬라임 · 젤리 3종 |
| robot | 로봇 · 드론 · 오토마타 · 미사일 · 필러 · 분위기 로봇 · 지휘대 · 기계 뱀용 · 인공생명체 3종 |
| cute | 찻주전자 2종 · 영혼 2종 · 피냐타 · 원숭이 상자 · 페로로 미니언 · 제비 · 종업원 · 금붕어 · 부엉이 · 게 · 새우 |
| beast | 나머지 |

## 효과음

| id | 때 | 원본 |
|---|---|---|
| `click` · `page` | 버튼 · 탭 | Interface · RPG `bookFlip1` |
| `dice` | 주사위 | Casino `dice-throw-1` |
| `draw` | 카드 받음 | Casino `card-slide-1` |
| `shuffle` | 유물 다시 뽑기 | Casino `card-shuffle` |
| `chips` | 송금 | Casino `chips-collide-1` |
| `buy` | 카드 · 유물 사기 | RPG `handleCoins` |
| `hit` · `block` · `evade` | 전투 맞음 · 막음 · 피함 | Impact `impactPunch_heavy_000` · `impactPlate_heavy_000` · RPG `cloth1` |
| `skill` | 액티브 띠 | Digital `phaserUp3` |
| `relic` | 유물 고르기 | Digital `powerUp7` |
| `warp` · `buff` · `debuff` · `open` · `hover` · `diceShake` | 남겨 둠 | Digital · RPG · UI · Casino |

## 없는 것

| 항목 | |
|---|---|
| 캐릭터마다 다른 목소리 · 한국어 대사 | 무료 CC0 없음 → 녹음 · 주문 필요 |
| 매직 아카데미 환경음 | 없음 |
