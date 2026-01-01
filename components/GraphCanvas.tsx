
import React, { useEffect, useRef, useState, useLayoutEffect, useMemo } from 'react';
import { 
  Simulation, 
  ZoomTransform, 
  zoomIdentity, 
  select, 
  zoom, 
  forceSimulation, 
  forceLink, 
  forceManyBody, 
  forceCollide, 
  forceY, 
  forceX, 
  forceCenter, 
  drag,
  pointer,
  polygonHull,
  ZoomBehavior
} from 'd3';
import { GraphData, Person, Relationship, ViewMode, RelationType, RelationLabels, RelationCategories, RelationDefinition } from '../types';
import { Unlock, BoxSelect, MousePointer2, Download, Loader2, ArrowLeft, GitGraph } from 'lucide-react';

interface GraphCanvasProps {
  data: GraphData;
  viewMode: ViewMode;
  width: number;
  height: number;
  onNodeClick: (node: Person) => void;
  onLinkClick: (link: Relationship) => void;
  onCanvasClick: () => void;
  
  selectedPersonId?: string;
  selectedLinkId?: string;
  focusTrigger?: { id: string, timestamp: number } | null;
  
  highlightId?: string; // From search
  highlightGroupIds?: string[]; // From Wiki Grouping (Bounding Box)
  
  filterFamily?: string[];
  isFilterEnabled?: boolean; 
  filterMode?: 'STRICT' | 'KINSHIP';
  
  onNodePositionChange?: (node: Person) => void;
  onBatchNodePositionChange?: (nodes: Person[]) => void;
  onLayoutReset?: () => void;

  customDefinitions?: RelationDefinition[]; 
  
  // New props for the specialized Tree view
  isGenealogyMode?: boolean;
  onExitGenealogyMode?: () => void;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  data,
  viewMode,
  width,
  height,
  onNodeClick,
  onLinkClick,
  onCanvasClick,
  selectedPersonId,
  selectedLinkId,
  focusTrigger,
  highlightId,
  highlightGroupIds = [],
  filterFamily,
  isFilterEnabled = false,
  filterMode = 'STRICT',
  onNodePositionChange,
  onBatchNodePositionChange,
  onLayoutReset,
  customDefinitions = [],
  isGenealogyMode = false,
  onExitGenealogyMode
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<SVGGElement | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const simulationRef = useRef<Simulation<Person, Relationship> | null>(null);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [isExporting, setIsExporting] = useState(false);
  
  // Explicitly type Set generic and provide generic to new Set()
  const [multiSelection, setMultiSelection] = useState<Set<string>>(new Set<string>());
  const multiSelectionRef = useRef<Set<string>>(new Set<string>()); 
  const isDragMovedRef = useRef(false);
  const [isBrushing, setIsBrushing] = useState(false);

  const onNodeClickRef = useRef(onNodeClick);
  const onLinkClickRef = useRef(onLinkClick);
  const onCanvasClickRef = useRef(onCanvasClick);
  const onNodePositionChangeRef = useRef(onNodePositionChange);
  const onBatchNodePositionChangeRef = useRef(onBatchNodePositionChange);
  const onLayoutResetRef = useRef(onLayoutReset);

  useLayoutEffect(() => {
    onNodeClickRef.current = onNodeClick;
    onLinkClickRef.current = onLinkClick;
    onCanvasClickRef.current = onCanvasClick;
    onNodePositionChangeRef.current = onNodePositionChange;
    onBatchNodePositionChangeRef.current = onBatchNodePositionChange;
    onLayoutResetRef.current = onLayoutReset;
  });

  // --- 动态家族颜色生成算法 ---
  const familyColorMap = useMemo(() => {
    const families = Array.from(new Set(data.nodes.map(n => n.familyId))).sort();
    const map = new Map<string, string>();
    families.forEach((fam, index) => {
      const hue = (index * 137.508) % 360;
      map.set(fam, `hsl(${hue}, 70%, 60%)`);
    });
    return map;
  }, [data.nodes]);

  const getFamilyColor = (familyId: string) => familyColorMap.get(familyId) || '#38bdf8';

  useEffect(() => {
    multiSelectionRef.current = multiSelection;
  }, [multiSelection]);

  // Fix: Explicitly type the updater function return to resolve 'unknown' type assignment issues during state updates.
  useEffect(() => {
    if (typeof selectedPersonId === 'string') {
       const selectedId: string = selectedPersonId;
       setMultiSelection((prev: Set<string>): Set<string> => {
          if (prev.size > 1 && prev.has(selectedId)) return prev;
          return new Set<string>([selectedId]);
       });
    }
  }, [selectedPersonId]);

