
// --- Global Window Declaration ---
declare global {
  interface Window {
    electronAPI?: {
      saveAsset: (buffer: ArrayBuffer, filename: string) => Promise<string>;
      exportProject: (data: any) => Promise<boolean>;
      importProject: () => Promise<any>;
      getAssetPath: () => Promise<string>;
      selectAssetPath: () => Promise<string | null>;
      reloadApp: () => void;
    };
  }
}

// --- Common / Genealogy Types ---

export enum Gender {
  UNKNOWN = 'UNKNOWN',
  MALE = 'MALE',
  FEMALE = 'FEMALE'
}

export enum RelationType {
  PARENT = 'PARENT',
  CHILD = 'CHILD',
  SPOUSE = 'SPOUSE',
  SIBLING = 'SIBLING',
  FRIEND = 'FRIEND',
  ENEMY = 'ENEMY',
  COLLEAGUE = 'COLLEAGUE',
  LOVER = 'LOVER',
  EX_SPOUSE = 'EX_SPOUSE',   // 离异/丧偶 (Marriage ended)
  EX_PARTNER = 'EX_PARTNER', // 分手 (Dating ended)
  STEP_PARENT = 'STEP_PARENT',
  ADOPTIVE_PARENT = 'ADOPTIVE_PARENT',
  MENTOR = 'MENTOR',
  SENIOR = 'SENIOR', // Changed from STUDENT
  STUDENT = 'STUDENT', // Kept only for backward compatibility if needed, but removed from UI
  
  // New Relation Types
  GRANDPARENT = 'GRANDPARENT',
  COUSIN = 'COUSIN',
  CRUSH = 'CRUSH',
  LOVE_RIVAL = 'LOVE_RIVAL',
  RIVAL = 'RIVAL',
  BOSS = 'BOSS'
}

export const RelationLabels: Record<string, string> = {
  [RelationType.PARENT]: '父母',
  [RelationType.CHILD]: '子女', 
  [RelationType.GRANDPARENT]: '祖父母',
  [RelationType.SPOUSE]: '配偶',
  [RelationType.SIBLING]: '兄弟姐妹',
  [RelationType.COUSIN]: '表亲',
  [RelationType.FRIEND]: '好友',
  [RelationType.ENEMY]: '宿敌',
  [RelationType.RIVAL]: '对手',
  [RelationType.COLLEAGUE]: '同僚',
  [RelationType.BOSS]: '老板',
  [RelationType.LOVER]: '恋人',
  [RelationType.CRUSH]: '暗恋',
  [RelationType.LOVE_RIVAL]: '情敌',
  [RelationType.EX_SPOUSE]: '前配偶(离异)',
  [RelationType.EX_PARTNER]: '前任(分手)',
  [RelationType.STEP_PARENT]: '继父母',
  [RelationType.ADOPTIVE_PARENT]: '养父母',
  [RelationType.MENTOR]: '老师',
  [RelationType.SENIOR]: '前辈'
};

// Relation Categories for UI Grouping
export const RelationCategories = {
  KINSHIP: {
    label: '亲属家族',
    types: [
      RelationType.PARENT, RelationType.SPOUSE, RelationType.SIBLING, 
      RelationType.GRANDPARENT, RelationType.COUSIN, 
      RelationType.STEP_PARENT, RelationType.ADOPTIVE_PARENT,
      RelationType.EX_SPOUSE // 前配偶属于家族历史的一部分，会触发亲缘网络筛选
    ]
  },
  ROMANCE: {
    label: '情感纠葛',
    types: [
      RelationType.LOVER, RelationType.CRUSH, 
      RelationType.EX_PARTNER, // 普通前任只算情感纠葛，不属于家族谱系
      RelationType.EX_SPOUSE, 
      RelationType.LOVE_RIVAL
    ]
  },
  WORK: {
    label: '职场/师门',
    types: [
      RelationType.COLLEAGUE, RelationType.BOSS, RelationType.MENTOR, RelationType.SENIOR
    ]
  },
  SOCIAL: {
    label: '社交/敌对',
    types: [
      RelationType.FRIEND, RelationType.ENEMY, RelationType.RIVAL
    ]
  },
  // CUSTOM category is handled dynamically now
};

