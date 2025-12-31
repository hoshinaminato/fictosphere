
import { GraphData, Person, Relationship, Gender, RelationType, Project, CalendarEvent, WorldData, NodeType, RoomType, Keyword, TimeSystem } from '../types';

const generateId = () => Math.random().toString(36).substr(2, 9);

// --- SCENARIO 1: THREE BODY PROBLEM (Sci-Fi / Era Time) ---

const generateThreeBodyPeople = (): GraphData => {
  const nodes: Person[] = [
    { id: 'p_yewenjie', name: '叶文洁', gender: Gender.FEMALE, familyId: '叶家', generation: 1, bio: '清华大学物理系天体物理专业教授，ETO（地球三体组织）精神领袖。', customBirthDate: '公元 1947', attributes: [{ key: '身份', value: '统帅' }, { key: '专业', value: '天体物理' }], attachments: [], avatar: '', defaultLocationId: 'r_red_coast_ctrl' },
    { id: 'p_evans', name: '麦克·伊文斯', gender: Gender.MALE, familyId: 'ETO', generation: 1, bio: '物种共产主义者，ETO 实际出资人与组织者，降临派领袖。', customBirthDate: '公元 1950', attributes: [{ key: '资产', value: '富豪' }, { key: '据点', value: '审判日号' }], attachments: [], avatar: '', defaultLocationId: 'n_judgment_day' },
    { id: 'p_luoji', name: '罗辑', gender: Gender.MALE, familyId: '罗家', generation: 2, bio: '天文学家，社会学家，第四位面壁者，执剑人。', customBirthDate: '黄金时代', attributes: [{ key: '身份', value: '面壁者' }, { key: '威慑度', value: '90%' }], attachments: [], avatar: '', defaultLocationId: 'r_eden' },
    { id: 'p_dashi', name: '史强 (大史)', gender: Gender.MALE, familyId: '警务系统', generation: 2, bio: '前反恐大队队长，粗中有细，负责保护罗辑等科学家。', customBirthDate: '黄金时代', attributes: [{ key: '职业', value: '警察' }, { key: '特长', value: '观察力' }], attachments: [], avatar: '', defaultLocationId: 'n_pdc' },
    { id: 'p_zhangbeihai', name: '章北海', gender: Gender.MALE, familyId: '太空军', generation: 2, bio: '中国太空军政治部主任，坚定的逃亡主义者（表面上的胜利主义者），自然选择号舰长。', customBirthDate: '黄金时代', attributes: [{ key: '信念', value: '绝对' }, { key: '身份', value: '第五面壁者' }], attachments: [], avatar: '', defaultLocationId: 'n_space_force' },
    { id: 'p_chengxin', name: '程心', gender: Gender.FEMALE, familyId: '公共', generation: 3, bio: '航天发动机专业博士，阶梯计划候选人，第二任执剑人。', customBirthDate: '危机纪元', attributes: [{ key: '评价', value: '圣母' }], attachments: [], avatar: '' },
    { id: 'p_yuntianming', name: '云天明', gender: Gender.MALE, familyId: '公共', generation: 3, bio: '阶梯计划执行人，大脑被送往三体舰队。', customBirthDate: '危机纪元', attributes: [{ key: '赠礼', value: '恒星' }], attachments: [], avatar: '' },
    { id: 'p_wade', name: '托马斯·维德', gender: Gender.MALE, familyId: 'PIA', generation: 2, bio: 'PIA（行星防御理事会战略情报局）局长，只为前进，不择手段。', customBirthDate: '黄金时代', attributes: [{ key: '名言', value: '前进三' }, { key: '威慑度', value: '100%' }], attachments: [], avatar: '' }
  ];

  const links: Relationship[] = [
    { id: generateId(), source: 'p_yewenjie', target: 'p_evans', type: RelationType.COLLEAGUE, strength: 7 }, // ETO Co-founders
    { id: generateId(), source: 'p_yewenjie', target: 'p_evans', type: RelationType.RIVAL, strength: 6 }, // Ideological Conflict
    { id: generateId(), source: 'p_yewenjie', target: 'p_luoji', type: RelationType.MENTOR, strength: 8 }, // Suggested Cosmic Sociology
    { id: generateId(), source: 'p_dashi', target: 'p_luoji', type: '守护', strength: 10 },
    { id: generateId(), source: 'p_dashi', target: 'p_luoji', type: RelationType.FRIEND, strength: 9 },
    { id: generateId(), source: 'p_yuntianming', target: 'p_chengxin', type: RelationType.LOVER, strength: 9 }, // Unrequited / Deep Love
    { id: generateId(), source: 'p_chengxin', target: 'p_yuntianming', type: RelationType.CRUSH, strength: 5 }, // Complex feelings
    { id: generateId(), source: 'p_wade', target: 'p_chengxin', type: RelationType.BOSS, strength: 8 },
    { id: generateId(), source: 'p_wade', target: 'p_chengxin', type: RelationType.ENEMY, strength: 7 }, // Attempted murder
    { id: generateId(), source: 'p_zhangbeihai', target: 'p_wade', type: RelationType.COLLEAGUE, strength: 4 } // Parallel paths
  ] as any;

  return { nodes, links };
};

