
import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { Keyword, KeywordCategory, KeywordCategoryLabels } from '../types';
import { Box, Shield, Zap, BookOpen, MapPin, Tag } from 'lucide-react';

interface WikiTreeCanvasProps {
  rootKeyword: Keyword;
  allKeywords: Keyword[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  width: number;
  height: number;
}

export const WikiTreeCanvas: React.FC<WikiTreeCanvasProps> = ({
  rootKeyword,
  allKeywords,
  selectedId,
  onSelect,
  width,
  height
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // 转换数据为 D3 层级结构
  const hierarchyData = useMemo(() => {
    // 找出所有属于该根节点的子孙
    const familyIds = new Set<string>([rootKeyword.id]);
    const findChildren = (pid: string) => {
      allKeywords.filter(k => k.parentId === pid).forEach(child => {
        familyIds.add(child.id);
        findChildren(child.id);
      });
    };
    findChildren(rootKeyword.id);

    const relevantKeywords = allKeywords.filter(k => familyIds.has(k.id));
    
    try {
      return d3.stratify<Keyword>()
        .id(d => d.id)
        .parentId(d => d.parentId || null)
        (relevantKeywords);
    } catch (e) {
      console.error("Hierarchy construction failed", e);
      return null;
    }
  }, [rootKeyword, allKeywords]);

  useEffect(() => {
    if (!svgRef.current || !hierarchyData) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g");

    // 缩放功能
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoomBehavior);

    // 布局计算
    const treeLayout = d3.tree<Keyword>()
      .nodeSize([180, 120]); // [宽, 高] 间距

    const root = treeLayout(hierarchyData);

    // 绘制连线 (正交折线)
    g.append("g")
      .attr("fill", "none")
      .attr("stroke", "#334155")
      .attr("stroke-width", 2)
      .selectAll("path")
      .data(root.links())
      .join("path")
      .attr("d", d3.linkVertical()
        .x((d: any) => d.x)
        .y((d: any) => d.y) as any
      );

    // 绘制节点
    const node = g.append("g")
      .selectAll("g")
      .data(root.descendants())
      .join("g")
      .attr("transform", (d: any) => `translate(${d.x},${d.y})`)
      .attr("cursor", "pointer")
      .on("click", (event, d) => onSelect(d.data.id));

    // 节点背景
    node.append("rect")
      .attr("x", -70)
      .attr("y", -20)
      .attr("width", 140)
      .attr("height", 40)
      .attr("rx", 6)
      .attr("fill", (d: any) => d.data.id === selectedId ? "#1e3a8a" : "#0f172a")
      .attr("stroke", (d: any) => d.data.id === selectedId ? "#3b82f6" : "#334155")
      .attr("stroke-width", (d: any) => d.data.id === selectedId ? 2 : 1)
      .attr("class", (d: any) => d.data.id === selectedId ? "filter drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "");

    // 节点文字
    node.append("text")
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .attr("fill", (d: any) => d.data.id === selectedId ? "#fff" : "#94a3b8")
      .attr("font-size", "12px")
      .attr("font-weight", (d: any) => d.data.id === selectedId ? "bold" : "normal")
      .text((d: any) => d.data.name);

    // 类别指示条 (底部)
    node.append("rect")
      .attr("x", -70)
      .attr("y", 16)
      .attr("width", 140)
      .attr("height", 4)
      .attr("rx", 2)
      .attr("fill", (d: any) => {
          switch(d.data.category) {
            case 'FACTION': return '#3b82f6'; // Blue
            case 'ITEM': return '#10b981';    // Emerald
            case 'ABILITY': return '#f59e0b'; // Amber
            case 'GEOGRAPHY': return '#ef4444'; // Red
            case 'TERM': return '#6366f1';    // Indigo
            case 'CULTURE': return '#ec4899';  // Pink
            case 'SPECIES': return '#8b5cf6';  // Violet
            case 'HISTORY': return '#64748b';  // Slate
            case 'SYSTEM': return '#06b6d4';   // Cyan
            default: return '#94a3b8';
          }
      });

    // 初始视图居中
    const bounds = g.node()?.getBBox();
    if (bounds) {
       const initialScale = 0.8;
       const tx = width / 2 - (bounds.x + bounds.width / 2) * initialScale;
       const ty = 100; // 顶部留白
       svg.call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(initialScale));
    }

  }, [hierarchyData, selectedId, width, height]);

  return (
    <div className="w-full h-full bg-blueprint-900/50 blueprint-grid relative">
      <svg ref={svgRef} width={width} height={height} className="w-full h-full" />
      <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-md border border-gray-800 p-2 rounded text-[10px] text-gray-500 grid grid-cols-2 gap-x-4 gap-y-1">
         <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500" /> 组织/势力</div>
         <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" /> 物品/道具</div>
         <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500" /> 功法/技能</div>
         <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" /> 地理/疆域</div>
         <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-500" /> 专有名词</div>
         <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-pink-500" /> 习俗/文化</div>
         <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-violet-500" /> 种族/生物</div>
         <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-500" /> 历史/传说</div>
         <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-cyan-500" /> 体系/规则</div>
      </div>
    </div>
  );
};
