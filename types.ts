

// types.ts complete reconstruction

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  UNKNOWN = 'UNKNOWN'
}

export const GenderLabels: Record<Gender, string> = {
  [Gender.MALE]: '男',
  [Gender.FEMALE]: '女',
  [Gender.UNKNOWN]: '未知'
};

export enum RelationType {
  PARENT = 'PARENT',
  CHILD = 'CHILD',
  SPOUSE = 'SPOUSE',
  LOVER = 'LOVER',
  FRIEND = 'FRIEND',
  ENEMY = 'ENEMY',
  RIVAL = 'RIVAL',
  COLLEAGUE = 'COLLEAGUE',
  BOSS = 'BOSS',
  MENTOR = 'MENTOR',
  GRANDPARENT = 'GRANDPARENT',
  SIBLING = 'SIBLING',
  COUSIN = 'COUSIN',
  STEP_PARENT = 'STEP_PARENT',
  ADOPTIVE_PARENT = 'ADOPTIVE_PARENT',
  CRUSH = 'CRUSH',
  LOVE_RIVAL = 'LOVE_RIVAL',
  EX_SPOUSE = 'EX_SPOUSE',
  EX_PARTNER = 'EX_PARTNER',
  SENIOR = 'SENIOR',
  STUDENT = 'STUDENT'
}

export const RelationLabels: Record<string, string> = {
  [RelationType.PARENT]: '父母',
  [RelationType.CHILD]: '子女',
  [RelationType.SPOUSE]: '配偶',
  [RelationType.LOVER]: '恋人',
  [RelationType.FRIEND]: '朋友',
  [RelationType.ENEMY]: '敌人',
  [RelationType.RIVAL]: '竞争对手',
  [RelationType.COLLEAGUE]: '同事',
  [RelationType.BOSS]: '上司',
  [RelationType.MENTOR]: '导师',
  [RelationType.GRANDPARENT]: '祖父母',
  [RelationType.SIBLING]: '兄弟姐妹',
  [RelationType.COUSIN]: '堂表亲',
  [RelationType.STEP_PARENT]: '继父母',
  [RelationType.ADOPTIVE_PARENT]: '养父母',
  [RelationType.CRUSH]: '暗恋',
  [RelationType.LOVE_RIVAL]: '情敌',
  [RelationType.EX_SPOUSE]: '前妻/前夫',
  [RelationType.EX_PARTNER]: '前任',
  [RelationType.SENIOR]: '前辈',
  [RelationType.STUDENT]: '学生'
};

export interface RelationCategory {
  label: string;
  types: RelationType[];
}

export const RelationCategories: Record<string, RelationCategory> = {
  KINSHIP: { label: '血缘亲属', types: [RelationType.PARENT, RelationType.CHILD, RelationType.SIBLING, RelationType.GRANDPARENT, RelationType.COUSIN, RelationType.STEP_PARENT, RelationType.ADOPTIVE_PARENT] },
  SOCIAL: { label: '社交情感', types: [RelationType.SPOUSE, RelationType.LOVER, RelationType.CRUSH, RelationType.EX_SPOUSE, RelationType.EX_PARTNER, RelationType.FRIEND, RelationType.LOVE_RIVAL] },
  WORK: { label: '职业竞争', types: [RelationType.COLLEAGUE, RelationType.BOSS, RelationType.MENTOR, RelationType.SENIOR, RelationType.STUDENT, RelationType.RIVAL, RelationType.ENEMY] }
};

export interface RelationDefinition {
  id: string;
  name: string;
  description?: string;
  isKinship?: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'LINK';
  url: string;
  date?: string;
  size?: string;
  description?: string;
}

export interface Attribute {
  key: string;
  value: string;
}

export interface Person {
  id: string;
  name: string;
  gender: Gender;
  familyId: string;
  generation?: number;
  bio?: string;
  avatar?: string;
  birthDate?: string; 
  birthYear?: string;
  birthMonth?: string;
  birthDay?: string;
  birthIsBC?: boolean;
  customBirthDate?: string;
  defaultLocationId?: string;
  attributes?: Attribute[];
  attachments?: Attachment[];
  isCollapsed?: boolean;
  // D3 force simulation properties
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface Relationship {
  id: string;
  source: string | Person;
  target: string | Person;
  type: string;
  strength: number;
  startDate?: string;
  endDate?: string;
  displayDate?: string;
  relatedEventIds?: string[];
  // D3 specific
  index?: number;
  linkNum?: number;
  linkCount?: number;
  labelX?: number;
  labelY?: number;
  labelWidth?: number;
  labelHeight?: number;
  angle?: number;
}

export interface GraphData {
  nodes: Person[];
  links: Relationship[];
}

export enum NodeType {
  LOCATION = 'LOCATION',
  HUB = 'HUB',
  TRANSIT = 'TRANSIT',
  ROAD = 'ROAD',
  MOUNTAIN = 'MOUNTAIN',
  RIVER = 'RIVER',
  OCEAN = 'OCEAN',
  BRIDGE = 'BRIDGE',
  FOREST = 'FOREST',
  ISLAND = 'ISLAND',
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
  name: string;
  type: string;
  x: number;
  y: number;
}

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  x: number;
  y: number;
  w: number;
  h: number;
  items: Item[];
  description?: string;
  attributes?: Attribute[];
  attachments?: Attachment[];
  floors?: Floor[]; 
}