const generateThreeBodyMap = (): WorldData => ({
  id: 'world_3bp', name: '三体世界观 (Three-Body)',
  nodes: [
    { id: 'n_red_coast', x: 200, y: 150, w: 120, h: 100, type: NodeType.MOUNTAIN, name: '红岸基地 (雷达峰)', description: '位于大兴安岭，绝密国防工程，用于搜寻地外文明。', tags: ['Top Secret', 'History'], floors: [ 
        { id: 'f_rc_ground', name: '基地主楼', level: 0, rooms: [ { id: 'r_red_coast_ctrl', x: 20, y: 20, w: 100, h: 80, name: '发射控制室', type: RoomType.ROOM, items: [ { id: 'i_transmit_btn', type: 'TABLE', x: 50, y: 40, name: '发射按钮' } ] } ] } 
    ] },
    { id: 'n_judgment_day', x: 500, y: 150, w: 150, h: 60, type: NodeType.ISLAND, name: '审判日号 (巨轮)', description: '伊文斯的移动基地，第二红岸，拥有接收三体信息的设备。', tags: ['ETO', 'Mobile'], floors: [] },
    { id: 'n_pdc', x: 350, y: 350, w: 180, h: 120, type: NodeType.HUB, name: '联合国 PDC 总部', description: '行星防御理事会，面壁计划在此公布。', tags: ['UN', 'Politics'], floors: [] },
    { id: 'n_space_force', x: 150, y: 450, w: 150, h: 100, type: NodeType.CITY_BLOCK, name: '太空军基地', description: '人类走向星空的起点。', tags: ['Military'], floors: [] },
    { id: 'n_bunker', x: 600, y: 400, w: 200, h: 150, type: NodeType.FACTORY, name: '掩体世界', description: '威慑纪元后人类在木星背后的太空城群。', tags: ['Future'], floors: [] }
  ],
  edges: [ { id: 'e_history', sourceId: 'n_red_coast', targetId: 'n_judgment_day', label: '信息传承' } ]
});

const generateThreeBodyLore = (): Keyword[] => [
  { id: 'k_sophons', name: '智子 (Sophon)', category: 'ITEM', description: '三体人制造的微观粒子智能计算机，锁死了人类的基础物理学。', tags: ['科技', '封锁'], relatedPersonIds: ['p_yewenjie', 'p_luoji', 'p_wade'] },
  { id: 'k_dark_forest', name: '黑暗森林法则', category: 'TERM', description: '宇宙社会学的核心公理：宇宙就是一座黑暗森林，每个文明都是带枪的猎人。', tags: ['理论', '核心'], relatedPersonIds: ['p_yewenjie', 'p_luoji'] },
  { id: 'k_wallfacer', name: '面壁计划', category: 'TERM', description: '利用人类思维的封闭性，指定四位面壁者制定战略，以此对抗智子的全方位监控。', tags: ['战略'], relatedPersonIds: ['p_luoji', 'p_zhangbeihai'] },
  { id: 'k_droplet', name: '水滴', category: 'ITEM', description: '三体探测器，表面绝对光滑，由强相互作用力材料构成，摧毁了人类舰队。', tags: ['武器', '毁灭'] }
];

