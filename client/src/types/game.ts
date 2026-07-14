// 游戏阶段
export type GamePhase = 'lobby' | 'search' | 'discuss' | 'vote' | 'result';

// 线索类型
export type ClueType = 'normal' | 'key' | 'murderer_cover';

// 玩家角色
export interface Player {
  id: string;
  name: string;
  characterId: string;
  isHost: boolean;
  isMurderer: boolean;
  inventory: string[]; // 收集的线索ID列表
  notes: string[];
  avatar?: string;
  roleName?: string;
  characterName?: string;
  story?: CharacterStory;
  hiddenTask?: CharacterHiddenTask;
  alibi?: string;
}

// 角色故事
export interface CharacterStory {
  background: string;
  personality: string;
  relationshipWithVictim: string;
}

// 角色隐藏任务
export interface CharacterHiddenTask {
  title: string;
  content: string;
  completionHint: string;
}

// 线索/道具
export interface Clue {
  id: string;
  name: string;
  type: ClueType;
  roomId: string;
  description: string;
  icon: string;
  scareEffect: string | null;
  tags?: string[];
}

// 房间
export interface Room {
  id: string;
  name: string;
  icon: string;
  description: string;
  bgImage: string;
  scareTrigger: string;
  props: Clue[];
}

// 聊天消息
export interface ChatMessage {
  id: string;
  type: 'public' | 'private';
  from: string;
  fromName: string;
  to?: string;
  toName?: string;
  content: string;
  timestamp: number;
}

// 投票
export interface Vote {
  voterId: string;
  voterName: string;
  targetId: string;
  targetName: string;
}

// 恐怖事件
export interface ScareEvent {
  id: string;
  name: string;
  description: string;
  icon: string;
}

// 隐藏线索
export interface HiddenClue {
  id: string;
  name: string;
  content: string;
}

// 游戏状态
export interface GameState {
  id: string;
  phase: GamePhase;
  players: Player[];
  clues: {
    collected: { clueId: string; playerId: string; timestamp: number }[];
    destroyed: string[];
  };
  chatMessages: {
    public: ChatMessage[];
    private: Record<string, ChatMessage[]>;
  };
  votes: Vote[];
  outcome: 'good' | 'bad' | null;
  scareEventsTriggered: string[];
  hiddenCluesGranted: { clueId: string; playerId: string }[];
  createdAt: number;
}

// 剧本元信息
export interface ScriptMeta {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  playerCount: number;
  estimatedTime: string;
  genre: string[];
  bgm: {
    default: string;
    scare: string;
    tense: string;
  };
}

// 世界观背景
export interface WorldBackground {
  title: string;
  content: string;
  openingNarration: string;
}

// 剧本角色
export interface ScriptCharacter {
  id: string;
  name: string;
  roleType: string;
  age: number;
  gender: string;
  avatar: string;
  isMurderer: boolean;
  story: CharacterStory;
  hiddenTask: CharacterHiddenTask;
  alibi: string;
  initialClues: string[];
}

// 结局
export interface Ending {
  title: string;
  condition: string;
  content: string;
  epilogue: string;
}

// 剧本数据
export interface ScriptData {
  meta: ScriptMeta;
  worldBackground: WorldBackground;
  characters: ScriptCharacter[];
  rooms: Room[];
  endings: {
    good: Ending;
    bad: Ending;
  };
  scareEvents: ScareEvent[];
  hiddenClues: HiddenClue[];
}
