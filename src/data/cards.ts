import type { CardId } from '../engine/types';
import { RULES } from '../engine/rules';

export interface CardInfo {
  id: CardId;
  name: string;
  icon: string;
  description: string;
}

export const CARDS: Record<CardId, CardInfo> = {
  dash: {
    id: 'dash',
    name: '질주',
    icon: '💨',
    description: `이번 이동 +${RULES.dashSteps}칸`,
  },
  doubleDice: {
    id: 'doubleDice',
    name: '더블 주사위',
    icon: '🎲',
    description: '주사위를 2개 굴린다',
  },
  bandage: {
    id: 'bandage',
    name: '붕대',
    icon: '🩹',
    description: `HP ${RULES.bandageHeal} 회복`,
  },
};

export const CARD_IDS = Object.keys(CARDS) as CardId[];