const generateThreeBodyEvents = (): CalendarEvent[] => {
  return [
    { id: 'evt_signal', title: '太阳的放大', description: '叶文洁向太阳发射信号，首次利用恒星增益向宇宙广播地球坐标。', displayDate: '黄金时代 (1971)', sortOrder: 1, locationId: 'r_red_coast_ctrl', participantIds: ['p_yewenjie'], relatedKeywordIds: [], start: new Date().toISOString(), end: new Date().toISOString() },
    { id: 'evt_guzheng', title: '古筝行动', description: '在巴拿马运河，大史设计利用纳米飞刃切碎“审判日”号，获取三体信息。', displayDate: '危机纪元 元年 (2007)', sortOrder: 5, locationId: 'n_judgment_day', participantIds: ['p_evans', 'p_dashi', 'p_wade'], relatedKeywordIds: [], start: new Date().toISOString(), end: new Date().toISOString() },
    { id: 'evt_wallfacer_start', title: '面壁者公布', description: '联合国宣布罗辑等四人为面壁者。', displayDate: '危机纪元 3年', sortOrder: 10, locationId: 'n_pdc', participantIds: ['p_luoji'], relatedKeywordIds: ['k_wallfacer'], start: new Date().toISOString(), end: new Date().toISOString() },
    { id: 'evt_doomsday', title: '末日战役', description: '水滴抵达太阳系，摧毁人类联合舰队 2000 艘战舰。', displayDate: '危机纪元 205年', sortOrder: 20, locationId: 'n_bunker', participantIds: ['p_zhangbeihai'], relatedKeywordIds: ['k_droplet'], start: new Date().toISOString(), end: new Date().toISOString() },
    { id: 'evt_broadcast', title: '执剑人交接', description: '罗辑将引力波广播开关交给程心。水滴立刻发动攻击。', displayDate: '威慑纪元 61年', sortOrder: 30, locationId: 'n_pdc', participantIds: ['p_luoji', 'p_chengxin', 'p_wade'], relatedKeywordIds: ['k_dark_forest'], start: new Date().toISOString(), end: new Date().toISOString() }
  ];
};

// --- SCENARIO 2: WANG ANSHI (Historical / Real Time) ---

const generateWangAnshiPeople = (): GraphData => {
  const nodes: Person[] = [
    { id: 'p_was', name: '王安石', gender: Gender.MALE, familyId: '临川王氏', generation: 1, bio: '字介甫，号半山，北宋著名思想家、政治家、文学家、改革家。', birthDate: '1021-12-18', attributes: [{ key: '官职', value: '同中书门下平章事' }, { key: '谥号', value: '文' }, { key: '派系', value: '新党' }], attachments: [], avatar: '', defaultLocationId: 'r_was_study' },
    { id: 'p_sz', name: '赵顼 (宋神宗)', gender: Gender.MALE, familyId: '赵宋皇室', generation: 2, bio: '北宋第六位皇帝，励精图治，支持王安石变法。', birthDate: '1048-05-25', attributes: [{ key: '身份', value: '皇帝' }], attachments: [], avatar: '', defaultLocationId: 'r_palace_main' },
    { id: 'p_smg', name: '司马光', gender: Gender.MALE, familyId: '夏县司马氏', generation: 1, bio: '字君实，号迂叟。北宋政治家、史学家。反对新法，主张稳健。', birthDate: '1019-11-17', attributes: [{ key: '代表作', value: '资治通鉴' }, { key: '派系', value: '旧党' }], attachments: [], avatar: '' },
    { id: 'p_ss', name: '苏轼', gender: Gender.MALE, familyId: '眉山苏氏', generation: 2, bio: '字子瞻，号东坡居士。文坛领袖，因反对新法激进措施而遭贬谪，但与王安石私交甚笃。', birthDate: '1037-01-08', attributes: [{ key: '官职', value: '翰林学士' }, { key: '特长', value: '诗词书画' }], attachments: [], avatar: '' },
    { id: 'p_sk', name: '沈括', gender: Gender.MALE, familyId: '钱塘沈氏', generation: 2, bio: '字存中，博学家。初期支持新法，负责司天监。', birthDate: '1031-01-01', attributes: [{ key: '代表作', value: '梦溪笔谈' }, { key: '成就', value: '科学' }], attachments: [], avatar: '' },
    { id: 'p_wf', name: '王雱', gender: Gender.MALE, familyId: '临川王氏', generation: 2, bio: '王安石长子，才华横溢但性格偏激，积极参与变法理论构建。早逝。', birthDate: '1044-01-01', attributes: [{ key: '身份', value: '长子' }], attachments: [], avatar: '' },
    { id: 'p_oyx', name: '欧阳修', gender: Gender.MALE, familyId: '吉州欧阳氏', generation: 0, bio: '字永叔，号醉翁。王安石的座师，后期因反对青苗法而致仕。', birthDate: '1007-08-01', attributes: [{ key: '身份', value: '文坛领袖' }], attachments: [], avatar: '' },
    { id: 'p_lhq', name: '吕惠卿', gender: Gender.MALE, familyId: '泉州吕氏', generation: 2, bio: '字吉甫。王安石变法的主要助手，后背叛王安石，被称为“护法善神”也被称为奸臣。', birthDate: '1032-01-01', attributes: [{ key: '评价', value: '有才无德' }], attachments: [], avatar: '' }
  ];

  const links: Relationship[] = [
    { id: generateId(), source: 'p_was', target: 'p_sz', type: '君臣', strength: 9 }, // Monarch-Subject
    { id: generateId(), source: 'p_was', target: 'p_smg', type: RelationType.ENEMY, strength: 8 }, // Political Enemy
    { id: generateId(), source: 'p_was', target: 'p_smg', type: RelationType.FRIEND, strength: 4 }, // Personal Friend (Old)
    { id: generateId(), source: 'p_was', target: 'p_ss', type: RelationType.RIVAL, strength: 6 }, // Rival
    { id: generateId(), source: 'p_was', target: 'p_wf', type: RelationType.PARENT, strength: 10 },
    { id: generateId(), source: 'p_oyx', target: 'p_was', type: RelationType.MENTOR, strength: 7 },
    { id: generateId(), source: 'p_was', target: 'p_lhq', type: RelationType.COLLEAGUE, strength: 8 }, // Colleague/Assistant
    { id: generateId(), source: 'p_lhq', target: 'p_was', type: RelationType.ENEMY, strength: 7 }, // Betrayal
    { id: generateId(), source: 'p_was', target: 'p_sk', type: RelationType.COLLEAGUE, strength: 6 }
  ] as any;

  return { nodes, links };
};

