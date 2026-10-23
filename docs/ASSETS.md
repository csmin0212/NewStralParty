# 에셋 규격서

NewParty에 들어갈 그림 에셋 목록과 규격. 이 문서를 보면서 뽑아 오면 된다.

- 규격은 **최소 크기** 기준이다. 더 크게 뽑아도 되고, 최종 크기·포맷 변환은 넣을 때 처리한다.
- 정확히 맞추기 어려우면 비슷하게만 맞춰도 된다. 크기 조정, 배경 제거, 여백 정리는 넣을 때 할 수 있다.
- **제일 중요한 건 스타일 통일**이다. 아래 [스타일 가이드](#1-스타일-가이드)를 기준으로 뽑는다.

---

## 0. 전달 방법

1. 뽑은 원본은 프로젝트의 **`assets-raw/`** 폴더에 넣는다. 파일 이름은 대충이어도 된다.
   - 이 폴더는 git에 올라가지 않는다 (원본은 용량이 크므로).
2. 어떤 파일이 무엇인지 알려 주면 정리해서 `public/assets/`에 아래 이름으로 넣는다.
   배경 제거, 크기 조정, **WebP 변환**도 이때 한다 (아래 표의 `.png`는 최종적으로 `.webp`가 된다).
3. 그림을 넣으면 [src/ui/assets.ts](../src/ui/assets.ts)에 등록한다. 등록된 그림만 화면에 쓰이고, 없는 건 임시 아이콘으로 보인다.
4. 화면에 올려 보고 같이 확인한다.

---

## 1. 스타일 가이드 — ✅ 블루 아카이브 풍 학원 도시

**밝고 산뜻한 미래형 학원 도시.** 맑은 하늘 아래 흰색 · 하늘색 하이테크 발판들이 떠 있고, 그 위를 학생들이 뛰어다닌다.
블루 아카이브의 **분위기**를 참고한다: 깨끗한 흰 바탕, 하늘색 포인트, 얇고 또렷한 선, 밝은 낮.

> 1차 에셋(배경, 본부 · 코인+ · 균열 칸)이 이 기준의 **견본**이다. 새 그림은 이것들과 나란히 놓았을 때 어울리게 뽑는다.

| 항목 | 정한 값 |
|---|---|
| 전체 분위기 | 맑고 산뜻한 낮. **청량하고 밝은** 학원물 |
| 세계 | 여러 학교와 거리가 있는 **학원 도시**. 보드는 도시의 한 구역 |
| 그림체 | 요즘 모바일 가챠 게임 애니메이션 풍. **얇고 깔끔한 선**, 밝고 부드러운 셀 셰이딩 |
| 색감 | **흰색 + 하늘색**이 바탕, **노랑**은 작은 포인트로만. 칸마다 다른 색은 윗면 소품에서 낸다 |
| 빛 | 밝은 낮빛, 그림자는 연하게. 빛나는 부분은 **얇은 하늘색 라인** |
| 메카 · 소품 | 둥근 모서리의 흰 패널, 하늘색 유리, 얇은 발광 라인 (견본 칸의 발판 참고) |
| 하지 않는 것 | 어둡고 무거운 분위기, 사실적인 질감, 거친 붓 터치, 네온 사이버펑크 |

> ⚠ 블루 아카이브는 **분위기 참고용**이다. 원작 캐릭터, 로고, 학교 문장, 헤일로 디자인을 그대로 가져오지 않는다.
> 프롬프트에 게임 이름을 넣기보다 아래 공통 프롬프트처럼 특징을 말로 쓰는 게 결과도 더 안정적이다.

### 팔레트

| 역할 | 색 | 쓰는 곳 |
|---|---|---|
| 하늘 파랑 | `#4A9BEF` | 주 강조색, 배경 하늘 |
| 연한 하늘 | `#A9D6FA` | 테두리, 하이라이트 |
| 흰색 | `#FFFFFF` | 패널, 발판 윗면 |
| 발판 파랑 | `#3F78E0` | 발판 테두리, 진한 강조 |
| 남색 | `#1F3A68` | 글자, 외곽선 |
| 노랑 포인트 | `#FFD34D` | 코인, 별, 중요 표시 (조금만) |
| 균열 보라 | `#6B5BD6` | 에너미 · 위험 요소 |
| 경고 빨강 | `#FF5C7A` | 피해, 반격형 |

### 공통 프롬프트

AI 그림 도구는 영어 프롬프트가 더 안정적이다. **모든 프롬프트 앞에 아래 문장을 그대로 붙인다.**

```
modern anime mobile game art, clean thin crisp lineart, bright soft cel shading,
futuristic academy city theme, clean white and sky blue color scheme with small yellow accents,
bright clear daylight, airy and cheerful mood, high readability, polished gacha game asset,
no text, no letters, no logo, no watermark
```

투명 배경이 안 되는 도구라면 끝에 이걸 붙인다. 대상에 초록이 많으면 `magenta`로 바꾼다.

```
isolated on a plain solid #00FF00 green background, no ground shadow
```

### 통일 규칙

- **같은 스타일 문구를 모든 프롬프트 앞에 붙인다.** 가능하면 같은 모델과 같은 스타일 설정을 쓴다.
- **그림 안에 글자를 넣지 않는다.** 이름, 숫자, 효과 설명은 전부 화면에서 따로 그린다. AI가 그린 글자는 깨지기 쉽고, 나중에 고칠 수도 없다.
- **조명 방향과 시점을 통일한다.** 그림자가 드는 방향이 서로 다르면 판이 어색해 보인다.
- 대상을 **가운데에** 두고, 가장자리에 **여백을 10% 정도** 남긴다. 잘린 그림은 쓸 수 없다.

---

## 2. 우선순위

| 차수 | 무엇을 | 상태 |
|---|---|---|
| **1차** | 배경 1장, 칸 3종(본부 · 코인+ · 균열) | ✅ 들어옴 |
| **2차** | 나머지 칸 5종, 에너미 3종(경비 로봇 · 정찰 드론 · 불량배) 기본 그림 | ✅ 제작·적용 |
| 3차 | 에너미 전투 포즈, UI 아이콘, 아이템, 로고 | ✅ 제작·적용 |
| 캐릭터 때 | 캐릭터 메인 일러스트, 보드 말, 전투 포즈 | ✅ 뭇별 제작·적용 |
| **4차** | 로비 · 캐릭터 화면 배경, 스킬 아이콘 | ✅ 5종 제작·등록 |
| **5차** | 카드 39장, 상점 칸 | 상점 칸 · 카드 17장 ✅, 카드 22장 ⏳ |
| 캐릭터 | Soda · 모나 | ✅ 사용자가 직접 |
| 이후 | 보스, 에너미 추가, 유물 아이콘 | 보스 · 유물 시스템 |

### 2차 프롬프트

각 프롬프트 앞에 [공통 프롬프트](#공통-프롬프트)를 붙인다. 마음에 드는 결과가 나올 때까지 여러 장 뽑고, 그중 가장 좋은 것을 고른다.

**칸 공통** — 칸 프롬프트는 전부 이 문장으로 시작하고, 뒤에 칸마다 윗면만 바꾼다. 1차 칸들과 같은 발판이 나오게 하기 위해서다.

```
isometric game board tile, one round floating platform seen from a 30-degree top-down angle,
white and sky blue sci-fi panel base with a thin glowing blue rim and small yellow details,
clean flat top surface, same shape and thickness as a matching tile set, top surface shows:
```

| 칸 | 칸 공통 뒤에 붙일 내용 |
|---|---|
| 코인- `tiles/coin-minus.png` | `a tipped-over broken vending machine with a few coins spilling out, small red warning light` |
| 아이템 `tiles/card.png` | `a small white supply crate with a sky blue emblem, lid slightly open` |
| 회복 `tiles/heal.png` | `a compact first aid station, white medical kit with a soft pink cross` |
| 워프 `tiles/warp.png` | `an upright glowing cyan teleport gate ring` |
| 빈 칸 `tiles/empty.png` | `nothing on top, just the clean empty platform surface with subtle panel lines` |

**에너미** — 에너미 프롬프트 공통으로 뒤에 `full body, centered, facing left, simple readable silhouette`를 붙인다.

| 에너미 | 프롬프트 |
|---|---|
| 경비 로봇 `enemies/robot/idle.png` | `small cute security robot, round white and blue body, one big glowing visor eye, stubby arms` |
| 정찰 드론 `enemies/drone/idle.png` | `small agile patrol drone with four propellers, sleek white and blue shell, red sensor eye, hovering` |
| 불량배 `enemies/delinquent/idle.png` | `delinquent student thug in a messy school uniform, cap and face mask, holding a toy-like blaster, cocky stance` |

### 3차 요청 — 인카운터 · 전투 화면 (✅ 제작·적용)

원작 인카운터 · 전투 화면([docs/REFERENCE.md](REFERENCE.md) 2 · 3번)을 따라 만들기 위한 그림. 공통 프롬프트를 앞에 붙인다.

| 파일 | 용도 | 크기 | 프롬프트 (공통 프롬프트 뒤에) |
|---|---|---|---|
| `enemies/robot/encounter.png` | 인카운터 화면 가득 나오는 큰 그림 | 1024×1024, 투명 | `small cute security robot leaning toward the viewer in a dramatic ready-to-fight pose, big glowing visor eye, dynamic low angle, full body, centered` |
| `enemies/drone/encounter.png` | 〃 | 1024×1024, 투명 | `small patrol drone swooping toward the viewer, propellers blurred with motion, red sensor eye glaring, dynamic angle, centered` |
| `enemies/delinquent/encounter.png` | 〃 | 1024×1024, 투명 | `delinquent student thug pointing a toy-like blaster at the viewer, cocky grin under the face mask, cap tilted, dynamic low angle, full body, centered` |
| `battle/stage.png` | 전투 화면 가운데 둥근 무대 바닥 | 1920×640, 투명 | `wide oval battle arena floor seen from a low side angle, white and sky blue sci-fi panels with a glowing cyan ring, yellow hazard markings at the edge, empty, no characters` |
| `battle/background.png` | 전투 화면 뒤 배경 | 1920×1080 | `blurred futuristic school rooftop at dusk, sky blue and lavender tones, soft bokeh city lights, calm and low detail in the center` |
| `fx/impact.png` | 공격이 맞을 때 터지는 충격 | 512×512, 투명 | `comic style impact burst, white and sky blue jagged starburst with yellow sparks, no text` |
| `fx/smoke.png` | 전투 시작 · 회피 때 연기 | 512×512, 투명 | `comic style puff of white smoke clouds with soft blue shading, no text` |

- 인카운터 그림은 지금 있는 `idle`보다 **더 크고 박력 있게**, 화면을 향해 덤비는 구도로 뽑는다.
- 무대(`stage`)는 위에 캐릭터 둘이 서야 하므로 **가운데는 비워 둔다.**
- 플레이어 쪽 스티커에는 캐릭터 전투 포즈(아래 3번)가 들어간다.

### 4차 요청 — 로비 · 캐릭터 화면 (✅ 5종 제작·등록)

원작 로비 · 캐릭터 목록 · 캐릭터 상세 화면([docs/REFERENCE.md](REFERENCE.md) 7번)을 따라 만들기 위한 그림. 공통 프롬프트를 앞에 붙인다.
캐릭터 일러스트 · 얼굴 카드는 이미 있는 `main` · `portrait`를 쓰므로 **배경과 아이콘만** 있으면 된다. 메뉴 카드 틀 · 탭 · 버튼은 코드로 그린다.

| 파일 | 용도 | 크기 | 프롬프트 (공통 프롬프트 뒤에) |
|---|---|---|---|
| `lobby/background.png` | 로비 화면 가득 깔리는 배경. 왼쪽~가운데에 캐릭터 일러스트가 서고 오른쪽에 메뉴 카드가 올라간다 | 1920×1080 | `wide view of a futuristic academy city plaza on a bright clear day, white buildings with sky blue glass, floating sky blue platforms in the distance, big fluffy clouds, open empty space in the left and center foreground, calmer less detailed right side, no people, no characters` |
| `lobby/room.png` | 캐릭터 목록 · 상세 화면 배경 (원작의 방 배경 자리) | 1920×1080 | `bright modern academy club room interior, large windows with sky and clouds, white and sky blue furniture, soft sunlight, slightly blurred, low detail on the right half, no people, no characters` |
| `characters/mutbyeol/skill-active.png` | 상세 화면 · 스킬 버튼의 액티브 「피할만 한데?」 아이콘 | 256×256, 투명 | `game skill icon, two glowing dice with a swift sideways motion trail, sky blue and mint (#8EDBD9) glow, round icon, centered, simple bold shapes` |
| `characters/mutbyeol/skill-passive.png` | 패시브 「기대값이 높다니까?」 아이콘 | 256×256, 투명 | `game skill icon, a rising bar chart with a small star on top and a circular arrow, mint (#8EDBD9) and sky blue glow, round icon, centered, simple bold shapes` |
| `characters/mutbyeol/potential.png` | 잠재 능력 아이콘 | 256×256, 투명 | `game skill icon, a quick counter strike slash crossing a dodge motion trail, pink and mint glow, round icon, centered, simple bold shapes` |

- 두 배경은 위에 UI가 많이 올라가므로 **밝고 덜 복잡하게**, 특히 오른쪽 절반은 차분하게 뽑는다.
- 스킬 아이콘 3개는 **같은 틀 · 같은 크기 · 같은 굵기**로 맞춘다. 앞으로 캐릭터마다 이 3개를 같은 규칙으로 뽑는다.
- 없어도 화면은 먼저 만들 수 있다. 배경은 지금 하늘 배경, 아이콘은 글자 아이콘으로 임시로 둔다.

---

## 3. 캐릭터 — 캐릭터 시스템을 만들 때

**뭇별 (`mutbyeol`) 9종 제작 완료:** 승인된 기본 스탠딩, 보드 SD 토큰, 초상화, 전투 대기·공격·피격·방어·회피·쓰러짐. `public/assets/characters/mutbyeol/`에 투명 WebP로 저장했고 `CHARACTER_ART.mutbyeol`에 등록했습니다. 시작 화면 · HUD · 보드 말 · 전투 · 스킬 컷인에 연결했습니다. 나머지 캐릭터와 보스는 별도 설정을 기다립니다.


학원 도시의 학생들. 처음엔 **4명**(4인 플레이), 나중에 6~8명까지 늘린다.
**같은 캐릭터로 보여야** 하니, 교복 · 머리색 · 소품(무기, 가방 등)을 프롬프트에 똑같이 적는다.

### 기본

| 파일 | 용도 | 크기 | 포맷 | 메모 |
|---|---|---|---|---|
| `characters/<id>/main.png` | 메인 일러스트: 캐릭터 선택 · 승리 화면 | 1024×1536 (세로 2:3) | 투명 PNG | 전신, 포즈 자유 |
| `characters/<id>/token.png` | 보드 위의 말 | 512×512 | 투명 PNG | SD(치비) 비율, 전신, 정면 또는 살짝 위에서. **모든 캐릭터 같은 각도·같은 크기 비율** |
| `characters/<id>/portrait.png` | 패널 · 턴 표시 얼굴 | 512×512 | 투명 PNG | 어깨 위 상반신, 정면, 얼굴이 가운데 |

### 전투 포즈

인카운터 전투 화면에서 상황마다 바뀌는 그림. 전투 화면 왼쪽에 서므로 **오른쪽(에너미 쪽)을 보는 방향**으로 뽑는다.

| 파일 | 언제 | 메모 |
|---|---|---|
| `characters/<id>/battle-idle.png` | 기본 (대기) | 필수. 다른 포즈가 없으면 이걸로 대신한다 |
| `characters/<id>/battle-attack.png` | 공격할 때 | 사격하거나 앞으로 뛰어드는 동작 |
| `characters/<id>/battle-hit.png` | 맞을 때 (피격) | 움찔하거나 뒤로 밀리는 동작 |
| `characters/<id>/battle-block.png` | 방어할 때 | 막는 자세 |
| `characters/<id>/battle-evade.png` | 회피할 때 | 옆으로 피하는 동작 |
| `characters/<id>/battle-down.png` | 쓰러졌을 때 (KO) | 선택 |

- 크기 **768×768**, **투명 PNG**.
- **전투 포즈는 전부 같은 크기·같은 발 위치**로 맞춘다. 포즈가 바뀔 때 캐릭터가 화면에서 튀지 않게 하기 위해서다.

### 참고

- `<id>`는 영문 소문자 이름 (예: `luna`, `kai`).
- 캐릭터마다 **대표 색**을 하나 정해 주면, 그 색을 화면의 플레이어 색으로 쓴다.
- 말(token)은 판 위에서 50~70px 정도로 작게 보인다. **실루엣이 단순하고 색이 또렷해야** 작게 봐도 누군지 알 수 있다.

---

## 4. 보드

### 칸 (8종)

| 파일 | 칸 | 윗면 | 상태 |
|---|---|---|---|
| `tiles/base.png` | 본부 | 작은 하이테크 본부 건물과 깃발. **다른 칸보다 눈에 띄게** | ✅ |
| `tiles/coin-plus.png` | 코인+ | 별 모양 코인 더미 | ✅ |
| `tiles/spawn.png` | 균열 (에너미가 나타나는 곳) | 보라색 소용돌이 구멍. 위에 에너미가 올라서므로 **가운데는 단순하게** | ✅ |
| `tiles/coin-minus.png` | 코인- | 쓰러진 자판기 | ✅ |
| `tiles/card.png` | 아이템 | 보급 상자 | ✅ |
| `tiles/heal.png` | 회복 | 응급 키트 | ✅ |
| `tiles/warp.png` | 워프 | 전송 게이트 | ✅ |
| `tiles/empty.png` | 빈 칸 | 아무것도 없는 발판 | ✅ |

- 크기 **512×512**, **투명 PNG**.
- **발판 모양 · 두께 · 테두리는 모든 칸이 같게**, 윗면 소품만 다르게 한다. 1차 칸 3종이 기준이다.
- 판 위에서는 80px 정도로 작게 보인다. 윗면 소품은 **크고 단순하게**.

### 배경

| 파일 | 용도 | 크기 | 포맷 | 상태 |
|---|---|---|---|---|
| `board/background.jpg` | 보드 뒤 배경 | 2560×1440 (16:9) | JPG/PNG (투명 필요 없음) | ✅ |

- 보드 판이 **가운데에 올라간다.** 가운데는 칸이 잘 보이도록 **단순하게**, 볼거리는 가장자리에 둔다.
- 나중에 보드 맵을 여러 개 만들면 맵(도시 구역)마다 배경 1장씩 필요하다.

### 길 (선택)

칸 사이를 잇는 길은 지금은 코드로 그린다. 길을 그림으로 원하면 아래처럼 뽑는다.

| 파일 | 용도 | 크기 |
|---|---|---|
| `board/path.png` | 칸 사이를 잇는 길 조각 (가로로 이어 붙일 수 있게) | 256×64, 투명 PNG |

---

## 5. 에너미 — 지금 필요

지금 게임에 있는 에너미는 3종이다. 보드 위 배지와 전투 화면에 쓰인다.

| id | 이름 | 특징 (그림에 드러나면 좋은 것) |
|---|---|---|
| `robot` | 경비 로봇 | 약한 잡몹. 동글동글하고 귀여운 느낌 |
| `drone` | 정찰 드론 | 반격은 안 하지만 **회피가 높음**. 작고 날렵해 보이게 |
| `delinquent` | 불량배 | **반격형**. 무기를 들고 덤빌 것 같은 느낌 |

| 파일 | 언제 | 메모 |
|---|---|---|
| `enemies/<id>/idle.png` | 기본: 보드 위 배지, 전투 대기 | **필수** |
| `enemies/<id>/attack.png` | 반격할 때 | 반격형(불량배)만 필요 |
| `enemies/<id>/hit.png` | 맞을 때 | 선택. 없으면 기본 그림을 흔드는 연출 |
| `enemies/<id>/evade.png` | 회피할 때 | 회피형(드론)만, 선택 |

- 크기 **768×768**, **투명 PNG**.
- 전투 화면 오른쪽에 서므로 **왼쪽(플레이어 쪽)을 보는 방향**으로 뽑는다.
- 보드 위에서는 40px 정도의 동그란 배지로 줄어든다. **얼굴 · 실루엣이 가운데에 크게** 있어야 작게 봐도 알아볼 수 있다.
- 무섭기보다 귀엽고 만만한 쪽이 파티 게임에 어울린다.

### 이후

| 파일 | 용도 | 크기 |
|---|---|---|
| `enemies/<id>/...` | 에너미 추가 (기믹이 다양한 에너미들) | 위와 같음 |
| `bosses/<id>/...` | 최종 보스. 포즈 구성은 에너미와 같고 더 크고 화려하게 | 1024×1024 |

---

## 6. 카드 — 5차 요청 (⏳ 지금 필요, 카드 39장 + 상점 칸 1장)

덱 시스템([DESIGN.md](DESIGN.md) 11번)의 카드 그림. 질주 · 더블 주사위 · 붕대는 이미 있으니 그 3장과 나란히 놓았을 때 어울리게 뽑는다.

- 크기 **512×720** (세로 5:7), **투명 PNG**. 대상은 가운데 70% 안에.
- **카드 안쪽 그림만** 뽑는다. 테두리 · 이름 · 효과 글씨 · 비용은 화면에서 그린다.
- 사람 없이 **물건 · 상징 하나**가 주인공. 흰색 + 하늘색 바탕에 종류 색 빛을 조금 섞는다.
- 종류 색: 부스트 = 하늘 `#33AEF3`, 지원 = 민트 `#22B892`, 이벤트 = 보라 `#8A6CF0`, 전투 = 분홍 `#F2558B`.

**카드 공통** — 공통 프롬프트 뒤, 카드마다 내용 앞에 붙인다.

```
single collectible card illustration, one object as the hero, centered with empty margin,
dynamic three-quarter view, glossy white and sky blue materials, soft glow effects,
isolated on transparent background, no text, no letters, no frame, no border
```

### 부스트 (하늘색 빛)

| 파일 | 카드 | 내용 (카드 공통 뒤에) |
|---|---|---|
| `cards/triple-dice.png` | 트리플 주사위 | `three white dice with sky blue pips tumbling in the air, sparkling trail, sky blue glow` |
| `cards/remote-dice.png` | 리모컨 주사위 | `a white game controller with a single die floating above it, the die face changing, sky blue glow` |
| `cards/portal.png` | 랜덤 포털 | `a swirling cyan portal ring standing upright, sparkles spiraling into it, sky blue glow` |
| `cards/cookie.png` | 매점 쿠키 | `one round chocolate chip cookie in a small school snack wrapper, crumbs, warm sky blue glow` |
| `cards/cake.png` | 초코 케이크 | `a slice of chocolate cake with a strawberry on top on a small white plate, sky blue glow` |
| `cards/pudding.png` | 푸딩 | `a glossy caramel custard pudding on a plate wobbling, heart sparkles, sky blue glow` |
| `cards/poison-cure.png` | 이독제독 | `a test tube with swirling purple and green liquid turning into a healing light, sky blue glow` |
| `cards/notes.png` | 수업 노트 | `an open school notebook with sticky notes and a pen, pages fluttering, sky blue glow` |
| `cards/extend.png` | 보충 수업 | `a stack of textbooks with an hourglass and a glowing revive halo above, sky blue glow` |
| `cards/king-power.png` | 왕의 힘 | `a golden crown radiating red power aura with cracks of energy, sky blue rim light` |
| `cards/immovable.png` | 굳건함 | `a heavy white stone shield block planted firmly with a hexagon barrier, sky blue glow` |

### 지원 (민트 빛)

| 파일 | 카드 | 내용 (카드 공통 뒤에) |
|---|---|---|
| `cards/hurry.png` | 서둘러 | `a pair of winged sneakers with fast forward arrows, mint glow` |
| `cards/feast.png` | 호화 만찬 | `a big shared lunch tray set with rice, side dishes and milk carton, steam rising, mint glow` |
| `cards/share.png` | 너도 나도 | `two hands exchanging playing cards in a friendly way, mint sparkles` |
| `cards/backup.png` | 지원 요청 | `a glowing map pin beacon with a teleport light column, mint and white glow` |

### 이벤트 (보라 빛)

| 파일 | 카드 | 내용 (카드 공통 뒤에) |
|---|---|---|
| `cards/dinner.png` | 단체 급식 | `a large steaming school cafeteria pot with ladle and bowls around it, violet glow` |
| `cards/all-out.png` | 총공격 | `a megaphone blasting a violet shockwave with tiny flags and sparks` |
| `cards/revival.png` | 긴급 호출 | `a smartphone showing an emergency call icon with glowing alert rings, violet and white` |
| `cards/slingshot.png` | 새총 | `a wooden slingshot pulled back with a glowing pebble, violet glow` |
| `cards/laser.png` | 레이저 | `a sleek white laser pointer device firing a thin violet beam` |
| `cards/brick.png` | 벽돌 | `a single red brick flying with motion lines and a small impact star, violet glow` |
| `cards/blast.png` | 정밀 폭파 | `a round bomb with a lit fuse and a targeting reticle around it, violet glow` |
| `cards/railgun.png` | 레일건 | `a futuristic white railgun firing a straight bolt of violet lightning` |

### 전투 (분홍 빛)

| 파일 | 카드 | 내용 (카드 공통 뒤에) |
|---|---|---|
| `cards/atk-m.png` | 공격 강화 (중) | `a small sword icon with one upward arrow, pink glow` |
| `cards/atk-l.png` | 공격 강화 (대) | `two crossed swords with two upward arrows, stronger pink glow` |
| `cards/atk-g.png` | 공격 강화 (특대) | `a large trident blade with three upward arrows and a burst of pink energy` |
| `cards/on-fire.png` | 불타는 의지 | `a clenched fist wrapped in pink and orange flames` |
| `cards/magnum.png` | 매그넘 | `a heavy white revolver with a single glowing bullet and a drop of red, pink glow` |
| `cards/shadow-raid.png` | 그림자 습격 | `a dark crescent blade slash emerging from shadow smoke, pink rim light` |
| `cards/gawu.png` | 명검 | `a legendary katana with a glowing blade and a tassel, intense pink and white aura` |
| `cards/charge.png` | 축적 | `a sphere of swirling pink energy being charged between two gauntlets` |
| `cards/full-attack.png` | 전력 공격 | `a huge pink energy fist exploding with shockwaves and debris` |
| `cards/accel.png` | 액셀 | `two attack dice spinning fast with speed rings and a pink burst` |
| `cards/def-m.png` | 방어 강화 (중) | `a small round shield with one upward arrow, pink glow` |
| `cards/def-l.png` | 방어 강화 (대) | `a medium kite shield with two upward arrows, stronger pink glow` |
| `cards/def-g.png` | 방어 강화 (특대) | `a fortress tower shield with three upward arrows and a hexagon barrier, pink energy` |
| `cards/rainbow.png` | 무지개 원 | `a glowing rainbow ring halo floating with sparkles, pink tint` |
| `cards/retreat.png` | 전술적 후퇴 | `a running shoe leaving a smoke trail and a backward arrow, pink glow` |
| `cards/shield-counter.png` | 실드 카운터 | `a mirror shield bouncing an energy bolt back with a curved return arrow, pink glow` |

### 상점 칸

| 파일 | 칸 | 내용 (칸 공통 뒤에, [2차 프롬프트](#2차-프롬프트)의 칸 공통 문장) |
|---|---|---|
| `tiles/shop.png` | 상점 | `a small white school store kiosk with a sky blue awning and a card display stand` |

- 다 오면 [src/ui/assets.ts](../src/ui/assets.ts)의 `CARD_ART` · `TILE_ART`에 등록한다. 등록 전까지는 아이콘이 들어간다.

---

## 6-1. 캐릭터 — Soda · 모나

캐릭터 그림은 사용자가 직접 뽑는다. 파일 이름 · 규격은 [3. 캐릭터](#3-캐릭터--캐릭터-시스템을-만들-때)와 뭇별과 같게 `characters/soda/`, `characters/mona/`에 둔다. 오기 전까지 게임에는 임시 실루엣이 들어간다.

---

## 7. UI 아이콘 · 로고

| 파일 | 용도 | 크기 |
|---|---|---|
| `ui/coin.png` | 코인 | 256×256 |
| `ui/heart.png` | HP | 256×256 |
| `ui/star.png` | 레벨 | 256×256 |
| `ui/card-back.png` | 카드 뒷면 | 512×720 |
| `ui/logo.png` | 시작 화면 로고 | 가로형, 1600×600 정도 |

- 전부 **투명 PNG**.
- 아이콘은 20~32px로 작게 쓰인다. **디테일보다 또렷한 모양**이 중요하다.
- 로고는 글자가 들어가는 유일한 에셋이다. AI 글자가 깨지면 그림 부분만 뽑아 오면 된다. 글자는 폰트로 얹을 수 있다.

---

## 8. 체크리스트

| 에셋 | 상태 |
|---|---|
| 스타일 가이드 확정 | ✅ |
| **1차** 배경 | ✅ |
| **1차** 칸 — base / coin-plus / spawn | ✅ ✅ ✅ |
| **2차** 칸 — coin-minus / card / heal / warp / empty | ✅ ✅ ✅ ✅ ✅ |
| **2차** 에너미 — robot / drone / delinquent idle | ✅ ✅ ✅ |
| 3차 에너미 포즈 — delinquent attack / hit, drone evade, robot hit | ✅ ✅ ✅ ✅ |
| 추가 에너미 포즈 — drone hit | ✅ |
| 3차 UI — coin / heart / star / card-back / logo | ✅ ✅ ✅ ✅ ✅ |
| 3차 아이템 — dash / double-dice / bandage | ✅ ✅ ✅ |
| **요청** 인카운터 그림 — robot / drone / delinquent `encounter` | ✅ ✅ ✅ |
| **요청** 전투 — stage / background, 이펙트 — impact / smoke | ✅ ✅ ✅ ✅ |
| 선택용 길 — board/path | ✅ (현재 맵은 SVG 보행로 사용) |
| 캐릭터 1~4 — main / token / portrait | ☐ ☐ ☐ ☐ |
| 캐릭터 1~4 — 전투 포즈 (idle / attack / hit / block / evade) | ☐ ☐ ☐ ☐ |

2026-10-23: 사용자 요청에 따라 캐릭터와 보스를 제외한 남은 22종을 제작했습니다. 원본 PNG·프롬프트·검증 기록은 `assets-raw/remaining-assets/`, 게임용 WebP는 `public/assets/`에 있습니다. 전체 목록은 `public/assets/gallery.html`에서 볼 수 있습니다. 전투 포즈 5종은 전투 이벤트에 연결했고, 아이템·UI·로고도 해당 화면에 적용했습니다.

2026-10-23 추가 요청: 인카운터 에너미 3장·전투 무대·옥상 배경·충격·연기 7종을 제작해 기존 인카운터/아레나 화면에 등록했습니다. 원본·프롬프트·변환 스크립트·검증 기록은 `assets-raw/battle-assets/`에 보관합니다. 배경 원본은 1672×941이며 최종 적용 크기 1920×1080으로 변환했습니다.

2026-10-23 로비 추가분: 광장·동아리방 배경 2장과 뭇별 스킬 아이콘 3종을 제작했습니다. `LOBBY_ART`와 `CHARACTER_ART.mutbyeol`에 등록했으며 원본·프롬프트·검증 기록은 `assets-raw/lobby-assets/`에 있습니다. 신규 로비·캐릭터 상세 화면은 별도 구현 대상입니다.
