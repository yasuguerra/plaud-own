import React, { useState, useEffect } from "react";
import { ZoomIn, ZoomOut, HelpCircle, Network, Info, Sparkles, Folder, Activity, Compass } from "lucide-react";
import { MindMapNode } from "../types";

interface MindMapCanvasProps {
  rootNode: MindMapNode;
  onAskAI?: (prompt: string) => void;
}

export default function MindMapCanvas({ rootNode, onAskAI }: MindMapCanvasProps) {
  const [selectedNode, setSelectedNode] = useState<MindMapNode | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [collapsedTopics, setCollapsedTopics] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Select the root node by default
    setSelectedNode(rootNode);
  }, [rootNode]);

  // Handle toggling branch collapse
  const toggleTopic = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedTopics(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const width = 850;
  const height = 480;

  const topics = rootNode.children || [];
  const totalTopics = topics.length;

  const nodes: Array<{
    node: MindMapNode;
    tier: number;
    x: number;
    y: number;
    width: number;
    height: number;
    parentId?: string;
  }> = [];

  const connections: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color?: string;
  }> = [];

  // Define dimensions for cards
  const rootWidth = 160;
  const rootHeight = 65;
  const topicWidth = 170;
  const topicHeight = 70;
  const subtopicWidth = 160;
  const subtopicHeight = 60;

  // 1. Root Coordinates (Middle left)
  const rootX = 95;
  const rootY = height / 2;
  const rootNodeId = rootNode.id;
  
  nodes.push({ 
    node: rootNode, 
    tier: 0, 
    x: rootX, 
    y: rootY, 
    width: rootWidth, 
    height: rootHeight 
  });

  // 2. Position Topics and build Sub-topics
  topics.forEach((topic, topicIdx) => {
    const isTopicCollapsed = collapsedTopics[topic.id];

    // Compute Y for this topic block symmetrically
    const numTopicSlots = totalTopics + 1;
    const topicY = (height / numTopicSlots) * (topicIdx + 1);
    const topicX = 335;
    
    nodes.push({ 
      node: topic, 
      tier: 1, 
      x: topicX, 
      y: topicY, 
      width: topicWidth, 
      height: topicHeight, 
      parentId: rootNodeId 
    });
    
    // Connect Root right boundary to Topic left boundary
    connections.push({ 
      x1: rootX + rootWidth / 2, 
      y1: rootY, 
      x2: topicX - topicWidth / 2, 
      y2: topicY, 
      color: topic.color || "#6366f1" 
    });

    if (!isTopicCollapsed && topic.children && topic.children.length > 0) {
      const subtopics = topic.children;
      const totalSubtopics = subtopics.length;
      
      subtopics.forEach((sub, subIdx) => {
        // Space subtopics symmetrically around the topic's Y coordinate
        const range = totalSubtopics > 1 ? 140 : 0;
        let subY = topicY;
        if (totalSubtopics > 1) {
          const step = range / (totalSubtopics - 1);
          subY = topicY - range / 2 + step * subIdx;
        }

        const subX = 585;
        nodes.push({ 
          node: sub, 
          tier: 2, 
          x: subX, 
          y: subY, 
          width: subtopicWidth, 
          height: subtopicHeight, 
          parentId: topic.id 
        });
        
        // Connect Topic right boundary to Subtopic left boundary
        connections.push({ 
          x1: topicX + topicWidth / 2, 
          y1: topicY, 
          x2: subX - subtopicWidth / 2, 
          y2: subY, 
          color: topic.color || "#6366f1" 
        });
      });
    }
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex flex-col xl:flex-row gap-5 h-full" id="mind-map-component">
      {/* Play Stage */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Stage controls bar */}
        <div className="flex items-center justify-between border-b border-slate-50 pb-2 mb-3">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-indigo-500 animate-pulse" />
            <h2 className="font-sans text-xs font-bold text-slate-800 uppercase tracking-wider">Lienzo Conceptual de Ideas</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setZoomScale(prev => Math.max(prev - 0.1, 0.6))}
              className="p-1 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              title="Alejar"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={() => setZoomScale(prev => Math.min(prev + 0.1, 1.4))}
              className="p-1 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              title="Acercar"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 border border-slate-100 rounded-xl relative overflow-hidden bg-slate-50/40 min-h-[380px]">
          <div 
            className="w-full h-full relative transition-transform duration-150 origin-center p-4 flex items-center justify-center"
            style={{ transform: `scale(${zoomScale})` }}
          >
            {/* SVG Background Layer for organic curved paths */}
            <svg 
              viewBox={`0 0 ${width} ${height}`} 
              className="absolute inset-0 w-full h-full pointer-events-none select-none z-0"
            >
              {connections.map((conn, idx) => {
                const midX = (conn.x1 + conn.x2) / 2;
                // Cubic Bezier curve for highly organic flow lines
                const pathData = `M ${conn.x1} ${conn.y1} C ${midX} ${conn.y1}, ${midX} ${conn.y2}, ${conn.x2} ${conn.y2}`;
                return (
                  <path
                    key={`conn-${idx}`}
                    d={pathData}
                    fill="none"
                    stroke={conn.color}
                    strokeWidth="2"
                    strokeOpacity="0.4"
                    strokeDasharray="4 3"
                    className="transition-all duration-300"
                  />
                );
              })}
            </svg>

            {/* HTML Nodes overlaying the curved lines */}
            <div className="absolute inset-0 w-full h-full z-10 pointer-events-none">
              <div className="relative w-full h-full" style={{ width: `${width}px`, height: `${height}px`, margin: '0 auto' }}>
                {nodes.map(({ node, tier, x, y, width: cardWidth, height: cardHeight }) => {
                  const isSelected = selectedNode?.id === node.id;
                  const hasChildren = node.children && node.children.length > 0;
                  const isCollapsed = collapsedTopics[node.id];
                  
                  // Setup styles
                  let cardStyles = "";
                  let leftBorderColor = node.color || "#6366f1";
                  let nodeIcon = <Activity className="h-3 w-3 text-slate-500 shrink-0" />;

                  if (tier === 0) {
                    cardStyles = "bg-slate-900 border border-slate-800 text-white shadow-md rounded-xl hover:shadow-lg";
                    nodeIcon = <Compass className="h-3.5 w-3.5 text-indigo-400 shrink-0 animate-pulse" />;
                  } else if (tier === 1) {
                    cardStyles = `bg-white border-y border-r border-slate-200/80 shadow-xs hover:shadow-md rounded-xl cursor-pointer pointer-events-auto transition duration-150`;
                    nodeIcon = <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: leftBorderColor }} />;
                  } else {
                    cardStyles = "bg-slate-50 border border-slate-200/50 hover:border-slate-350 shadow-3xs hover:shadow-2xs rounded-xl cursor-pointer pointer-events-auto transition duration-150";
                    nodeIcon = <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />;
                  }

                  const selectedRing = isSelected ? "ring-2 ring-indigo-500 shadow-md scale-[1.03]" : "";

                  return (
                    <div
                      key={`node-${node.id}`}
                      style={{
                        position: "absolute",
                        left: `${x - cardWidth / 2}px`,
                        top: `${y - cardHeight / 2}px`,
                        width: `${cardWidth}px`,
                        minHeight: `${cardHeight}px`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNode(node);
                      }}
                      className={`pointer-events-auto cursor-pointer p-2.5 flex flex-col justify-center gap-1 font-sans ${cardStyles} ${selectedRing} group`}
                    >
                      {/* Color Bar for Topics and Subtopics */}
                      {tier > 0 && (
                        <div 
                          className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md"
                          style={{ backgroundColor: leftBorderColor }}
                        />
                      )}

                      {/* Header row with Icon + Title (Wrapped naturally!) */}
                      <div className={`flex items-start gap-1.5 ${tier > 0 ? "pl-1.5" : ""}`}>
                        {nodeIcon}
                        <div 
                          className={`font-sans leading-tight break-words flex-1 pr-1.5 ${
                            tier === 0 
                              ? "text-[11.5px] font-extrabold text-white" 
                              : tier === 1 
                              ? "text-[11px] font-bold text-slate-800" 
                              : "text-[10px] font-bold text-slate-700"
                          }`}
                        >
                          {node.label}
                        </div>
                      </div>

                      {/* Sub-details preview inside topic cards */}
                      {tier === 1 && node.details && (
                        <div className="pl-5 text-[8.5px] text-slate-400 font-semibold truncate leading-none mt-0.5">
                          {node.details}
                        </div>
                      )}

                      {/* Expand / Collapse trigger badge on the right edge */}
                      {tier === 1 && hasChildren && (
                        <button
                          type="button"
                          onClick={(e) => toggleTopic(node.id, e)}
                          className="absolute -right-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-200 hover:text-slate-800 transition shadow-3xs cursor-pointer text-[10px] font-bold pointer-events-auto"
                        >
                          {isCollapsed ? "+" : "−"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-white/95 px-2.5 py-1.5 rounded-lg border border-slate-100 shadow-xs text-[9px] text-slate-500 font-bold uppercase tracking-wider">
            <HelpCircle className="h-3.5 w-3.5 text-indigo-500" />
            Haz clic en las tarjetas para explorar o expandir
          </div>
        </div>
      </div>

      {/* Info Inspector Sidebar */}
      <div className="w-full xl:w-64 border border-slate-100 rounded-xl p-4 flex flex-col justify-between bg-slate-50/20 shadow-2xs">
        <div id="inspector-container">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-3">
            <Info className="h-4 w-4 text-indigo-500" />
            <span className="font-sans text-[10px] font-bold text-slate-500 uppercase tracking-widest">Inspector de Detalles</span>
          </div>

          {selectedNode ? (
            <div className="space-y-3.5 animate-fade-in">
              <div>
                <span className="text-[9px] font-bold uppercase py-0.5 px-2.5 rounded-full border bg-slate-100 text-slate-500">
                  {selectedNode.id === "root" ? "Tema Principal" : selectedNode.children ? "Eje Estratégico" : "Concepto Clave"}
                </span>
                <h3 className="font-sans text-sm font-bold text-slate-800 tracking-tight mt-1.5 leading-snug">
                  {selectedNode.label}
                </h3>
              </div>
              
              <div className="bg-white border border-slate-100 rounded-xl p-3 text-[11px] text-slate-600 leading-relaxed font-sans space-y-2 shadow-3xs">
                <p className="whitespace-pre-line">{selectedNode.details || "Este concepto representa una idea clave de la reunión. Puedes preguntarle más detalles al Asistente de IA en el panel de la derecha."}</p>
              </div>

              {/* Ask AI Dynamic Shortcut Integration */}
              {selectedNode.id !== "root" && onAskAI && (
                <button
                  type="button"
                  onClick={() => onAskAI(`Háblame en detalle sobre el concepto "${selectedNode.label}" discutido en la reunión, el cual refiere a: ${selectedNode.details || ""}`)}
                  className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-lg transition shadow-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer uppercase tracking-wider mt-1"
                >
                  <Sparkles className="h-3 w-3 text-indigo-200" /> Consultar con IA
                </button>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400">
              <p className="text-xs font-semibold">Selecciona cualquier tarjeta en el lienzo para ver su desglose conceptual completo</p>
            </div>
          )}
        </div>

        {selectedNode && selectedNode.id !== "root" && (
          <div className="border-t border-slate-100 pt-3 mt-4">
            <span className="text-[9px] text-slate-400 text-center block font-semibold leading-normal uppercase tracking-wider">
              ¿Dudas sobre este eje? Pregúntale a la IA en el chat
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