const generateWangAnshiMap = (): WorldData => ({
  id: 'world_song', name: '北宋·东京汴梁',
  nodes: [
    {
      id: 'n_kaifeng', x: 400, y: 300, w: 300, h: 250, type: NodeType.CITY_BLOCK, name: '开封府内城', description: '当时世界上最繁华的都市。', tags: ['Capital', 'Safe'],
      floors: [
        {
          id: 'f_kaifeng_ground', name: '街道层', level: 0,
          rooms: [
            { id: 'r_palace_main', x: 100, y: 20, w: 100, h: 80, name: '大庆殿', type: RoomType.BUILDING, items: [], description: "朝会正殿，神宗与群臣议事之处。" },
            { id: 'r_zhongshu', x: 20, y: 20, w: 60, h: 60, name: '中书省', type: RoomType.BUILDING, items: [], description: "宰相办公之地。" },
            { id: 'r_was_home', x: 220, y: 150, w: 60, h: 60, name: '王安石宅', type: RoomType.BUILDING, items: [], description: "相府，简朴素雅。" },
            { id: 'r_xiangguo', x: 150, y: 180, w: 80, h: 50, name: '大相国寺', type: RoomType.BUILDING, items: [], description: "汴京最大的寺院，也是热闹的集市。" }
          ]
        },
        {
          id: 'f_was_in', name: '王宅内部', level: 0,
          rooms: [
             { id: 'r_was_study', x: 0, y: 0, w: 150, h: 100, name: '半山书房', type: RoomType.ROOM, items: [
               { id: 'i_desk_book', type: 'TABLE', x: 70, y: 50, name: '著书案' }
             ]}
          ]
        }
      ]
    },
    { id: 'n_jiangning', x: 600, y: 500, w: 120, h: 80, type: NodeType.VILLAGE, name: '江宁 (金陵)', description: '王安石晚年退居之地。', tags: ['Retirement'], floors: [
       { id: 'f_banshan', name: '半山园', level: 0, rooms: [ { id: 'r_garden', x: 10, y: 10, w: 100, h: 60, name: '半山园', type: RoomType.OUTDOOR, items: [] } ] }
    ]}
  ],
  edges: [
    { id: 'e_s1', sourceId: 'n_kaifeng', targetId: 'n_jiangning', label: '汴河水路' }
  ]
});

const generateWangAnshiLore = (): Keyword[] => [
  { id: 'k_new_policy', name: '新法 (熙宁变法)', category: 'TERM', description: '旨在富国强兵的一系列改革措施，包括青苗法、募役法、保甲法等。', tags: ['改革', '政治'], relatedPersonIds: ['p_was', 'p_sz', 'p_lhq', 'p_wf'] },
  { id: 'k_green_shoots', name: '青苗法', category: 'TERM', description: '新法核心之一。在青黄不接时由官府给农民贷款，秋后随赋税偿还，以此抑制兼并，增加国库收入。', tags: ['争议', '经济'], parentId: 'k_new_policy' },
  { id: 'k_conservative', name: '旧党 (保守派)', category: 'FACTION', description: '反对新法的政治集团，以司马光为首，主张因循祖宗之法，反对激进变革。', tags: ['反对派'], relatedPersonIds: ['p_smg', 'p_oyx', 'p_ss'] },
  { id: 'k_poem_case', name: '乌台诗案', category: 'TERM', description: '苏轼因诗文中含有讽刺新法之意入狱。王安石上书“安有圣世而杀才士乎”进言营救。', tags: ['文学', '冤案'], relatedPersonIds: ['p_ss', 'p_was', 'p_sz'] }
];