export interface Floor {
  id: string;
  name: string;
  level: number;
  rooms: Room[];
}

export interface MapNode {
  id: string;
  name: string;
  type: NodeType;
  x: number;
  y: number;
  w: number;
  h: number;
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
  label?: string;
}

export interface WorldData {
  id: string;
  name: string;
  nodes: MapNode[];
  edges: MapEdge[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string; 
  end: string;   
  startIsBC?: boolean;
  endIsBC?: boolean;
  displayDate?: string;
  sortOrder?: number;
  locationId: string;
  participantIds: string[];
  relatedKeywordIds: string[];
  attachments?: Attachment[];
}

export enum TimeSystem {
  REAL = 'REAL',
  ERA = 'ERA',
  RELATIVE = 'RELATIVE',
  CHAPTER = 'CHAPTER',
  SEASONAL = 'SEASONAL',
  NONE = 'NONE'
}

export interface ProjectTimeConfig {
  system: TimeSystem;
  label?: string;
}

export interface AnnotationDefinition {
  id: string;
  ruby?: string;
  note?: string;
  imageUrls?: string[];
  personIds?: string[];
  locationIds?: string[];
  eventIds?: string[];
  keywordIds?: string[];
}

export interface Project {
  id: string;
  name: string;
  type: string;
  timeConfig?: ProjectTimeConfig;
  data: GraphData;
  world: WorldData;
  events: CalendarEvent[];
  keywords: Keyword[];
  annotations?: Record<string, AnnotationDefinition>; // 新增标注存储区
  globalAttributeKeys?: string[];
  relationDefinitions?: RelationDefinition[];
  lastAccessed?: string;
  isPinned?: boolean;
}

export enum ViewMode {
  NETWORK = 'NETWORK',
  TREE = 'TREE'
}

export enum ViewLevel {
  WORLD = 'WORLD',
  BUILDING_EDITOR = 'BUILDING_EDITOR'
}

export enum MapDisplayMode {
  STATIC = 'STATIC',
  DYNAMIC = 'DYNAMIC'
}

export interface Selection {
  type: 'NODE' | 'EDGE' | 'FLOOR' | 'ROOM' | 'ITEM' | 'PERSON';
  id: string;
  parentId?: string;
}

export type SelectionType = Selection['type'] | null;

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

export interface ExportData {
  version: string;
  timestamp: string;
  project: Project;
}

export type ThemeMode = 'BLUEPRINT' | 'INK' | 'CYBERPUNK' | 'CARTOON' | 'SCRAPBOOK';

export type KeywordCategory = 'ITEM' | 'FACTION' | 'ABILITY' | 'TERM' | 'GEOGRAPHY' | 'CULTURE' | 'SPECIES' | 'HISTORY' | 'SYSTEM';

export const KeywordCategoryLabels: Record<KeywordCategory, string> = {
  ITEM: '物品/道具',
  FACTION: '组织/势力',
  ABILITY: '功法/技能/能力',
  TERM: '专有名词/设定',
  GEOGRAPHY: '地理/地点/疆域',
  CULTURE: '习俗/文化/节日',
  SPECIES: '种族/物种/生物',
  HISTORY: '历史/传说/事件',
  SYSTEM: '体系/等级/规则'
};

export interface Keyword {
  id: string;
  name: string;
  category: KeywordCategory;
  parentId?: string; 
  description?: string;
  tags?: string[];
  attributes?: Attribute[];
  relatedPersonIds?: string[];
  relatedLocationIds?: string[]; 
  relatedEventIds?: string[];    
  relatedKeywordIds?: string[];  
  attachments?: Attachment[];
}

declare global {
  interface Window {
    electronAPI: {
      saveAsset: (buffer: ArrayBuffer, filename: string) => Promise<string>;
      exportProject: (data: ExportData) => Promise<boolean>;
      importProject: () => Promise<ExportData | null>;
      getAssetPath: () => Promise<string>;
      openAssetPath: () => Promise<void>;
      selectAssetPath: () => Promise<string | null>;
      reloadApp: () => void;
    };
  }
}
