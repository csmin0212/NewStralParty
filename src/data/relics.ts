// 유물: 아스트랄 파티 PVE의 강화 칩(筹码)을 그대로 옮겼다 (astralparty.miraheze.org/wiki/Chips).
// 성이 오를 때 · 임무를 마칠 때 · 유물 상점에서 3개 중 1개. 한 판 동안만 간다.
// 효과 처리: engine/relics.ts

export type RelicRarity = 'blue' | 'purple' | 'gold';
/** 키워드: 하나를 고르면 같은 키워드가 더 잘 나오고, 두 가지를 가지면 나머지 키워드는 안 나온다 */
export type RelicKeyword = 'heal' | 'starlight' | 'mark' | 'energy';
/** 맨 왼쪽 칸을 캐릭터 성향에 맞춰 뽑는 묶음 (원작 Character Chip Classes) */
export type RelicPool = 'support' | 'sustain' | 'attack' | 'cards';

export type RelicId =
  | 'gloves1' | 'gloves2' | 'gloves3'
  | 'skates1' | 'skates2' | 'skates3'
  | 'cookie1' | 'cookie2' | 'cookie3'
  | 'helmet1' | 'helmet2' | 'helmet3'
  | 'adrenaline'
  | 'battery'
  | 'membership'
  | 'backpack'
  | 'tome'
  | 'smartwatch'
  | 'piggy'
  | 'feather'
  | 'satellite'
  | 'flashlight'
  | 'bank1' | 'bank2' | 'bank3'
  | 'die8'
  | 'atm'
  | 'hammer'
  | 'fan1' | 'fan2'
  | 'spray'
  | 'targetBoard'
  | 'sight'
  | 'eagleEye'
  | 'darts'
  | 'quiver'
  | 'knife1' | 'knife2'
  | 'medkit1' | 'medkit2'
  | 'vitamin'
  | 'candy'
  | 'stew'
  | 'buffer'
  | 'badge'
  | 'shootingStar1' | 'shootingStar2'
  | 'bookmark'
  | 'whetstone'
  | 'endless'
  | 'recycler'
  | 'eBlade'
  | 'airbag'
  | 'shockGloves'
  | 'warpEngine'
  | 'eCore'
  | 'perpetual'
  | 'emGun'
  // 맵 전용
  | 'magnifier' | 'hannaDoll'
  | 'chronometer' | 'revivalDoll' | 'candyCard'
  | 'snakePlush' | 'carpPlush' | 'ragingCharm' | 'seafoodSoup' | 'twinCarps' | 'infiniteSerpent'
  | 'taser' | 'wristband' | 'pocketWatch' | 'pocketWatchBroken' | 'adaptiveCore' | 'entTerminal' | 'consciousness'
  | 'cursedSword' | 'revengeHalberd' | 'piercingGun'
  | 'ironAnchor' | 'trident' | 'dreamliner'
  | 'lovebird' | 'peacockFan' | 'featherBracelet'
  | 'grandGong' | 'redEnvelope'
  | 'teaCake' | 'ancientStaff' | 'swordShield';

export interface RelicInfo {
  name: string;
  icon: string;
  rarity: RelicRarity;
  keyword?: RelicKeyword;
  pool?: RelicPool;
  text: string;
  /** 원작 칩 이름 */
  ref: string;
  /** 이 보스 맵에서만 나온다 (data/maps.ts의 id) */
  map?: string;
}

const r = (
  name: string,
  icon: string,
  rarity: RelicRarity,
  text: string,
  ref: string,
  more: { keyword?: RelicKeyword; pool?: RelicPool; map?: string } = {},
): RelicInfo => ({ name, icon, rarity, text, ref, ...more });