const generateWangAnshiEvents = (): CalendarEvent[] => {
  return [
    { id: 'evt_xining_start', title: '熙宁改元', description: '宋神宗即位，改年号为熙宁，起用王安石为参知政事，拉开变法序幕。', displayDate: '熙宁元年', sortOrder: 1, locationId: 'r_palace_main', participantIds: ['p_was', 'p_sz'], relatedKeywordIds: ['k_new_policy'], start: '1068-01-01T09:00:00', end: '1068-12-31T18:00:00' },
    { id: 'evt_green_shoots', title: '颁布青苗法', description: '在争议声中，制置三司条例司颁布青苗法。', displayDate: '熙宁二年', sortOrder: 2, locationId: 'r_zhongshu', participantIds: ['p_was', 'p_lhq'], relatedKeywordIds: ['k_green_shoots'], start: '1069-09-01T09:00:00', end: '1069-09-30T17:00:00' },
    { id: 'evt_debate', title: '廷辩', description: '司马光与王安石在御前激烈争论新法利弊。神宗最终支持王安石。', displayDate: '熙宁三年', sortOrder: 3, locationId: 'r_palace_main', participantIds: ['p_was', 'p_smg', 'p_sz'], relatedKeywordIds: ['k_conservative'], start: '1070-05-01T10:00:00', end: '1070-05-01T12:00:00' },
    { id: 'evt_su_jail', title: '乌台诗案', description: '苏轼下狱。王安石虽已退居金陵，仍上书神宗营救。', displayDate: '元丰二年', sortOrder: 10, locationId: 'n_kaifeng', participantIds: ['p_ss', 'p_was'], relatedKeywordIds: ['k_poem_case'], start: '1079-07-01T08:00:00', end: '1079-12-01T18:00:00' }
  ];
};

// --- TEMPLATE FACTORY ---

export type ProjectTemplate = 'EMPTY' | 'THREE_BODY' | 'SONG_DYNASTY';

export const getTemplateData = (type: ProjectTemplate): Project => {
  const baseId = Date.now().toString();
  
  if (type === 'THREE_BODY') {
     return {
        id: baseId,
        name: '三体：地球往事 (Three-Body)',
        type: 'SCI_FI',
        timeConfig: { system: TimeSystem.ERA, label: '纪元' },
        data: generateThreeBodyPeople(),
        world: generateThreeBodyMap(),
        events: generateThreeBodyEvents(),
        keywords: generateThreeBodyLore(),
        globalAttributeKeys: ['身份', '威慑度', '所属组织'],
        relationDefinitions: [
           { id: 'REL_WALLFACER', name: '面壁者', description: '面壁计划执行人' },
           { id: 'REL_SWORDHOLDER', name: '执剑人', description: '威慑控制者' },
           { id: 'REL_GUARD', name: '守护', description: '负责保护目标安全' }
        ],
        lastAccessed: new Date().toISOString(),
        isPinned: false
     };
  }
  
  if (type === 'SONG_DYNASTY') {
     return {
        id: baseId,
        name: '大宋风云录：熙宁变法',
        type: 'HISTORY',
        timeConfig: { system: TimeSystem.REAL }, // CHANGED TO REAL TIME
        data: generateWangAnshiPeople(),
        world: generateWangAnshiMap(),
        events: generateWangAnshiEvents(),
        keywords: generateWangAnshiLore(),
        globalAttributeKeys: ['官职', '派系', '代表作', '身份'],
        relationDefinitions: [
           { id: 'REL_KING_SUB', name: '君臣', description: '皇帝与臣子' }
        ],
        lastAccessed: new Date().toISOString(),
        isPinned: false
     };
  }

  // EMPTY
  return {
    id: baseId,
    name: '新工程',
    type: 'GENEALOGY',
    timeConfig: { system: TimeSystem.REAL },
    data: { nodes: [], links: [] },
    world: { id: `w_${baseId}`, name: '新世界', nodes: [], edges: [] },
    events: [],
    keywords: [],
    lastAccessed: new Date().toISOString(),
    isPinned: false
  };
};

export const initialProjects: Project[] = [
  getTemplateData('THREE_BODY')
];
