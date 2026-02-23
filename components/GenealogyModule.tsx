import React, { useState, useMemo, useEffect } from 'react';
import { GraphCanvas } from './GraphCanvas';
import { Sidebar } from './Sidebar';
import { Project, Person, Relationship, ViewMode, RelationType, GraphData } from '../types';

interface GenealogyModuleProps {
  currentProject: Project;
  onUpdateProject: (updatedProject: Project) => void;
  targetPersonId?: string | null;
  onJumpToCalendar?: (personId: string) => void;
  onJumpToWiki?: (keywordId: string) => void;
}

export const GenealogyModule: React.FC<GenealogyModuleProps> = ({
  currentProject,
  onUpdateProject,
  targetPersonId,
  onJumpToCalendar,
  onJumpToWiki
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.NETWORK);
  const [selectedPersonId, setSelectedPersonId] = useState<string | undefined>(undefined);
  const [selectedLinkId, setSelectedLinkId] = useState<string | undefined>(undefined);
  const [searchText, setSearchText] = useState('');
  
  // Filter States
  const [isFilterEnabled, setIsFilterEnabled] = useState(false); 
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<'STRICT' | 'KINSHIP'>('STRICT');

  // Single-use focus trigger to move camera
  const [focusTrigger, setFocusTrigger] = useState<{ id: string, timestamp: number } | null>(null);

  // Stash for restoring filter state after exiting specialized genealogy mode
  const [preGenealogyState, setPreGenealogyState] = useState<{
     enabled: boolean;
     families: string[];
     mode: 'STRICT' | 'KINSHIP';
  } | null>(null);

  // Wiki Grouping State
  const [selectedKeywordId, setSelectedKeywordId] = useState<string | null>(null);

  // Specialized Genealogy Mode
  const [isGenealogyMode, setIsGenealogyMode] = useState(false);

  const families = useMemo(() => 
    Array.from(new Set(currentProject.data.nodes.map(n => n.familyId) as string[])).sort()
  , [currentProject]);

  // Sync families when project changes
  useEffect(() => {
    setSelectedFamilies(families);
    setSelectedPersonId(undefined);
    setSelectedLinkId(undefined);
    setSelectedKeywordId(null);
    setIsFilterEnabled(false); 
    setIsGenealogyMode(false);
    setPreGenealogyState(null);
    setFocusTrigger(null);
  }, [currentProject.id]); 

  // Handle Jump Navigation
  useEffect(() => {
    if (targetPersonId) {
      setSelectedPersonId(targetPersonId);
      setSelectedLinkId(undefined);
      // Trigger focus when jumping from other modules
      setFocusTrigger({ id: targetPersonId, timestamp: Date.now() });
      setIsGenealogyMode(false);
    }
  }, [targetPersonId]);

  // If filter changes such that multiple families are selected, auto-exit genealogy mode
  useEffect(() => {
    if (selectedFamilies.length !== 1 && isGenealogyMode) {
       handleExitGenealogyMode();
    }
  }, [selectedFamilies, isGenealogyMode]);

  // Calculate Highlighted Group Nodes
  const highlightGroupIds = useMemo(() => {
     if (!selectedKeywordId) return [];
     const keyword = currentProject.keywords.find(k => k.id === selectedKeywordId);
     return keyword ? keyword.relatedPersonIds || [] : [];
  }, [selectedKeywordId, currentProject.keywords]);

  // --- Data Helpers ---
  const updateProjectData = (newData: GraphData) => {
    onUpdateProject({ ...currentProject, data: newData });
  };

  // --- Handlers ---

  const handleUpdatePerson = (p: Person) => {
    const newNodes = currentProject.data.nodes.map(n => n.id === p.id ? p : n);
    updateProjectData({ nodes: newNodes, links: currentProject.data.links });
  };

  const handleAddPerson = (p: Person) => {
    updateProjectData({ 
      nodes: [...currentProject.data.nodes, p], 
      links: currentProject.data.links 
    });
  };

  const handleDeletePerson = (id: string) => {
    const newNodes = currentProject.data.nodes.filter(n => n.id !== id);
    const newLinks = currentProject.data.links.filter(l => 
      (typeof l.source === 'object' ? (l.source as Person).id : l.source) !== id &&
      (typeof l.target === 'object' ? (l.target as Person).id : l.target) !== id
    );
    const newEvents = currentProject.events.map(evt => ({
       ...evt,
       participantIds: evt.participantIds.filter(pid => pid !== id)
    }));
    const newKeywords = currentProject.keywords.map(kw => ({
       ...kw,
       relatedPersonIds: kw.relatedPersonIds?.filter(pid => pid !== id) || []
    }));

    onUpdateProject({ 
        ...currentProject, 
        data: { nodes: newNodes, links: newLinks },
        events: newEvents,
        keywords: newKeywords
    });
    
    setSelectedPersonId(undefined);
  };
  
  // 修复此处参数类型：由 RelationType 改为 string，以匹配 Sidebar 组件的定义
  const handleAddRelation = (s: string, t: string, type: string) => {
     const newLink: Relationship = {
        id: Math.random().toString(36).substr(2,9),
        source: s, target: t, type, strength: 5
     };
     updateProjectData({
        nodes: currentProject.data.nodes,
        links: [...currentProject.data.links, newLink]
     });
  };

  const handleUpdateRelation = (link: Relationship) => {
     const newLinks = currentProject.data.links.map(l => l.id === link.id ? link : l);
     updateProjectData({ nodes: currentProject.data.nodes, links: newLinks });
  };

  const handleDeleteRelation = (id: string) => {
     const newLinks = currentProject.data.links.filter(l => l.id !== id);
     updateProjectData({ nodes: currentProject.data.nodes, links: newLinks });
     setSelectedLinkId(undefined);
  };

  const handleNodePositionChange = (p: Person) => {
     if (isGenealogyMode) return;
     const newNodes = currentProject.data.nodes.map(n => {
        if (n.id === p.id) return { ...n, x: p.x, y: p.y, fx: p.fx, fy: p.fy };
        return n;
     });
     updateProjectData({ nodes: newNodes, links: currentProject.data.links });
  };

  const handleBatchNodePositionChange = (updates: Person[]) => {
      if (isGenealogyMode) return;
      const updateMap = new Map(updates.map(u => [u.id, u]));
      const newNodes = currentProject.data.nodes.map(n => {
          if (updateMap.has(n.id)) {
              const updated = updateMap.get(n.id)!;
              return { ...n, x: updated.x, y: updated.y, fx: updated.fx, fy: updated.fy };
          }
          return n;
      });
      updateProjectData({ nodes: newNodes, links: currentProject.data.links });
  };

  const handleLayoutReset = () => {
     const newNodes = currentProject.data.nodes.map(n => ({ ...n, fx: null, fy: null }));
     updateProjectData({ nodes: newNodes, links: currentProject.data.links });
  };

  const handleViewFamilyTree = (familyId: string) => {
    // Save current state before jumping
    setPreGenealogyState({
        enabled: isFilterEnabled,
        families: [...selectedFamilies],
        mode: filterMode
    });

    setSelectedFamilies([familyId]);
    setIsFilterEnabled(true);
    setIsGenealogyMode(true);
    setSearchText('');
  };

  const handleExitGenealogyMode = () => {
     setIsGenealogyMode(false);
     
     // Restore previous state if it was stashed
     if (preGenealogyState) {
        setIsFilterEnabled(preGenealogyState.enabled);
        setSelectedFamilies(preGenealogyState.families);
        setFilterMode(preGenealogyState.mode);
        setPreGenealogyState(null);
     }
  };

  // Resolve Selection
  const selectedPerson = currentProject.data.nodes.find(n => n.id === selectedPersonId) || null;
  const selectedLink = currentProject.data.links.find(l => l.id === selectedLinkId) || null;
  const highlightId = searchText ? currentProject.data.nodes.find(n => n.name.includes(searchText))?.id : undefined;

  return (
    <div className="flex h-full w-full bg-gray-950 overflow-hidden">
      <Sidebar 
         currentProject={currentProject}
         selectedPerson={selectedPerson}
         selectedLink={selectedLink}
         onSearch={setSearchText}
         viewMode={viewMode}
         setViewMode={setViewMode}
         families={families}
         onToggleFamily={(fam) => {
            if(selectedFamilies.includes(fam)) setSelectedFamilies(prev => prev.filter(f => f !== fam));
            else setSelectedFamilies(prev => [...prev, fam]);
         }}
         selectedFamilies={selectedFamilies}
         onSetSelectedFamilies={setSelectedFamilies}
         isFilterEnabled={isFilterEnabled}
         onSetFilterEnabled={setIsFilterEnabled}
         filterMode={filterMode}
         onSetFilterMode={setFilterMode}
         keywords={currentProject.keywords}
         selectedKeywordId={selectedKeywordId}
         onSelectKeyword={setSelectedKeywordId}
         onJumpToWiki={onJumpToWiki}
         onUpdatePerson={handleUpdatePerson}
         onDeletePerson={handleDeletePerson}
         onAddPerson={handleAddPerson}
         onAddRelation={handleAddRelation}
         onUpdateRelation={handleUpdateRelation}
         onDeleteRelation={handleDeleteRelation}
         onUpdateProject={onUpdateProject}
         onSelectPerson={(id, shouldFocus) => { 
            setSelectedPersonId(id); 
            setSelectedLinkId(undefined); 
            if (shouldFocus) setFocusTrigger({ id, timestamp: Date.now() });
         }}
         onSelectLink={(id) => { setSelectedLinkId(id); setSelectedPersonId(undefined); }}
         onJumpToCalendar={onJumpToCalendar}
         isGenealogyMode={isGenealogyMode}
         onEnterGenealogyMode={() => handleViewFamilyTree(selectedFamilies[0] || '')}
         onViewFamilyTree={handleViewFamilyTree}
      />
      <div className="flex-1 h-full relative">
         <GraphCanvas 
           data={currentProject.data}
           viewMode={viewMode}
           width={window.innerWidth - 320}
           height={window.innerHeight - 48} 
           onNodeClick={(n) => { setSelectedPersonId(n.id); setSelectedLinkId(undefined); }}
           onLinkClick={(l) => { setSelectedLinkId(l.id); setSelectedPersonId(undefined); }}
           onCanvasClick={() => { setSelectedPersonId(undefined); setSelectedLinkId(undefined); }}
           selectedPersonId={selectedPersonId}
           selectedLinkId={selectedLinkId}
           focusTrigger={focusTrigger}
           highlightId={highlightId}
           highlightGroupIds={highlightGroupIds}
           filterFamily={selectedFamilies}
           isFilterEnabled={isFilterEnabled} 
           filterMode={filterMode}
           onNodePositionChange={handleNodePositionChange}
           onBatchNodePositionChange={handleBatchNodePositionChange}
           onLayoutReset={handleLayoutReset}
           customDefinitions={currentProject.relationDefinitions || []}
           isGenealogyMode={isGenealogyMode}
           onExitGenealogyMode={handleExitGenealogyMode}
         />
      </div>
    </div>
  );
};