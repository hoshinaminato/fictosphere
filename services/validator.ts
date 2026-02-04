
import { Project } from '../types';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedProject?: Project;
}

/**
 * 验证并清洗导入的工程数据
 * 容错性增强：同时支持 Project 对象和 ExportData 对象
 */
export const validateProject = (input: any): ValidationResult => {
  if (!input || typeof input !== 'object') {
    return { isValid: false, error: '导入数据无效：不是 JSON 对象' };
  }

  // 1. 处理可能的 ExportData 包装层
  let data = input.project ? input.project : input;

  // 2. 核心字段补全
  if (!data.id || typeof data.id !== 'string') {
     data.id = 'proj_' + Math.random().toString(36).substr(2, 9);
  }
  if (!data.name) {
     data.name = '未命名工程 (Imported)';
  }

  // 3. 确保子模块结构存在
  if (!data.data) data.data = { nodes: [], links: [] };
  if (!Array.isArray(data.data.nodes)) data.data.nodes = [];
  if (!Array.isArray(data.data.links)) data.data.links = [];
  
  if (!data.world) data.world = { id: `w_${data.id}`, name: 'New World', nodes: [], edges: [] };
  if (!Array.isArray(data.world.nodes)) data.world.nodes = [];
  if (!Array.isArray(data.world.edges)) data.world.edges = [];

  if (!Array.isArray(data.events)) data.events = [];
  if (!Array.isArray(data.keywords)) data.keywords = [];

  // 4. 清洗 Genealogy 节点
  data.data.nodes = data.data.nodes.filter((n: any) => n && n.id).map((n: any) => ({
     ...n,
     name: n.name || 'Unknown',
     familyId: n.familyId || 'Unknown',
     attributes: Array.isArray(n.attributes) ? n.attributes : [],
     attachments: Array.isArray(n.attachments) ? n.attachments : []
  }));

  // 5. 清洗 Links
  const nodeIds = new Set(data.data.nodes.map((n: any) => n.id));
  data.data.links = data.data.links.filter((l: any) => {
     if (!l || !l.id) return false;
     const sId = typeof l.source === 'object' ? l.source.id : l.source;
     const tId = typeof l.target === 'object' ? l.target.id : l.target;
     return nodeIds.has(sId) && nodeIds.has(tId);
  });

  // 6. 清洗 World 节点
  data.world.nodes = data.world.nodes.map((n: any) => ({
     ...n,
     x: typeof n.x === 'number' ? n.x : 0,
     y: typeof n.y === 'number' ? n.y : 0,
     floors: Array.isArray(n.floors) ? n.floors.map((f: any) => ({
        ...f,
        rooms: Array.isArray(f.rooms) ? f.rooms.map((r: any) => ({
           ...r,
           x: typeof r.x === 'number' ? r.x : 0,
           y: typeof r.y === 'number' ? r.y : 0,
           w: typeof r.w === 'number' ? r.w : 100,
           h: typeof r.h === 'number' ? r.h : 100,
           items: Array.isArray(r.items) ? r.items : []
        })) : []
     })) : []
  }));

  // 7. 清洗词条关联字段 (新增)
  data.keywords = data.keywords.map((k: any) => ({
     ...k,
     relatedPersonIds: Array.isArray(k.relatedPersonIds) ? k.relatedPersonIds : [],
     relatedLocationIds: Array.isArray(k.relatedLocationIds) ? k.relatedLocationIds : [],
     relatedEventIds: Array.isArray(k.relatedEventIds) ? k.relatedEventIds : [],
     relatedKeywordIds: Array.isArray(k.relatedKeywordIds) ? k.relatedKeywordIds : [],
     attachments: Array.isArray(k.attachments) ? k.attachments : []
  }));

  return { isValid: true, sanitizedProject: data as Project };
};