  // --- Focus Camer Logic ---
  useEffect(() => {
    if (!focusTrigger || !svgRef.current || !simulationRef.current || !zoomBehaviorRef.current) return;
    
    const allNodes = simulationRef.current.nodes();
    const targetNode = allNodes.find(n => n.id === focusTrigger.id);
    
    if (targetNode && targetNode.x !== undefined && targetNode.y !== undefined) {
       const svg = select(svgRef.current);
       const targetK = 1.2; // 聚焦时的缩放倍率
       
       // 计算平移量：使节点位于视口中心
       const tx = width / 2 - targetNode.x * targetK;
       const ty = height / 2 - targetNode.y * targetK;
       
       const newTransform = zoomIdentity.translate(tx, ty).scale(targetK);
       
       // 执行过渡动画
       svg.transition()
          .duration(750)
          .call(zoomBehaviorRef.current.transform, newTransform);
    }
  }, [focusTrigger, width, height]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !target.tagName) return;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setMultiSelection(new Set(data.nodes.map(n => n.id)));
      }
      if (e.key === 'Escape') {
        if (isGenealogyMode && onExitGenealogyMode) onExitGenealogyMode();
        else {
          setMultiSelection(new Set());
          onCanvasClickRef.current();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [data.nodes, isGenealogyMode]);

  const getLinkColor = (type: string) => {
    switch (type) {
      case RelationType.PARENT: 
      case RelationType.CHILD: 
      case RelationType.GRANDPARENT: return '#9ca3af'; 
      case RelationType.ADOPTIVE_PARENT: return '#2dd4bf'; 
      case RelationType.STEP_PARENT: return '#94a3b8'; 
      case RelationType.SPOUSE: return '#ef4444'; 
      case RelationType.LOVER: return '#ec4899'; 
      case RelationType.CRUSH: return '#f9a8d4'; 
      case RelationType.LOVE_RIVAL: return '#be123c'; 
      case RelationType.EX_SPOUSE: return '#f87171'; 
      case RelationType.EX_PARTNER: return '#fda4af'; 
      case RelationType.SIBLING: 
      case RelationType.COUSIN: return '#6366f1'; 
      case RelationType.FRIEND: return '#22c55e'; 
      case RelationType.ENEMY: return '#a855f7'; 
      case RelationType.RIVAL: return '#d946ef'; 
      case RelationType.COLLEAGUE: return '#3b82f6'; 
      case RelationType.BOSS: return '#1e40af'; 
      case RelationType.MENTOR:
      case RelationType.SENIOR:
      case RelationType.STUDENT: return '#f59e0b'; 
      default: return '#e5e7eb'; 
    }
  };

  const handleExportPNG = async () => {
    if (!svgRef.current || !containerRef.current) return;
    setIsExporting(true);
    try {
      const originalSvg = svgRef.current;
      const container = containerRef.current;
      const bbox = container.getBBox();
      const padding = 100;
      const exportWidth = bbox.width + padding * 2;
      const exportHeight = bbox.height + padding * 2;
      const clone = originalSvg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('width', exportWidth.toString());
      clone.setAttribute('height', exportHeight.toString());
      clone.setAttribute('viewBox', `${bbox.x - padding} ${bbox.y - padding} ${exportWidth} ${exportHeight}`);
      const cloneContainer = clone.querySelector('g.container') as SVGGElement;
      if (cloneContainer) cloneContainer.removeAttribute('transform');
      const style = document.createElement('style');
      style.textContent = `
        text { font-family: 'JetBrains Mono', system-ui, sans-serif; }
        .primary-label { font-weight: bold; fill: #ffffff; dominant-baseline: central; }
        .time-label { fill: #9ca3af; font-size: 6px; dominant-baseline: central; }
        .name-label { font-weight: bold; fill: #e5e7eb; font-size: 10px; }
        .initial-text { fill: #ffffff; font-weight: bold; }
        .link-base { stroke-opacity: 0.8; }
        .link-label-group rect { fill: #111827; stroke-opacity: 1; }
        .node-circle { fill: #1f2937; }
        .hull { fill: rgba(34, 211, 238, 0.1); stroke: rgba(34, 211, 238, 0.4); }
        .link-flow { display: none; }
        .static-dir-arrow { opacity: 0.8; }
      `;
      clone.prepend(style);
      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('width', '100%'); bg.setAttribute('height', '100%'); bg.setAttribute('fill', '#020617'); bg.setAttribute('x', (bbox.x - padding).toString()); bg.setAttribute('y', (bbox.y - padding).toString());
      clone.prepend(bg);
      const svgData = new XMLSerializer().serializeToString(clone);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Canvas context failed");
      const scale = 2; canvas.width = exportWidth * scale; canvas.height = exportHeight * scale; ctx.scale(scale, scale);
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, exportWidth, exportHeight); ctx.drawImage(img, 0, 0);
        const pngUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a'); link.href = pngUrl; link.download = `fictosphere_relations_${Date.now()}.png`; link.click();
        URL.revokeObjectURL(url); setIsExporting(false);
      };
      img.src = url;
    } catch (err) { console.error(err); setIsExporting(false); }
  };

  const handleTidy = () => {
     if (!simulationRef.current) return;
     const allNodes = simulationRef.current.nodes();
     const selectedIds = multiSelectionRef.current;
     const targets: Person[] = [];
     if (selectedIds.size > 0) {
        allNodes.forEach(n => { if (selectedIds.has(n.id)) { n.fx = null; n.fy = null; targets.push(n); } });
     } else {
        if (onLayoutResetRef.current) onLayoutResetRef.current();
        allNodes.forEach(n => { n.fx = null; n.fy = null; });
     }
     if (selectedIds.size > 0 && targets.length > 0) {
        if (onBatchNodePositionChangeRef.current) onBatchNodePositionChangeRef.current(targets);
     }
     simulationRef.current.alpha(1).restart();
  };

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = select(svgRef.current);
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .filter((event) => !event.shiftKey && !event.button)
      .on('zoom', (event) => {
        setTransform(event.transform);
        if (containerRef.current) select(containerRef.current).attr('transform', event.transform.toString());
      });
    
    zoomBehaviorRef.current = zoomBehavior;
    svg.call(zoomBehavior).on('dblclick.zoom', null)
       .on('click', (event) => { if (!event.shiftKey) { setMultiSelection(new Set()); onCanvasClickRef.current(); } });
    
    const brushRect = svg.append('rect').attr('class', 'selection-brush').attr('fill', 'rgba(250, 204, 21, 0.1)').attr('stroke', 'rgba(250, 204, 21, 0.6)').attr('stroke-width', 1).attr('stroke-dasharray', '4').style('display', 'none').style('pointer-events', 'none'); 
    let brushStart: {x: number, y: number} | null = null;
    svg.on('mousedown', (event) => {
        if (event.shiftKey && event.button === 0) {
           event.preventDefault(); event.stopImmediatePropagation(); 
           const [x, y] = pointer(event, svg.node());
           brushStart = { x, y }; setIsBrushing(true);
           brushRect.attr('x', x).attr('y', y).attr('width', 0).attr('height', 0).style('display', 'block');
        } 
    });
    svg.on('mousemove', (event) => {
       if (brushStart) {
          const [mx, my] = pointer(event, svg.node());
          const x = Math.min(brushStart.x, mx); const y = Math.min(brushStart.y, my);
          const width = Math.abs(mx - brushStart.x); const height = Math.abs(my - brushStart.y);
          brushRect.attr('x', x).attr('y', y).attr('width', width).attr('height', height);
       }
    });
    svg.on('mouseup', (event) => {
       if (brushStart) {
          const nodes = simulationRef.current?.nodes() || [];
          const [mx, my] = pointer(event, svg.node());
          const x0 = Math.min(brushStart.x, mx); const x1 = Math.max(brushStart.x, mx);
          const y0 = Math.min(brushStart.y, my); const y1 = Math.max(brushStart.y, my);
          const t = (select(svg.node()!).property("__zoom") as ZoomTransform) || zoomIdentity;
          const wx0 = (x0 - t.x) / t.k; const wx1 = (x1 - t.x) / t.k; const wy0 = (y0 - t.y) / t.k; const wy1 = (y1 - t.y) / t.k;
          const selectedIds = new Set<string>();
          nodes.forEach(n => { if (n.x !== undefined && n.y !== undefined) { if (n.x >= wx0 && n.x <= wx1 && n.y >= wy0 && n.y <= wy1) selectedIds.add(n.id); } });
          if (selectedIds.size > 0) setMultiSelection(selectedIds);
          else if (Math.abs(mx - brushStart.x) > 5 || Math.abs(my - brushStart.y) > 5) setMultiSelection(new Set());
          brushStart = null; setIsBrushing(false); brushRect.style('display', 'none');
       }
    });
    let container = svg.select<SVGGElement>('g.container');
    if (container.empty()) {
      container = svg.append<SVGGElement>('g').attr('class', 'container');
      container.append('g').attr('class', 'hull-layer');
      container.append('g').attr('class', 'link-layer');
      container.append('g').attr('class', 'node-layer');
    }
    containerRef.current = container.node();
    if (svg.select('defs').empty()) svg.append('defs');
  }, []);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    const svg = select(svgRef.current); const container = select(containerRef.current);
    const hullLayer = container.select('.hull-layer'); const linkLayer = container.select('.link-layer'); const nodeLayer = container.select('.node-layer');
    hullLayer.lower();
    const defs = svg.select<SVGDefsElement>('defs');
    const usedTypes = new Set(data.links.map(l => String(l.type)));
    const allTypes = Array.from(new Set([...Object.values(RelationType), ...Array.from(usedTypes)])) as string[];
    
    allTypes.forEach(type => {
      const safeId = type.replace(/[^a-zA-Z0-9-_]/g, ''); 
      const markerId = `arrow-${safeId}`;
      if (defs.select(`#${markerId}`).empty()) {
        defs.append('marker')
            .attr('id', markerId)
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 24) 
            .attr('refY', 0)
            .attr('markerWidth', 5)
            .attr('markerHeight', 5)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', getLinkColor(type));
      }
    });

    const oldNodes = simulationRef.current?.nodes() || []; const oldNodesMap = new Map<string, Person>(oldNodes.map(n => [n.id, n]));
    let nodes = data.nodes.map(d => {
       const newNode = { ...d }; const old = oldNodesMap.get(d.id);
       if (old) { 
          newNode.x = old.x; newNode.y = old.y; newNode.vx = old.vx; newNode.vy = old.vy; 
          if (!isGenealogyMode) {
            if (old.fx !== null && old.fx !== undefined) newNode.fx = old.fx; 
            if (old.fy !== null && old.fy !== undefined) newNode.fy = old.fy; 
          } else {
            newNode.fx = null; newNode.fy = null;
          }
       } else if (isGenealogyMode) {
          newNode.fx = null; newNode.fy = null;
       }
       return newNode;
    });
    let links = data.links.map(d => ({ ...d }));

    const calculatedGens = new Map<string, number>();
    if (isGenealogyMode) {
        const childToParents = new Map<string, string[]>();
        const parentToChildren = new Map<string, string[]>();
        const spousePairs = new Map<string, string[]>();
        links.forEach(l => {
           const sId = typeof l.source === 'object' ? (l.source as Person).id : l.source as string;
           const tId = typeof l.target === 'object' ? (l.target as Person).id : l.target as string;
           if (l.type === RelationType.PARENT) {
              if (!childToParents.has(sId)) childToParents.set(sId, []);
              childToParents.get(sId)!.push(tId);
              if (!parentToChildren.has(tId)) parentToChildren.set(tId, []);
              parentToChildren.get(tId)!.push(sId);
           } else if (l.type === RelationType.SPOUSE) {
              if (!spousePairs.has(sId)) spousePairs.set(sId, []);
              spousePairs.get(sId)!.push(tId);
              if (!spousePairs.has(tId)) spousePairs.set(tId, []);
              spousePairs.get(tId)!.push(sId);
           }
        });
        const findGen = (id: string, visited = new Set<string>()): number => {
            if (calculatedGens.has(id)) return calculatedGens.get(id)!;
            if (visited.has(id)) return 0;
            visited.add(id);
            const parents = childToParents.get(id) || [];
            if (parents.length === 0) {
                const spouses = spousePairs.get(id) || [];
                for(const sid of spouses) { if (calculatedGens.has(sid)) return calculatedGens.get(sid)!; }
                return 0;
            }
            return Math.max(...parents.map(pid => findGen(pid, visited))) + 1;
        };
        nodes.forEach(n => { calculatedGens.set(n.id, findGen(n.id)); });
        links.forEach(l => {
            if (l.type === RelationType.SPOUSE) {
               const sId = typeof l.source === 'object' ? (l.source as Person).id : l.source as string;
               const tId = typeof l.target === 'object' ? (l.target as Person).id : l.target as string;
               const maxG = Math.max(calculatedGens.get(sId) || 0, calculatedGens.get(tId) || 0);
               calculatedGens.set(sId, maxG); calculatedGens.set(tId, maxG);
            }
        });
    }

    if (isFilterEnabled && filterFamily && filterFamily.length > 0) {
      const seedNodeIds = nodes.filter(n => filterFamily.includes(n.familyId)).map(n => n.id);
      const customKinshipNames = customDefinitions.filter(d => d.isKinship).map(d => d.name);
      const bloodKinshipTypes = new Set<string>([RelationType.PARENT, RelationType.CHILD, RelationType.SIBLING, RelationType.GRANDPARENT, RelationType.COUSIN]);
      const activeKinshipTypes = filterMode === 'STRICT' ? bloodKinshipTypes : new Set<string>([...RelationCategories.KINSHIP.types.map(t => String(t)), ...customKinshipNames]);
      const adj: Record<string, string[]> = {}; 
      nodes.forEach(n => adj[n.id] = []);
      data.links.forEach(link => {
          if (activeKinshipTypes.has(String(link.type))) {
              const sId = typeof link.source === 'object' ? (link.source as Person).id : link.source as string;
              const tId = typeof link.target === 'object' ? (link.target as Person).id : link.target as string;
              if (adj[sId]) adj[sId].push(tId); if (adj[tId]) adj[tId].push(sId);
          }
      });
      const visited = new Set<string>(seedNodeIds); const queue = [...seedNodeIds];
      while (queue.length > 0) { 
          const currentId = queue.shift()!; const neighbors = adj[currentId] || []; 
          for (const neighborId of neighbors) { if (!visited.has(neighborId)) { visited.add(neighborId); queue.push(neighborId); } } 
      }
      nodes = nodes.filter(n => visited.has(n.id));
      const nodeIds = new Set(nodes.map(n => n.id));
      links = links.filter(l => nodeIds.has(typeof l.source === 'object' ? (l.source as Person).id : l.source as string) && nodeIds.has(typeof l.target === 'object' ? (l.target as Person).id : l.target as string));
    }

    links.sort((a, b) => {
      const sA = typeof a.source === 'object' ? (a.source as Person).id : a.source; const sB = typeof b.source === 'object' ? (b.source as Person).id : b.source; if (sA > sB) return 1; if (sA < sB) return -1;
      const tA = typeof a.target === 'object' ? (a.target as Person).id : a.target; const tB = typeof b.target === 'object' ? (b.target as Person).id : b.target; if (tA > tB) return 1; if (tA < tB) return -1; return 0;
    });
    const linkGroups: Record<string, number> = {};
    links.forEach(link => {
      const sId = typeof link.source === 'object' ? (link.source as Person).id : link.source as string;
      const tId = typeof link.target === 'object' ? (link.target as Person).id : link.target as string;
      const key = sId < tId ? `${sId}-${tId}` : `${tId}-${sId}`;
      if (!linkGroups[key]) linkGroups[key] = 0; link.linkNum = linkGroups[key]; linkGroups[key]++;
    });
    links.forEach(link => {
      const sId = typeof link.source === 'object' ? (link.source as Person).id : link.source as string;
      const tId = typeof link.target === 'object' ? (link.target as Person).id : link.target as string;
      const key = sId < tId ? `${sId}-${tId}` : `${tId}-${sId}`; link.linkCount = linkGroups[key];
    });
    
    if (simulationRef.current) simulationRef.current.stop();
    const simulation = forceSimulation<Person, Relationship>(nodes).velocityDecay(0.8) 
      .force('link', forceLink<Person, Relationship>(links).id(d => d.id).distance(100).strength(1))
      .force('charge', forceManyBody().strength(-150).distanceMax(250))
      .force('collide', forceCollide().radius(45).iterations(2));
    
    if (isGenealogyMode) {
      simulation.force('y', forceY((d: any) => (calculatedGens.get(d.id) || 0) * 160).strength(1.2))
                .force('x', forceX(width / 2).strength(0.05))
                .force('charge', forceManyBody().strength(-800).distanceMax(1000))
                .force('center', null);
    } else if (viewMode === ViewMode.TREE) {
      simulation.force('y', forceY((d: any) => (d.generation || 0) * 150).strength(0.8)).force('x', forceX<Person>(d => { const offset = d.familyId.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) % 5; return (offset - 2) * 200; }).strength(0.2)).force('charge', forceManyBody().strength(-500).distanceMax(500)); 
    } else {
      simulation.force('center', forceCenter(width / 2, height / 2).strength(0.05)).force('x', null).force('y', null);
    }
    
    if (oldNodes.length > 0) simulation.alpha(0.1).restart(); else simulation.alpha(1).restart();
    simulationRef.current = simulation;
    const hullPath = hullLayer.selectAll('path.hull').data(highlightGroupIds.length > 0 ? [highlightGroupIds] : []).join('path').attr('class', 'hull').attr('fill', 'rgba(34, 211, 238, 0.1)').attr('stroke', 'rgba(34, 211, 238, 0.4)').attr('stroke-width', 40).attr('stroke-linejoin', 'round').attr('stroke-opacity', 0.3).attr('opacity', 0);
    if (highlightGroupIds.length > 0) hullPath.transition().duration(500).attr('opacity', 1); else hullPath.attr('opacity', 0);
    const linkGroup = linkLayer.selectAll<SVGGElement, Relationship>('g.link-group').data(links, (d: any) => d.id).join(enter => {
          const g = enter.append('g').attr('class', 'link-group'); g.append('path').attr('class', 'link-base').attr('fill', 'none').attr('stroke-dasharray', '5, 5'); g.append('path').attr('class', 'link-flow flow-line').attr('fill', 'none').attr('stroke', '#3b82f6').attr('stroke-width', 4).attr('stroke-linecap', 'round').attr('stroke-dasharray', '0, 20').attr('opacity', 0.9); g.append('path').attr('class', 'link-hit').attr('fill', 'none').attr('stroke', 'transparent').attr('stroke-width', 15).attr('cursor', 'pointer');
          g.append('path').attr('class', 'static-dir-arrow').attr('fill-opacity', 0.8).attr('stroke', 'none');
          const labelG = g.append('g').attr('class', 'link-label-group').attr('cursor', 'pointer'); labelG.append('rect').attr('rx', 4).attr('ry', 4).attr('fill', '#1f2937').attr('stroke-opacity', 0.8); labelG.append('text').attr('class', 'primary-label').attr('text-anchor', 'middle').attr('dominant-baseline', 'central').attr('font-size', '8px').attr('fill', '#e5e7eb').attr('pointer-events', 'none'); labelG.append('text').attr('class', 'time-label').attr('text-anchor', 'middle').attr('dominant-baseline', 'central').attr('font-size', '6px').attr('fill', '#9ca3af').attr('pointer-events', 'none'); 
          return g;
        }
      );
    linkGroup.select('.link-hit').on('click', (event, d: any) => { event.stopPropagation(); onLinkClickRef.current(d); });
    linkGroup.select('.link-label-group').on('click', (event, d: any) => { event.stopPropagation(); onLinkClickRef.current(d); });
    linkGroup.select('.link-base').attr('stroke', (d: any) => d.id === selectedLinkId ? '#facc15' : getLinkColor(String(d.type))).attr('stroke-width', (d: any) => d.id === selectedLinkId ? 3 : Math.max(1, Math.sqrt(d.strength) / 1.5)).attr('marker-end', (d: any) => `url(#arrow-${d.type.replace(/[^a-zA-Z0-9-_]/g, '')})`);
    linkGroup.select('.static-dir-arrow').attr('fill', (d: any) => getLinkColor(String(d.type)));
    linkGroup.select('rect').attr('stroke', (d: any) => getLinkColor(String(d.type))).attr('stroke-width', 1.5);
    linkGroup.select('.link-label-group .primary-label').text((d: any) => RelationLabels[d.type] || d.type);
    linkGroup.select('.link-label-group .time-label').text((d: any) => { if (d.displayDate) return d.displayDate; const s = d.startDate?.trim(); const e = d.endDate?.trim(); if (!s && !e) return ""; if (s && e) { if (s === e) return s; return `${s} ~ ${e}`; } if (s) return `${s} ~`; if (e) return `~ ${e}`; return ""; });
    linkGroup.each(function(d: any) {
        const g = select(this); const pLabel = g.select('.primary-label'); const tLabel = g.select('.time-label'); const rect = g.select('rect');
        try {
          const pb = (pLabel.node() as SVGTextElement).getBBox(); const tb = (tLabel.node() as SVGTextElement).getBBox(); const hasTime = !!tLabel.text();
          const w = Math.max(pb.width, tb.width) + 8; const h = hasTime ? (pb.height + tb.height + 8) : (pb.height + 6);
          rect.attr('width', w).attr('height', h).attr('x', - w / 2).attr('y', - h / 2);
          if (hasTime) { pLabel.attr('y', -4); tLabel.attr('y', 6); } else { pLabel.attr('y', 0); }
          d.labelWidth = w; d.labelHeight = h;
        } catch(e) { rect.attr('width', 30).attr('height', 12).attr('x', -15).attr('y', -6); d.labelWidth = 30; d.labelHeight = 12; }
    });
    const node = nodeLayer.selectAll<SVGGElement, Person>('g.node').data(nodes, (d: any) => d.id).join(enter => {
          const g = enter.append('g').attr('class', 'node').attr('cursor', 'pointer'); g.attr('transform', d => d.x && d.y ? `translate(${d.x},${d.y})` : ''); g.append('circle').attr('class', 'selection-ring').attr('r', 28).attr('fill', 'none').attr('stroke', '#fbbf24').attr('stroke-width', 0).attr('opacity', 0);
          g.append('clipPath').attr('id', d => `clip-${d.id}`).append('circle').attr('r', 20); g.append('circle').attr('class', 'node-circle').attr('r', 20).attr('fill', '#1f2937').attr('stroke-width', 2);
          g.append('image').attr('xlink:href', d => d.avatar || '').attr('x', -20).attr('y', -20).attr('width', 40).attr('height', 40).attr('clip-path', d => `url(#clip-${d.id})`).attr('preserveAspectRatio', 'xMidYMid slice').style('display', d => d.avatar ? 'block' : 'none');
          g.append('text').attr('dy', 5).attr('dx', 0).attr('text-anchor', 'middle').attr('fill', '#fff').attr('font-size', '12px').attr('font-weight', 'bold').attr('class', 'initial-text').text(d => d.name.charAt(0)).style('display', d => d.avatar ? 'none' : 'block');
          g.append('text').attr('dy', 35).attr('text-anchor', 'middle').attr('fill', '#e5e7eb').attr('font-size', '10px').attr('class', 'name-label').text(d => d.name); return g;
        }, update => { update.select('image').attr('xlink:href', d => d.avatar || '').style('display', d => d.avatar ? 'block' : 'none'); update.select('.initial-text').text(d => d.name.charAt(0)).style('display', d => d.avatar ? 'none' : 'block'); update.select('.name-label').text(d => d.name); return update; }
      )
      .on('click', (event, d: any) => { 
         if (event.defaultPrevented || isDragMovedRef.current) return; 
         event.stopPropagation(); const isShift = event.shiftKey; const currentSelection = multiSelectionRef.current;
         if (isShift) setMultiSelection(prev => { const newSet = new Set(prev); if(newSet.has(d.id)) newSet.delete(d.id); else newSet.add(d.id); return newSet; });
         else { if (currentSelection.has(d.id) && currentSelection.size > 1) return; setMultiSelection(new Set([d.id])); onNodeClickRef.current(d); }
         isDragMovedRef.current = false;
      });
    const dragBehavior = drag<SVGGElement, Person>().on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.01).restart(); 
        isDragMovedRef.current = false;
        const curSel = multiSelectionRef.current; const isSelected = curSel.has(d.id); const isShift = event.sourceEvent.shiftKey;
        if (isShift) { let nSel = new Set(curSel); if (!isSelected) nSel.add(d.id); setMultiSelection(nSel); multiSelectionRef.current = nSel; simulation.nodes().forEach(n => { if (nSel.has(n.id)) { n.fx = n.x; n.fy = n.y; } }); }
        else { if (isSelected) simulation.nodes().forEach(n => { if (curSel.has(n.id)) { n.fx = n.x; n.fy = n.y; } }); else { d.fx = d.x; d.fy = d.y; } }
      })
      .on('drag', (event, d) => {
        isDragMovedRef.current = true; const dx = event.dx; const dy = event.dy; const curSel = multiSelectionRef.current;
        if (curSel.has(d.id)) simulation.nodes().forEach(n => { if (curSel.has(n.id)) { if (n.fx != null) n.fx += dx; if (n.fy != null) n.fy += dy; } });
        else { if (d.fx != null) d.fx != null ? d.fx += dx : d.fx = d.x + dx; if (d.fy != null) d.fy != null ? d.fy += dy : d.fy = d.y + dy; }
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        if (isDragMovedRef.current) {
            const curSel = multiSelectionRef.current;
            if (curSel.has(d.id)) { const moved = simulation.nodes().filter(n => curSel.has(n.id)); if (onBatchNodePositionChangeRef.current) onBatchNodePositionChangeRef.current(moved); }
            else { if (onBatchNodePositionChangeRef.current) onBatchNodePositionChangeRef.current([d]); }
        }
      });
    node.call(dragBehavior);
    const getPathString = (d: any) => {
        const s = d.source as Person; const t = d.target as Person; if (!s.x || !s.y || !t.x || !t.y) return '';
        const c = d.linkCount || 1; const n = d.linkNum || 0; const sw = s.id > t.id; const x1 = sw ? t.x : s.x; const y1 = sw ? t.y : s.y; const x2 = sw ? s.x : t.x; const y2 = sw ? s.y : t.y;
        const midX = (x1 + x2) / 2; const midY = (y1 + y2) / 2; const isStr = c === 1 || (c % 2 === 1 && n === (c - 1) / 2); if (isStr) return `M${s.x},${s.y} L${t.x},${t.y}`;
        const dx = x2 - x1; const dy = y2 - y1; const dist = Math.sqrt(dx*dx + dy*dy) || 0.001; const perpX = dy / dist; const perpY = -dx / dist;
        const cpx = midX + perpX * (n - (c - 1) / 2) * 45; const cpy = midY + perpY * (n - (c - 1) / 2) * 45;
        return `M${s.x},${s.y} Q${cpx},${cpy} ${t.x},${t.y}`;
    };
    simulation.on('tick', () => {
      linkGroup.select('.link-base').attr('d', getPathString); linkGroup.select('.link-flow').attr('d', getPathString); linkGroup.select('.link-hit').attr('d', getPathString);
      links.forEach((d: any) => { 
          const s = d.source as Person; const t = d.target as Person; if (!s.x || !s.y || !t.x || !t.y) return;
          const c = d.linkCount || 1; const n = d.linkNum || 0; const sw = s.id > t.id; const x1 = sw ? t.x : s.x; const y1 = sw ? t.y : s.y; const x2 = sw ? s.x : t.x; const y2 = sw ? s.y : t.y;
          const midX = (x1 + x2) / 2; const midY = (y1 + y2) / 2; const isStr = c === 1 || (c % 2 === 1 && n === (c - 1) / 2);
          if (isStr) { d.labelX = midX; d.labelY = midY; d.angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI; } 
          else {
              const dx = x2 - x1; const dy = y2 - y1; const dist = Math.sqrt(dx*dx + dy*dy) || 0.001; const perpX = dy / dist; const perpY = -dx / dist;
              const cpx = midX + perpX * (n - (c - 1) / 2) * 45; const cpy = midY + perpY * (n - (c - 1) / 2) * 45;
              d.labelX = 0.25 * x1 + 0.5 * cpx + 0.25 * x2; d.labelY = 0.25 * y1 + 0.5 * cpy + 0.25 * y2;
              const tx = 0.5 * (cpx - x1) + 0.5 * (x2 - cpx); const ty = 0.5 * (cpy - y1) + 0.5 * (y2 - cpy);
              d.angle = Math.atan2(ty, tx) * 180 / Math.PI;
          }
      });
      linkGroup.select('.static-dir-arrow').attr('d', 'M -4,-3 L 4,0 L -4,3 Z').attr('transform', (d: any) => `translate(${d.labelX}, ${d.labelY}) rotate(${d.angle})`);
      if (links.length < 300) {
          for(let k=0; k<2; k++) {
              for(let i=0; i<links.length; i++) {
                  for(let j=i+1; j<links.length; j++) {
                      const l1: any = links[i]; const l2: any = links[j]; const dx = l1.labelX - l2.labelX; const dy = l1.labelY - l2.labelY; if (Math.abs(dx) > 100 || Math.abs(dy) > 50) continue;
                      const w1 = l1.labelWidth || 30; const h1 = l1.labelHeight || 16; const w2 = l2.labelWidth || 30; const h2 = l2.labelHeight || 16;
                      const ox = (w1 + w2)/2 - Math.abs(dx); const oy = (h1 + h2)/2 - Math.abs(dy);
                      if (ox > 0 && oy > 0) { if (ox < oy) { const sign = dx > 0 ? 1 : -1; l1.labelX += sign * (ox + 2) / 2; l2.labelX -= sign * (ox + 2) / 2; } else { const sign = dy > 0 ? 1 : -1; l1.labelY += sign * (oy + 2) / 2; l2.labelY -= sign * (oy + 2) / 2; } }
                  }
              }
          }
      }
      linkGroup.select('.link-label-group').attr('transform', (d: any) => `translate(${d.labelX}, ${d.labelY})`);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
      if (highlightGroupIds.length > 0) {
          const gn = nodes.filter(n => highlightGroupIds.includes(n.id));
          if (gn.length > 0) {
              const pts: [number, number][] = gn.map(n => [n.x || 0, n.y || 0]);
              if (pts.length === 1) { const [x, y] = pts[0]; const r = 10; hullPath.attr('d', `M ${x},${y} m -${r},0 a ${r},${r} 0 1,0 ${2*r},0 a ${r},${r} 0 1,0 -${2*r},0`); }
              else if (pts.length === 2) { const [p1, p2] = pts; hullPath.attr('d', `M${p1[0]},${p1[1]} L${p2[0]},${p2[1]}`); }
              else { const h = polygonHull(pts); if (h) hullPath.attr('d', `M${h.map(pt => pt[0] + ',' + pt[1]).join('L')}Z`); else hullPath.attr('d', ''); }
          } else hullPath.attr('d', '');
      } else hullPath.attr('d', '');
    });
    return () => { if (simulationRef.current) simulationRef.current.stop(); };
  }, [data, viewMode, width, height, filterFamily, isFilterEnabled, filterMode, highlightGroupIds, customDefinitions, isGenealogyMode, familyColorMap]); 

  useEffect(() => {
    if (!containerRef.current) return;
    const container = select(containerRef.current); const nodeLayer = container.select('.node-layer'); const linkLayer = container.select('.link-layer');
    let focusId = multiSelection.size === 1 ? Array.from(multiSelection)[0] : (multiSelection.size === 0 ? selectedPersonId : null);
    const cn = new Set<string>(); const cl = new Set<string>(); const batch = multiSelection.size > 1;
    if (focusId) { cn.add(focusId); data.links.forEach(l => { const s = typeof l.source === 'object' ? (l.source as Person).id : l.source as string; const t = typeof l.target === 'object' ? (l.target as Person).id : l.target as string; if (s === focusId || t === focusId) { cl.add(l.id); cn.add(s); cn.add(t); } }); }
    if (selectedLinkId) { cl.add(selectedLinkId); const link = data.links.find(l => l.id === selectedLinkId); if (link) { const s = typeof link.source === 'object' ? (link.source as Person).id : link.source as string; const t = typeof link.target === 'object' ? (link.target as Person).id : link.target as string; cn.add(s); cn.add(t); } }
    const dim = (!!focusId || !!selectedLinkId) && !batch;
    nodeLayer.selectAll<SVGGElement, Person>('g.node').transition().duration(300).attr('opacity', (d: Person) => { if (dim) return cn.has(d.id) ? 1 : 0.15; if (highlightGroupIds && highlightGroupIds.length > 0 && !highlightGroupIds.includes(d.id)) return 0.3; return 1; });
    nodeLayer.selectAll<SVGGElement, Person>('g.node').select<SVGCircleElement>('.node-circle').attr('stroke', (d: Person) => { if (multiSelection.has(d.id) || (multiSelection.size === 0 && d.id === focusId) || d.id === highlightId) return '#facc15'; return getFamilyColor(d.familyId); }).attr('stroke-width', d => (multiSelection.has(d.id) || (multiSelection.size === 0 && d.id === focusId) || d.id === highlightId) ? 4 : 2);
    nodeLayer.selectAll<SVGGElement, Person>('g.node .selection-ring').transition().duration(200).attr('stroke-width', d => multiSelection.has(d.id) ? 4 : 0).attr('opacity', d => multiSelection.has(d.id) ? 0.6 : 0).attr('r', d => multiSelection.has(d.id) ? 28 : 20);
    linkLayer.selectAll<SVGGElement, Relationship>('g.link-group').transition().duration(300).attr('opacity', (d: any) => (!dim || cl.has(d.id)) ? 1 : 0.05);
    linkLayer.selectAll<SVGPathElement, Relationship>('.link-base').attr('stroke', (d: any) => d.id === selectedLinkId ? '#facc15' : getLinkColor(String(d.type))).attr('stroke-width', (d: any) => d.id === selectedLinkId ? 3 : Math.max(1, Math.sqrt(d.strength) / 1.5));
  }, [highlightId, selectedPersonId, selectedLinkId, data, multiSelection, highlightGroupIds, getFamilyColor]); 

  return (
    <div 
      className={`w-full h-full overflow-hidden blueprint-grid relative select-none transition-colors duration-500 ${isGenealogyMode ? 'bg-gray-950 border-4 border-blue-900/20' : 'bg-gray-950'}`}
      style={{ backgroundPosition: `${transform.x}px ${transform.y}px`, backgroundSize: `${40 * transform.k}px ${40 * transform.k}px` }}
    >
      {isGenealogyMode && (
          <div className="absolute top-4 left-4 z-50 animate-fade-in">
             <button 
                onClick={onExitGenealogyMode}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg shadow-2xl flex items-center gap-2 font-bold transition-all active:scale-95 border border-blue-400"
             >
                <ArrowLeft size={18}/> 退出族谱模式
             </button>
          </div>
      )}

      {isGenealogyMode && (
         <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none text-center">
            <div className="bg-blue-900/40 backdrop-blur-md border border-blue-500/50 px-6 py-2 rounded-full shadow-2xl animate-slide-in-top">
               <h2 className="text-blue-400 font-bold tracking-widest flex items-center gap-2">
                  <GitGraph size={16}/> {filterFamily?.[0]} · 族谱树视图
               </h2>
               <p className="text-[10px] text-gray-500 mt-0.5">辈分已自动计算 · 拖拽不会改变原始坐标</p>
            </div>
         </div>
      )}

      <svg ref={svgRef} width={width} height={height} className={`block w-full h-full ${isBrushing ? 'cursor-crosshair' : 'cursor-default'}`} />
      
      {!isGenealogyMode && (
      <div className="absolute top-4 right-4 flex flex-col gap-2 pointer-events-none">
          <div className="bg-gray-900/90 text-gray-300 text-xs p-2.5 rounded border border-gray-700 shadow-xl backdrop-blur flex flex-col gap-1">
             <div className="flex items-center gap-2 font-bold text-blue-400 mb-1"><MousePointer2 size={14} /> 操作指南</div>
             <div className="flex items-center gap-2"><span className="bg-gray-800 border border-gray-600 px-1.5 rounded text-[10px] font-mono">Shift</span><span>+</span><span className="flex items-center gap-1"><BoxSelect size={12}/> 拖拽</span><span className="opacity-60">框选</span></div>
             <div className="flex items-center gap-2"><span className="bg-gray-800 border border-gray-600 px-1.5 rounded text-[10px] font-mono">Drag</span><span className="opacity-60">移动 (不选中)</span></div>
             <div className="flex items-center gap-2"><span className="bg-gray-800 border border-gray-600 px-1.5 rounded text-[10px] font-mono">Click</span><span className="opacity-60">选中</span></div>
             <div className="flex items-center gap-2"><span className="bg-gray-800 border border-gray-600 px-1.5 rounded text-[10px] font-mono">Ctrl + A</span><span className="opacity-60">全选</span></div>
          </div>
      </div>
      )}

      <div className="absolute bottom-4 right-4 flex items-center gap-4 text-xs text-gray-500 pointer-events-none select-none">
         <button 
           onClick={handleExportPNG}
           disabled={isExporting}
           className="pointer-events-auto flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded border border-blue-400/30 shadow-lg transition-all active:scale-95 disabled:opacity-50"
           title="导出当前图谱为PNG图片"
         >
            {isExporting ? <Loader2 size={14} className="animate-spin"/> : <Download size={14}/>} 
            {isExporting ? "导出中..." : "导出图片"}
         </button>

         {!isGenealogyMode && (
           <>
             <button onClick={() => setMultiSelection(new Set(data.nodes.map(n => n.id)))} className="pointer-events-auto flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-3 py-1.5 rounded border border-gray-600 shadow-lg transition-colors"><BoxSelect size={14}/> 全选</button>
             <button onClick={handleTidy} className="pointer-events-auto flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-3 py-1.5 rounded border border-gray-600 shadow-lg transition-colors" title={multiSelection.size > 0 ? "释放选中节点的固定位置" : "释放所有固定节点，重置布局"}><Unlock size={14}/> {multiSelection.size > 0 ? "释放选中" : "释放全部"}</button>
           </>
         )}
        <span className={`px-2 py-1 rounded font-bold ${multiSelection.size > 1 ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-700' : 'bg-gray-900/50'}`}>选中: {multiSelection.size} / {data.nodes.length}</span>
      </div>
    </div>
  );
};