export const GenderLabels: Record<string, string> = {
  [Gender.UNKNOWN]: '未知',
  [Gender.MALE]: '男',
  [Gender.FEMALE]: '女'
};

export enum ViewMode {
  TREE = 'TREE',
  NETWORK = 'NETWORK'
}

export interface Attribute {
  key: string;
  value: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'LINK' | 'FILE';
  url: string; // Base64 or URL
  date?: string;
  size?: string; // Optional file size string
  description?: string; // Description of the attachment
}

export interface Person {
  id: string;
  name: string;
  gender: Gender;
  familyId: string;
  generation?: number;
  
  // Date Fields (Split for flexibility)
  birthDate?: string; // Legacy / Composite string (e.g. "1990-01-01" or "1990")
  birthYear?: string;
  birthMonth?: string;
  birthDay?: string;
  birthIsBC?: boolean; // New: 公元前 flag
  
  // For fictional time systems
  customBirthDate?: string; 

  bio?: string;
  attributes?: Attribute[]; // RPG Stats or Character Traits
  inventory?: string[]; // List of item names
  
  // New Fields
  avatar?: string; // Base64 string for profile picture
  attachments?: Attachment[]; // Related files/images

  isCollapsed?: boolean;
  defaultLocationId?: string; // Room ID or Node ID where they usually are
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
}

export interface Relationship {
  id: string;
  source: string | Person;
  target: string | Person;
  type: RelationType | string; // Allow custom strings now
  strength: number;
  linkNum?: number;
  linkCount?: number;
  
  // Temporal Fields
  startDate?: string; // Start of relationship (ISO or Year string)
  endDate?: string;   // End of relationship
  displayDate?: string; // For non-real time systems

  // New: Event Links
  relatedEventIds?: string[]; // IDs of events related to this relationship's state change
}

export interface GraphData {
  nodes: Person[];
  links: Relationship[];
}

export interface RelationDefinition {
  id: string;
  name: string;
  description?: string;
  isKinship?: boolean; // If true, treated as family for filtering
}

// --- Blueprint / World Types ---

export enum NodeType {
  LOCATION = 'LOCATION',
  HUB = 'HUB',
  TRANSIT = 'TRANSIT',
  MOUNTAIN = 'MOUNTAIN',
  RIVER = 'RIVER',
  BRIDGE = 'BRIDGE',
  FOREST = 'FOREST',
  ISLAND = 'ISLAND',
  OCEAN = 'OCEAN',
  ROAD = 'ROAD',
  CASTLE = 'CASTLE',
  TOWER = 'TOWER',
  VILLAGE = 'VILLAGE',
  DUNGEON = 'DUNGEON',
  SECT = 'SECT',
  PAGODA = 'PAGODA',
  CAVE = 'CAVE',
  CITY_BLOCK = 'CITY_BLOCK',
  SLUM = 'SLUM',
  FACTORY = 'FACTORY'
}

export enum RoomType {
  ROOM = 'ROOM',
  BUILDING = 'BUILDING',
  OUTDOOR = 'OUTDOOR',
  WATER = 'WATER'
}

export interface Item {
  id: string;
  type: 'DOOR' | 'WINDOW' | 'BED' | 'CHEST' | 'TABLE' | 'NPC' | 'STAIRS' | 'ROAD' | 'WATER' | 'TREE' | 'WALL';
  x: number;
  y: number;
  name: string;
  [key: string]: any; // Allow other props
}

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  x: number;
  y: number;
  w: number;
  h: number;
  description?: string;
  items: Item[];
  floors?: Floor[]; // Recursive for buildings
  attributes?: Attribute[];
  attachments?: Attachment[];
}

export interface Floor {
  id: string;
  name: string;
  level: number;
  rooms: Room[];
}

