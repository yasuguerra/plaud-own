import React, { useState, useEffect } from "react";
import { ZoomIn, ZoomOut, HelpCircle, Network, Info } from "lucide-react";
import { MindMapNode } from "../types";

interface MindMapCanvasProps {
  rootNode: MindMapNode;
}

export default function MindMapCanvas({ rootNode }: MindMapCanvasProps) {
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

  // Compute horizontal layout coordinates
  // Root node: column 0 (X = 90)
  // Second tier (Topics): column 1 (X = 330)
  // Third tier (Sub-topics): column 2 (X = 580)
  
  const width = 850;
  const height = 480;

  const topics = rootNode.children || [];
  const totalTopics = topics.length;

  const nodes: Array<{
    node: MindMapNode;
    tier: number;
    x: number;
    y: number;
    parentId?: string;
  }> = [];

  const connections: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color?: string;
  }> = [];

  // 1. Root Coordinates
  const rootY = height / 2;
  const rootNodeId = rootNode.id;
  nodes.push({ node: rootNode, tier: 0, x: 90, y: rootY });

  // 2. Position Topics and build Sub-topics
  topics.forEach((topic, topicIdx) => {
    const isTopicCollapsed = collapsedTopics[topic.id];

    // Compute Y for this topic block
    const numTopicSlots = totalTopics + 1;
    const topicY = (height / numTopicSlots) * (topicIdx + 1);
    
    const topicX = 330;
    nodes.push({ node: topic, tier: 1, x: topicX, y: topicY, parentId: rootNodeId });
    
    // Connect Root to Topic
    connections.push({ x1: 90, y1: rootY, x2: topicX, y2: topicY, color: topic.color || "#6366f1" });

    if (!isTopicCollapsed && topic.children && topic.children.length > 0) {
      const subtopics = topic.children;
      const totalSubtopics = subtopics.length;
      
      subtopics.forEach((sub, subIdx) => {
        // Space them symmetrically around the topic's Y
        const range = 70; // Spread distance
        let subY = topicY;
        if (totalSubtopics > 1) {
          const step = range / (totalSubtopics - 1);
          subY = topicY - range / 2 + step * subIdx;
        }

        const subX = 580;
        nodes.push({ node: sub, tier: 2, x: subX, y: subY, parentId: topic.id });
        
        // Connect Topic to Sub-topic
        connections.push({ x1: topicX, y1: topicY, x2: subX, y2: subY, color: topic.color || "#6366f1" });
      });
    }
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col md:flex-row gap-6 h-full" id="mind-map-component">
      {/* Play Stage */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Stage controls bar */}
        <div className="flex items-center justify-between border-b border-slate-50 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Network className="h-4.5 w-4.5 text-indigo-500 animate-pulse" />
            <h2 className="font-sans text-sm font-bold text-slate-800">Concept Mind Map</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setZoomScale(prev => Math.max(prev - 0.1, 0.7))}
              className="p-1 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-xs font-mono font-medium text-slate-450 text-slate-500">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={() => setZoomScale(prev => Math.min(prev + 0.1, 1.4))}
              className="p-1 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* SVG Stage */}
        <div className="flex-1 border border-slate-100 rounded-xl relative overflow-hidden bg-slate-50/50 min-h-[360px]">
          <div 
            className="w-full h-full transition-transform duration-100 origin-center flex items-center justify-center p-3"
            style={{ transform: `scale(${zoomScale})` }}
          >
            <svg 
              viewBox={`0 0 ${width} ${height}`} 
              className="w-full h-auto select-none"
              style={{ maxHeight: '100%' }}
            >
              {/* Connecting paths with soft Bezier offsets */}
              {connections.map((conn, idx) => {
                const midX = (conn.x1 + conn.x2) / 2;
                const pathData = `M ${conn.x1} ${conn.y1} C ${midX} ${conn.y1}, ${midX} ${conn.y2}, ${conn.x2} ${conn.y2}`;
                return (
                  <path
                    key={`conn-${idx}`}
                    d={pathData}
                    fill="none"
                    stroke={conn.color}
                    strokeWidth="2"
                    strokeOpacity="0.45"
                    strokeDasharray="1 1"
                    className="animate-pulse"
                  />
                );
              })}

              {/* Node shapes */}
              {nodes.map(({ node, tier, x, y }) => {
                const isSelected = selectedNode?.id === node.id;
                const hasChildren = node.children && node.children.length > 0;
                const isCollapsed = collapsedTopics[node.id];
                
                // Set sizes and colors
                let boxWidth = 140;
                let boxHeight = 44;
                let strokeColor = node.color || "#818cf8";
                let fillBg = "#ffffff";
                let labelStyle = "fill-slate-700 font-semibold";
                
                if (tier === 0) {
                  boxWidth = 150;
                  boxHeight = 52;
                  strokeColor = "#312e81";
                  fillBg = "#312e81";
                  labelStyle = "fill-white font-bold";
                } else if (tier === 1) {
                  strokeColor = node.color || "#6366f1";
                  fillBg = isSelected ? "aliceblue" : "#ffffff";
                } else {
                  boxWidth = 130;
                  boxHeight = 36;
                  strokeColor = "#94a3b8";
                  fillBg = isSelected ? "#f8fafc" : "#ffffff";
                  labelStyle = "fill-slate-600 text-xs";
                }

                return (
                  <g 
                    key={`node-${node.id}`}
                    transform={`translate(${x - boxWidth / 2}, ${y - boxHeight / 2})`}
                    onClick={() => setSelectedNode(node)}
                    className="cursor-pointer group"
                  >
                    {/* Shadow layer */}
                    <rect
                      width={boxWidth}
                      height={boxHeight}
                      rx="8"
                      fill="#0f172a"
                      fillOpacity="0.04"
                      transform="translate(1, 2.5)"
                    />
                    {/* Main Node Box */}
                    <rect
                      width={boxWidth}
                      height={boxHeight}
                      rx="8"
                      fill={fillBg}
                      stroke={isSelected ? "#1e293b" : strokeColor}
                      strokeWidth={isSelected ? "2.5" : "1.5"}
                      className="transition duration-150 group-hover:stroke-slate-400"
                    />

                    {/* Text node lines */}
                    <text
                      x={boxWidth / 2}
                      y={boxHeight / 2 + 1}
                      alignmentBaseline="middle"
                      textAnchor="middle"
                      className={`font-sans text-[11px] ${labelStyle}`}
                    >
                      {node.label.length > 18 ? node.label.slice(0, 16) + "..." : node.label}
                    </text>

                    {/* Expand/Collapse Handle for Column-1 Topics */}
                    {tier === 1 && hasChildren && (
                      <g 
                        transform={`translate(${boxWidth - 10}, ${boxHeight / 2})`}
                        onClick={(e) => toggleTopic(node.id, e)}
                        className="opacity-80 hover:opacity-100"
                      >
                        <circle r="6" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" />
                        <text
                          x="0"
                          y="1"
                          alignmentBaseline="middle"
                          textAnchor="middle"
                          className="font-mono text-[8px] fill-slate-700 font-bold"
                        >
                          {isCollapsed ? "+" : "-"}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-white/95 px-2.5 py-1.5 rounded-lg border border-slate-100 shadow-xs text-[10px] text-slate-500 font-medium">
            <HelpCircle className="h-3.5 w-3.5 text-indigo-505 text-indigo-500" />
            Click nodes to inspect definitions or collapse branches
          </div>
        </div>
      </div>

      {/* Info Drawer on the right side */}
      <div className="w-full md:w-64 border border-slate-100 rounded-xl p-4 flex flex-col justify-between bg-slate-50/20 shadow-2xs">
        <div id="inspector-container">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-3">
            <Info className="h-4 w-4 text-indigo-500" />
            <span className="font-sans text-xs font-bold text-slate-700 uppercase tracking-widest">Detail Inspector</span>
          </div>

          {selectedNode ? (
            <div className="space-y-3">
              <div>
                <span className="text-[9px] font-bold uppercase py-0.5 px-2 rounded-full border bg-slate-100 text-slate-500">
                  {selectedNode.id === "root" ? "Root Topic" : selectedNode.children ? "Major Subject" : "Key Concept"}
                </span>
                <h3 className="font-sans text-base font-bold text-slate-800 tracking-tight mt-1 leading-snug">
                  {selectedNode.label}
                </h3>
              </div>
              
              <div className="bg-white border border-slate-100 rounded-lg p-3 text-xs text-slate-600 leading-relaxed space-y-2">
                <p>{selectedNode.details || "This concept represents a fundamental lesson block of the lecture. Ask your AI Study Buddy on the right console for additional tutoring."}</p>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-405 text-slate-400">
              <p className="text-xs">Select any card node to inspect its comprehensive study outline</p>
            </div>
          )}
        </div>

        {selectedNode && selectedNode.id !== "root" && (
          <div className="border-t border-slate-100 pt-3 mt-4">
            <span className="text-[10px] text-slate-400 text-center block leading-normal">
              Need tutoring on this branch? Ask AI in the study chat panel!
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