export const RELICS: Record<RelicId, RelicInfo> = {
  gloves1: r('권투 글러브 · 기본', '🥊', 'blue', '공격력 +1', 'Boxing Gloves - Basic', { pool: 'attack' }),
  gloves2: r('권투 글러브 · 쓸 만함', '🥊', 'purple', '공격력 +2', 'Boxing Gloves - Fairly good', { pool: 'attack' }),
  gloves3: r('권투 글러브 · 훌륭함', '🥊', 'gold', '공격력 +5', 'Boxing Gloves - Excellent', { pool: 'attack' }),
  skates1: r('롤러스케이트 · 기본', '🛼', 'blue', '이동 +1', 'Speed Roller Skates - Basic'),
  skates2: r('롤러스케이트 · 쓸 만함', '🛼', 'purple', '이동 +2', 'Speed Roller Skates - Fairly Good'),
  skates3: r('롤러스케이트 · 훌륭함', '🛼', 'gold', '이동 +4', 'Speed Roller Skates - Excellent'),
  cookie1: r('샌드 쿠키 · 보통', '🍪', 'blue', '최대 체력 +2', 'Sandwich Cookie - Regular', { pool: 'sustain' }),
  cookie2: r('샌드 쿠키 · 맛있음', '🍪', 'purple', '최대 체력 +3', 'Sandwich Cookie - Tasty', { pool: 'sustain' }),
  cookie3: r('샌드 쿠키 · 아주 맛있음', '🍪', 'gold', '최대 체력 +3 · 늘어난 최대 체력 2마다 공격력 +1', 'Sandwich Cookie - Delicious', { pool: 'sustain' }),
  helmet1: r('오토바이 헬멧 · 보통', '⛑️', 'blue', '방어력 +1', 'Motorcycle Helmet - Regular', { pool: 'sustain' }),
  helmet2: r('오토바이 헬멧 · 쓸 만함', '⛑️', 'purple', '방어력 +2', 'Motorcycle Helmet - Fairly Good', { pool: 'sustain' }),
  helmet3: r('오토바이 헬멧 · 훌륭함', '⛑️', 'gold', '방어력 +3', 'Motorcycle Helmet - Excellent', { pool: 'sustain' }),
  adrenaline: r('아드레날린 · 고효율', '💉', 'gold', '체력 50% 이하: 공격력 +8 · 반격 무시', 'Adrenaline - High Efficiency', { pool: 'attack' }),
  battery: r('보조 배터리', '🔋', 'purple', '스킬 재사용 대기 -1', 'Extra Battery', { pool: 'support' }),
  membership: r('회원 추천장', '✉️', 'blue', '라운드 보상 카드 +1 · 상점 카드 값 -1', 'Membership Recommendation Letter', { pool: 'cards' }),
  backpack: r('큰 배낭', '🎒', 'purple', '카드 사용 +1', 'Large Backpack', { pool: 'cards' }),
  tome: r('마법서', '📖', 'purple', '효과 카드 3장마다 마지막 카드를 돌려받는다', 'Magic Tome', { pool: 'cards' }),
  smartwatch: r('스마트워치', '⌚', 'purple', '차례 끝에 손패가 5장 미만이면 1장 뽑기', 'Smartwatch', { pool: 'cards' }),
  piggy: r('돼지 저금통', '🐷', 'blue', '효과 카드 2장마다 코인 +3', 'Piggy Bank', { pool: 'cards' }),
  feather: r('우아한 깃털', '🪶', 'blue', '회피에 성공하면 공격력 +1 (최대 +4)', 'Graceful Feather', { pool: 'attack' }),
  satellite: r('탐사 위성', '🛰️', 'gold', '효과 카드 사거리 +3 (범위 효과 제외) · 차례 끝에 손패가 6장 미만이면 레일건 1장', 'Survey Satellite', { pool: 'cards' }),
  flashlight: r('손전등 · 밝음', '🔦', 'purple', '몬스터를 공격할 때 스타라이트 4마다 공격력 +1 · 전투에서 몬스터를 맞히면 스타라이트 1', 'Flashlight - Bright', { keyword: 'starlight', pool: 'attack' }),
  bank1: r('은행 카드 · 잔액 부족', '💳', 'blue', '스타라이트 4', 'Bank Card - Low Balance', { keyword: 'starlight', pool: 'support' }),
  bank2: r('은행 카드 · 넉넉함', '💳', 'purple', '스타라이트 7', 'Bank Card - High Balance', { keyword: 'starlight', pool: 'support' }),
  bank3: r('은행 카드 · 무제한', '💳', 'gold', '스타라이트 3 · 모든 아군 라운드 코인 보상 +3', 'Bank Card - Unlimited Balance', { keyword: 'starlight', pool: 'support' }),
  die8: r('8면 주사위', '🎲', 'blue', '최종 이동이 8이면 코인 +8 · 이동 8칸마다 스타라이트 1', '8-Sided Die', { keyword: 'starlight' }),
  atm: r('ATM', '🏧', 'blue', '송금하면 나와 받는 아군 모두 스타라이트 1 · 코인 1', 'ATM', { keyword: 'starlight', pool: 'support' }),
  hammer: r('스타코인 해머', '🔨', 'gold', '스타라이트 5 · 코인이 20보다 많으면 공격할 때 코인 6을 내고 그 전투 공격력 + 내 코인의 30%', 'Star Coin Hammer', { keyword: 'starlight', pool: 'attack' }),
  fan1: r('손선풍기 · 소', '🪭', 'blue', '액티브 스킬을 쓰면 6칸 안 몬스터에게 표식 1', 'Handheld Fan - Small', { keyword: 'mark', pool: 'support' }),
  fan2: r('손선풍기 · 대', '🪭', 'purple', '액티브 스킬을 쓰면 카드 1장 · 6칸 안 몬스터에게 표식 1', 'Handheld Fan - Large', { keyword: 'mark', pool: 'support' }),
  spray: r('마킹 스프레이', '🧴', 'blue', '효과 카드로 몬스터에게 피해를 주면 표식 1', 'Marking Spray Can', { keyword: 'mark', pool: 'cards' }),
  targetBoard: r('과녁판', '🎯', 'blue', '공격력 +1 · 차례 시작에 4칸 안 가장 가까운 몬스터에게 표식 1', 'Target Board', { keyword: 'mark', pool: 'attack' }),
  sight: r('표준 조준경', '🔭', 'purple', '공격력 +2 · 공격하면 표식 1', 'Standard Sight', { keyword: 'mark', pool: 'attack' }),
  eagleEye: r('매의 눈 조준경', '🦅', 'gold', '공격하면 표식 1 · 그 공격의 공격력 + 대상 표식 × 2', 'Eagle Eye Sight', { keyword: 'mark', pool: 'attack' }),
  darts: r('닌자 표창', '✴️', 'gold', '카드 사용 +1 · 피해 효과 카드 피해 + 대상 표식', 'Ninja Throwing Darts', { keyword: 'mark', pool: 'cards' }),
  quiver: r('마법 화살통', '🏹', 'purple', '표식이 있는 몬스터에게 카드를 쓰면 그 카드를 돌려받고 표식 1 (차례마다 1번)', 'Magic Quiver', { keyword: 'mark', pool: 'cards' }),
  knife1: r('커터칼 · 기본', '🔪', 'purple', '체력이 가득하면 공격력 +2 · 힐 2마다 +1', 'Utility Knife - Basic', { keyword: 'heal', pool: 'attack' }),
  knife2: r('커터칼 · 날카로움', '🔪', 'gold', '체력이 가득하면 공격력 +4 · 힐 2마다 +1', 'Utility Knife - Sharp', { keyword: 'heal', pool: 'attack' }),
  medkit1: r('구급상자 · 응급 처치', '🩹', 'blue', '차례 시작에 힐 1', 'Medical Kit - Emergency Treatment', { keyword: 'heal', pool: 'sustain' }),
  medkit2: r('구급상자 · 종합 치료', '🧰', 'gold', '차례 시작에 힐 3', 'Medical Kit - Comprehensive Treatment', { keyword: 'heal', pool: 'sustain' }),
  vitamin: r('비타민', '💊', 'purple', '카드를 얻을 때마다 힐 1', 'Vitamin Pills', { keyword: 'heal', pool: 'sustain' }),
  candy: r('맛있는 사탕', '🍬', 'purple', '효과 카드를 쓰면 힐 1 · 그때 체력이 가득하면 카드 사용 +1 (차례마다 1번)', 'Tasty Candy', { keyword: 'heal', pool: 'cards' }),
  stew: r('고급 스튜', '🍲', 'gold', '차례 시작에 5칸 안 모든 아군 힐 1 · 체력 +1', 'Gourmet Stew', { keyword: 'heal', pool: 'support' }),
  buffer: r('완충 방패', '🛡️', 'blue', '공격받으면 힐 2 · 코인 +3', 'Buffer Shield', { keyword: 'heal', pool: 'sustain' }),
  badge: r('우정 배지', '🎖️', 'purple', '아군에게 송금 · 회복하면 둘 다 힐 2', 'Friendship Badge', { keyword: 'heal', pool: 'support' }),
  shootingStar1: r('유성 · 보라', '🌠', 'purple', '몬스터를 놓아주면 1 피해 · 스타라이트 1', 'Shooting Star - Purple', { keyword: 'starlight' }),
  shootingStar2: r('유성 · 금', '🌠', 'gold', '몬스터를 놓아주면 2 피해 · 스타라이트 1 · 보스면 + 스타라이트만큼 피해', 'Shooting Star - Gold', { keyword: 'starlight' }),
  bookmark: r('책갈피', '🔖', 'blue', '효과 카드 피해 +1', 'Bookmark', { pool: 'cards' }),
  whetstone: r('숫돌', '🪨', 'purple', '체력 50% 미만: 공격력 +4 · 받는 피해 -1', 'Sharpening Stone', { pool: 'sustain' }),
  endless: r('무한 순환', '♾️', 'blue', '유물 다시 뽑기 3번 · 3차례 뒤 유물 1개', 'Endless Cycle'),
  recycler: r('에너지 회수기', '♻️', 'blue', '이동 5칸마다 에너지 2 · 에너지가 5보다 많으면 이동 +1', 'Energy Recycler', { keyword: 'energy' }),
  eBlade: r('전기 칼날', '⚡', 'blue', '전투에서 몬스터를 맞히면 에너지 2 · 에너지가 7보다 많으면 공격력 +2', 'Electric Blade', { keyword: 'energy', pool: 'attack' }),
  airbag: r('에어백', '🎈', 'purple', '쓰러질 피해를 받으면 에너지 6을 써서 피해 0 · 피해를 받으면 에너지 1', 'Air Bag', { keyword: 'energy', pool: 'sustain' }),
  shockGloves: r('전격 장갑', '🧤', 'purple', '효과 카드를 쓰면 에너지 2 · 차례 끝에 에너지 4를 써서 2칸 안 모든 몬스터 2 피해', 'Shock Gloves', { keyword: 'energy', pool: 'cards' }),
  warpEngine: r('워프 엔진', '🚀', 'blue', '돌격 · 가속 칸을 밟으면 에너지 2 · 다음 이동 +2', 'Warp Engine', { keyword: 'energy' }),
  eCore: r('전기 코어', '🔌', 'purple', '액티브 스킬을 쓰면 이번 차례 카드 사용 +1 · 에너지 5를 써서 재사용 대기 -1', 'Electric Core', { keyword: 'energy', pool: 'cards' }),
  perpetual: r('영구 기관', '⚙️', 'gold', '이동 +2 · 차례 시작에 에너지가 6 미만이면 6', 'Perpetual Motion Machine', { keyword: 'energy' }),
  emGun: r('전자기총', '🔫', 'gold', '공격력 +2 · 몬스터에게 도전한 뒤 에너지 4를 써서 대상과 주변 1칸 모든 몬스터에게 공격력의 50% 피해', 'Electromagnetic Gun', { keyword: 'energy', pool: 'attack' }),

  // 무한 도서관 ← 이상한 도서관
  magnifier: r('돋보기', '🔍', 'purple', '증거 1마다 공격력 +1 (최대 +4)', 'Magnifying Glass · Anomalous Library', { map: 'library', pool: 'attack' }),
  hannaDoll: r('한나 인형', '🧸', 'gold', '송금하면 증거 1 · 차례 끝에 코인 + 증거', 'Hanna Doll · Anomalous Library', { map: 'library', pool: 'support' }),
  // 백귀야행 골목 ← 유령 골목
  chronometer: r('크로노미터', '⏱️', 'blue', '오버클럭을 얻으면 1 더 · 오버클럭으로 움직이면 다음 전투 공격력 +2', 'Chronometer · Ghost Alley', { map: 'ghostalley', pool: 'attack' }),
  revivalDoll: r('부활 인형', '🪆', 'purple', '처음 쓰러질 때 진행도가 오르지 않는다 · 공격력 +1 · 방어력 +1', 'Revival Doll · Ghost Alley', { map: 'ghostalley', pool: 'sustain' }),
  candyCard: r('사탕 적립 카드', '🍭', 'gold', '사탕 자판기 공짜 · 회복 카드를 쓰면 스킬 재사용 대기 -1', 'Candy Rewards Card · Ghost Alley', { map: 'ghostalley', pool: 'cards' }),
  // 슬럼피아 놀이공원 ← 용궁
  snakePlush: r('뱀 인형', '🐍', 'purple', '피해를 받으면 다음 전투 공격력 +2', 'Snake Plushie · Dragon Palace', { map: 'dragonpalace', pool: 'sustain' }),
  carpPlush: r('잉어 인형', '🎏', 'purple', '액티브 스킬을 쓰면 공격력 +1 (최대 +4)', 'Carp Plushie · Dragon Palace', { map: 'dragonpalace', pool: 'attack' }),
  ragingCharm: r('성난 파도 부적', '🌊', 'blue', '효과 카드를 쓰면 3칸 안 가장 가까운 몬스터 1 피해 · 카드를 얻으면 체력 +1', 'Raging Wave Charm · Dragon Palace', { map: 'dragonpalace', pool: 'cards' }),
  seafoodSoup: r('몽롱한 해물탕', '🍜', 'blue', '공격 주사위가 1 또는 6만 나온다', 'Psychedelic Seafood Soup · Dragon Palace', { map: 'dragonpalace', pool: 'attack' }),
  twinCarps: r('얽힌 쌍잉어', '🐟', 'gold', '반격을 받지 않는다 · 공격 주사위 6', 'Intertwined Twin Carps · Dragon Palace', { map: 'dragonpalace', pool: 'attack' }),
  infiniteSerpent: r('무한의 뱀', '♾️', 'gold', '차례 시작에 손패가 4장이 될 때까지 뽑기 · 카드 사용 +1', 'Infinite Serpent · Dragon Palace', { map: 'dragonpalace', pool: 'cards' }),
  // 카이텐 결승 무대 ← 결승 경기장
  taser: r('테이저', '⚡', 'purple', '반격형 에너미를 쓰러뜨리면 마인드 1 · 마인드 3 이상: 공격력 +2', 'Taser · Grand Final Arena', { map: 'arena', pool: 'attack' }),
  wristband: r('스포츠 손목 밴드', '🩳', 'purple', '공격력 +1 · 보스를 공격할 때 공격력 +3', 'Sports Wristband · Grand Final Arena', { map: 'arena', pool: 'attack' }),
  pocketWatch: r('제때 회중시계', '⌚', 'gold', '쓰러질 피해를 받으면 체력 가득으로 버틴다 · 그 뒤 고장', 'Timely Pocket Watch · Grand Final Arena', { map: 'arena', pool: 'sustain' }),
  pocketWatchBroken: r('고장 난 회중시계', '⌚', 'gold', '-', 'Timely Pocket Watch (Broken)', { map: 'none' }),
  adaptiveCore: r('적응형 코어', '🔷', 'blue', '마인드 3 미만: 받는 피해 -1 · 마인드 3 이상: 공격력 +2', 'Adaptive Core · Grand Final Arena', { map: 'arena', pool: 'sustain' }),
  entTerminal: r('엔터테인먼트 단말', '🎮', 'purple', '마인드가 있으면 공격력 +4 · 방어력 +4 · 차례 끝에 마인드 -1', 'Entertainment Terminal · Grand Final Arena', { map: 'arena', pool: 'attack' }),
  consciousness: r('근원 의식', '🧠', 'gold', '마인드를 얻으면 최대 체력 +1 · 공격력 +1 (최대 +5)', 'Original Consciousness · Grand Final Arena', { map: 'arena', pool: 'sustain' }),
  // 트리니티 고성당 ← 어혼 축제
  cursedSword: r('저주받은 검', '🗡️', 'blue', '최대 체력 -2 · 에너미를 쓰러뜨릴 때마다 공격력 +1 (최대 +5)', 'Cursed Sword · Soul Celebration', { map: 'soul', pool: 'attack' }),
  revengeHalberd: r('복수의 미늘창', '🔱', 'purple', '체력 50% 이하: 공격력 +5 · 체력 가득: 방어력 +3', 'Revenge Halberd · Soul Celebration', { map: 'soul', pool: 'attack' }),
  piercingGun: r('관통총', '🔫', 'gold', '효과 카드 피해 +2 · 보스에게 +4', 'Piercing Gun · Soul Celebration', { map: 'soul', pool: 'cards' }),
  // 여름 해변 리조트 ← 드리마
  ironAnchor: r('쇠닻', '⚓', 'blue', '피해를 받으면 공격력 +1 · 차례 시작마다 -1', 'Iron Anchor · Dreama', { map: 'dreama', pool: 'attack' }),
  trident: r('삼지창', '🔱', 'purple', '액티브 스킬을 쓰면 모든 아군 다음 전투 공격력 +1', 'Trident · Dreama', { map: 'dreama', pool: 'support' }),
  dreamliner: r('드림라이너 모형', '🛥️', 'gold', '이동 +2 · 15칸마다 스킬 재사용 대기 -1', 'Dreamliner Model · Dreama', { map: 'dreama' }),
  // 설원 전초 기지 ← 정원 회랑
  lovebird: r('원앙 옥패', '🕊️', 'purple', '차례 시작에 아군과 1칸 안: 이동 +2 · 아니면 다음 전투 공격력 +1', "Lovebird's Jade Pendant · Garden Courtyard", { map: 'garden', pool: 'support' }),
  peacockFan: r('공작 깃털 부채', '🪶', 'purple', '최대 체력 +3 · 공격받으면 다음 전투 공격력 +1', 'Peacock Feather Fan · Garden Courtyard', { map: 'garden', pool: 'sustain' }),
  featherBracelet: r('오색 깃털 팔찌', '🎐', 'gold', '액티브 스킬을 쓰면 깃털 1 · 깃털 3마다 유물', 'Colourful Feather Bracelet · Garden Courtyard', { map: 'garden', pool: 'support' }),
  // 슬럼피아 서커스 거리 ← 물의 마을
  grandGong: r('큰 징', '🥁', 'purple', '액티브 스킬을 쓰면 4칸 안 모든 아군 다음 전투 공격력 +1', 'Giant Grand Gong · Water Town', { map: 'watertown', pool: 'support' }),
  redEnvelope: r('세뱃돈 봉투', '🧧', 'gold', '송금하면 둘 다 다음 전투 공격력 +1 · 송금 3번마다 모든 아군 코인 +5', 'Red Festival Envelopes · Water Town', { map: 'watertown', pool: 'support' }),
  // 지하 대성당 학원 ← 마법 학원
  teaCake: r('찻잔 케이크', '🍰', 'blue', '공격력 +1 · 찻주전자 병정을 공격할 때 공격력 +2', 'Tea Cake · Magic Academy', { map: 'academy', pool: 'attack' }),
  ancientStaff: r('고대의 지팡이', '🪄', 'purple', '효과 카드 사거리 +3 · 카드 사용 +1', 'Ancient Staff · Magic Academy', { map: 'academy', pool: 'cards' }),
  swordShield: r('고급 검과 방패', '🛡️', 'gold', '공격력 +3 · 문제아일 때 방어력 +3', 'Premium Sword and Shield · Magic Academy', { map: 'academy', pool: 'attack' }),
};