export interface MapNode {
  id: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  type: NodeType;
  name: string;
  description?: string;
  tags: string[];
  floors: Floor[];
  attributes?: Attribute[];
  attachments?: Attachment[];
}

export interface MapEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
}

export interface WorldData {
  id: string;
  name: string;
  nodes: MapNode[];
  edges: MapEdge[];
}

export type SelectionType = 'NODE' | 'EDGE' | 'FLOOR' | 'ROOM' | 'ITEM' | 'PERSON' | null;

export interface Selection {
  type: SelectionType;
  id: string;
  parentId?: string;
}

export enum ViewLevel {
  WORLD = 'WORLD',
  BUILDING_EDITOR = 'BUILDING_EDITOR'
}

export enum MapDisplayMode {
  STATIC = 'STATIC',
  DYNAMIC = 'DYNAMIC'
}

export interface BlueprintViewState {
  viewLevel: ViewLevel;
  activeNodeId: string | null;
  activeFloorId: string | null;
  navigationStack: string[];
  selection: Selection | null;
  mapMode: MapDisplayMode;
  currentTime: string;
  isPlaying: boolean;
}

export type ThemeMode = 'BLUEPRINT' | 'INK' | 'CYBERPUNK' | 'CARTOON' | 'SCRAPBOOK';

// --- Time System Types ---

export enum TimeSystem {
  REAL = 'REAL', // 现实时间 (Gregorian)
  ERA = 'ERA',   // 虚构纪元 (Custom Era + Year)
  RELATIVE = 'RELATIVE', // 相对时间 (Day 1, Day 2...)
  CHAPTER = 'CHAPTER',   // 章节递推 (Chapter 1, 2...)
  SEASONAL = 'SEASONAL', // 季节循环 (Spring, Summer...)
  NONE = 'NONE'          // 无需时间 / 意识流
}

export interface ProjectTimeConfig {
  system: TimeSystem;
  label?: string; // e.g., "Galactic Era", "Year of the Dragon"
  startYear?: number; // Base year offset for Era
}

// --- Calendar / Event Types ---

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  
  // Real Time Fields
  start: string; // ISO String (Used for REAL time)
  end: string; // ISO String
  startIsBC?: boolean; // New: 公元前 flag for start
  endIsBC?: boolean;   // New: 公元前 flag for end
  
  // Fictional Time Fields
  displayDate?: string; // Human readable string for non-real time (e.g. "Year 205, Spring")
  sortOrder?: number; // For manual ordering in timeline
  
  locationId: string;
  participantIds: string[];
  relatedKeywordIds?: string[];
  attachments?: Attachment[];
}

// --- Wiki / Keyword Types ---

export type KeywordCategory = 'ITEM' | 'FACTION' | 'SPELL' | 'TERM' | 'LOCATION_LORE';
export const KeywordCategoryLabels: Record<KeywordCategory, string> = {
  ITEM: '物品',
  FACTION: '组织/势力',
  SPELL: '功法/技能',
  TERM: '专有名词',
  LOCATION_LORE: '地点设定'
};

export interface Keyword {
  id: string;
  name: string;
  category: KeywordCategory;
  parentId?: string; // For hierarchical structure (e.g. School -> Class)
  description?: string;
  tags?: string[];
  relatedPersonIds?: string[];
  attachments?: Attachment[];
}

// --- Project Type ---

export interface Project {
  id: string;
  name: string;
  type: 'GENEALOGY' | 'SOCIAL' | string;
  
  timeConfig?: ProjectTimeConfig; // New: Time settings

  data: GraphData;
  world: WorldData;
  events: CalendarEvent[];
  keywords: Keyword[];
  globalAttributeKeys?: string[];
  relationDefinitions?: RelationDefinition[];
  lastAccessed?: string; // ISO timestamp for sorting
  isPinned?: boolean; // Sort preference
}

export interface ExportData {
  version: string;
  timestamp: string;
  project: Project;
}