export const RELIC_IDS = Object.keys(RELICS) as RelicId[];

/** 아이콘 파일 이름: 등급만 다른 유물은 한 장 (gloves1 · 2 · 3 → gloves) */
export function relicFamily(id: RelicId): string {
  if (id === 'die8') return id;
  if (id === 'pocketWatchBroken') return 'pocketWatch-broken';
  return id.replace(/\d$/, '');
}

export const RARITY_NAME: Record<RelicRarity, string> = { blue: '파랑', purple: '보라', gold: '금' };

export const KEYWORD_INFO: Record<RelicKeyword, { name: string; icon: string; text: string }> = {
  heal: { name: '힐', icon: '💚', text: '차례 시작에 힐만큼 체력 회복 · 차례 끝에 절반 (내림)' },
  starlight: { name: '스타라이트', icon: '✦', text: '3라운드마다 라운드 보상 코인 + 스타라이트 · 줄지 않는다' },
  mark: { name: '표식', icon: '🎯', text: '표식이 있는 몬스터는 모든 피해 +1 · 보스 차례마다 1 줄어든다' },
  energy: { name: '에너지', icon: '⚡', text: '최대 15 · 유물이 쌓고 쓴다' },
};

/** 원작 확률 (성 → 파랑 · 보라 · 금). NORMAL과 그 위 난이도가 다르다 */
export const RARITY_ODDS: { normal: [number, number, number][]; hard: [number, number, number][] } = {
  normal: [
    [0.6, 0.3, 0.1],
    [0.6, 0.3, 0.1],
    [0.4, 0.4, 0.2],
    [0.2, 0.5, 0.3],
  ],
  hard: [
    [0.6, 0.37, 0.03],
    [0.6, 0.37, 0.03],
    [0.4, 0.45, 0.15],
    [0.25, 0.5, 0.25],
  ],
};

/** 같은 키워드 유물이 나올 무게 배수 */
export const KEYWORD_WEIGHT = 3;
/** 유물 상점: 기본 값 · 살 때마다 + */
export const RELIC_SHOP = { base: 10, step: 5 };
export const ENERGY_MAX = 15;
