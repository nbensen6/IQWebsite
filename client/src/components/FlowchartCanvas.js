import React, { useState, useRef, useCallback, useEffect } from 'react';

const NODE_TYPES = ['start', 'action', 'decision', 'note'];

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Auto-layout for old flowcharts without x/y coordinates (BFS tree)
function autoLayout(nodes, edges) {
  if (!nodes || nodes.length === 0) return nodes;
  if (nodes.every(n => n.x !== undefined && n.y !== undefined)) return nodes;

  const childIds = new Set(edges.map(e => e.to));
  const rootId = nodes.find(n => !childIds.has(n.id))?.id || nodes[0].id;

  const levels = {};
  const visited = new Set();
  const queue = [{ id: rootId, level: 0, index: 0 }];
  visited.add(rootId);

  while (queue.length > 0) {
    const { id, level } = queue.shift();
    if (!levels[level]) levels[level] = [];
    levels[level].push(id);

    const children = edges.filter(e => e.from === id).map(e => e.to);
    for (const childId of children) {
      if (!visited.has(childId)) {
        visited.add(childId);
        queue.push({ id: childId, level: level + 1 });
      }
    }
  }

  const nodeMap = {};
  nodes.forEach(n => { nodeMap[n.id] = { ...n }; });

  Object.entries(levels).forEach(([level, ids]) => {
    const y = 80 + parseInt(level) * 150;
    const totalWidth = ids.length * 200;
    const startX = Math.max(100, 400 - totalWidth / 2);
    ids.forEach((id, i) => {
      if (nodeMap[id].x === undefined) nodeMap[id].x = startX + i * 200;
      if (nodeMap[id].y === undefined) nodeMap[id].y = y;
    });
  });

  nodes.forEach((n, i) => {
    if (nodeMap[n.id].x === undefined) {
      nodeMap[n.id].x = 100 + (i % 4) * 200;
      nodeMap[n.id].y = 80 + Math.floor(i / 4) * 150;
    }
  });

  return Object.values(nodeMap);
}

// Get port position on a node
function getPortPos(node, port) {
  const w = node.width || 160;
  const h = node.height || 60;
  switch (port) {
    case 'top':    return { x: node.x + w / 2, y: node.y };
    case 'bottom': return { x: node.x + w / 2, y: node.y + h };
    case 'left':   return { x: node.x,         y: node.y + h / 2 };
    case 'right':  return { x: node.x + w,     y: node.y + h / 2 };
    default:       return { x: node.x + w / 2, y: node.y + h };
  }
}

// Compute bezier path between two points, with control points extending
// outward from each port direction for clean curves
function bezierPath(fromPos, toPos, fromPort, toPort) {
  const dist = Math.hypot(toPos.x - fromPos.x, toPos.y - fromPos.y);
  const tension = Math.max(40, Math.min(dist * 0.4, 120));

  const portDir = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };
  const fd = portDir[fromPort] || [0, 1];
  const td = portDir[toPort] || [0, -1];

  const c1x = fromPos.x + fd[0] * tension;
  const c1y = fromPos.y + fd[1] * tension;
  const c2x = toPos.x + td[0] * tension;
  const c2y = toPos.y + td[1] * tension;

  return `M${fromPos.x},${fromPos.y} C${c1x},${c1y} ${c2x},${c2y} ${toPos.x},${toPos.y}`;
}

// Determine the best port on `node` that faces toward `otherNode`
function bestPort(node, otherNode) {
  const nw = node.width || 160;
  const nh = node.height || 60;
  const ow = otherNode.width || 160;
  const oh = otherNode.height || 60;
  const ncx = node.x + nw / 2;
  const ncy = node.y + nh / 2;
  const ocx = otherNode.x + ow / 2;
  const ocy = otherNode.y + oh / 2;

  const dx = ocx - ncx;
  const dy = ocy - ncy;

  if (Math.abs(dy) > Math.abs(dx)) {
    return dy > 0 ? 'bottom' : 'top';
  } else {
    return dx > 0 ? 'right' : 'left';
  }
}

function FlowchartCanvas({
  teamId,
  flowcharts,
  initialFlowchart,
  champions,
  version,
  onSave,
  onDelete,
  onClose
}) {
  // Drafts sidebar
  const [selectedFcId, setSelectedFcId] = useState(initialFlowchart?.id || null);
  const [fcName, setFcName] = useState(initialFlowchart?.name || '');

  // Canvas data
  const [nodes, setNodes] = useState(() => {
    if (initialFlowchart) {
      const data = typeof initialFlowchart.data === 'string' ? JSON.parse(initialFlowchart.data) : initialFlowchart.data;
      return autoLayout(data.nodes || [], data.edges || []);
    }
    const startId = generateId();
    return [{ id: startId, type: 'start', text: 'Start', x: 350, y: 80, width: 160, height: 60 }];
  });
  const [edges, setEdges] = useState(() => {
    if (initialFlowchart) {
      const data = typeof initialFlowchart.data === 'string' ? JSON.parse(initialFlowchart.data) : initialFlowchart.data;
      return data.edges || [];
    }
    return [];
  });

  const [selectedNodeId, setSelectedNodeId] = useState(null);

  // Canvas interaction state
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [drawingEdge, setDrawingEdge] = useState(null);
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });

  // Champion sidebar
  const [champSearch, setChampSearch] = useState('');
  // eslint-disable-next-line no-unused-vars
  const [champDragging, setChampDragging] = useState(null);

  const canvasRef = useRef(null);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  // Load a flowchart from the sidebar list
  const loadFlowchart = useCallback((fc) => {
    const data = typeof fc.data === 'string' ? JSON.parse(fc.data) : fc.data;
    setSelectedFcId(fc.id);
    setFcName(fc.name);
    setNodes(autoLayout(data.nodes || [], data.edges || []));
    setEdges(data.edges || []);
    setSelectedNodeId(null);
  }, []);

  const handleNewFlowchart = () => {
    const startId = generateId();
    setSelectedFcId(null);
    setFcName('');
    setNodes([{ id: startId, type: 'start', text: 'Start', x: 350, y: 80, width: 160, height: 60 }]);
    setEdges([]);
    setSelectedNodeId(null);
  };

  const handleSave = async () => {
    if (!fcName.trim()) return;
    const payload = {
      name: fcName,
      data: { nodes, edges }
    };
    await onSave(selectedFcId, payload);
  };

  // ---- Canvas mouse handlers ----
  const getCanvasPoint = useCallback((e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: e.clientX - rect.left - canvasOffset.x,
      y: e.clientY - rect.top - canvasOffset.y
    };
  }, [canvasOffset]);

  const handleCanvasMouseDown = (e) => {
    if (e.target === canvasRef.current || e.target.classList.contains('fc-canvas-inner') || e.target.tagName === 'svg') {
      setSelectedNodeId(null);
      setPanning(true);
      setPanStart({ x: e.clientX - canvasOffset.x, y: e.clientY - canvasOffset.y });
    }
  };

  const handleCanvasMouseMove = useCallback((e) => {
    if (panning) {
      setCanvasOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      return;
    }

    if (draggingNodeId) {
      const point = getCanvasPoint(e);
      setNodes(prev => prev.map(n =>
        n.id === draggingNodeId
          ? { ...n, x: point.x - dragOffset.x, y: point.y - dragOffset.y }
          : n
      ));
      return;
    }

    if (drawingEdge) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      setDrawingEdge(prev => ({
        ...prev,
        mouseX: e.clientX - rect.left - canvasOffset.x,
        mouseY: e.clientY - rect.top - canvasOffset.y
      }));
    }
  }, [panning, panStart, draggingNodeId, dragOffset, drawingEdge, getCanvasPoint, canvasOffset]);

  const handleCanvasMouseUp = useCallback((e) => {
    if (panning) {
      setPanning(false);
      return;
    }

    if (draggingNodeId) {
      setDraggingNodeId(null);
      return;
    }

    if (drawingEdge) {
      const point = getCanvasPoint(e);
      const currentNodes = nodesRef.current;
      const targetNode = currentNodes.find(n => {
        if (n.id === drawingEdge.fromNodeId) return false;
        const w = n.width || 160;
        const h = n.height || 60;
        return point.x >= n.x - 15 && point.x <= n.x + w + 15 &&
               point.y >= n.y - 15 && point.y <= n.y + h + 15;
      });

      if (targetNode) {
        const exists = edges.some(e => e.from === drawingEdge.fromNodeId && e.to === targetNode.id);
        if (!exists) {
          setEdges(prev => [...prev, {
            from: drawingEdge.fromNodeId,
            to: targetNode.id,
            label: ''
          }]);
        }
      }
      setDrawingEdge(null);
    }
  }, [panning, draggingNodeId, drawingEdge, getCanvasPoint, edges]);

  useEffect(() => {
    const handleMouseUp = (e) => handleCanvasMouseUp(e);
    const handleMouseMove = (e) => handleCanvasMouseMove(e);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleCanvasMouseUp, handleCanvasMouseMove]);

  // Node drag
  const handleNodeMouseDown = (e, nodeId) => {
    e.stopPropagation();
    const point = getCanvasPoint(e);
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    setDraggingNodeId(nodeId);
    setDragOffset({ x: point.x - node.x, y: point.y - node.y });
    setSelectedNodeId(nodeId);
  };

  // Port drag (start drawing edge)
  const handlePortMouseDown = (e, nodeId, port) => {
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDrawingEdge({
      fromNodeId: nodeId,
      fromPort: port,
      mouseX: e.clientX - rect.left - canvasOffset.x,
      mouseY: e.clientY - rect.top - canvasOffset.y
    });
  };

  // Palette / champion drop on canvas
  const handleCanvasDrop = (e) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('nodeType');
    const champId = e.dataTransfer.getData('championId');

    if (nodeType) {
      const point = getCanvasPoint(e);
      const newId = generateId();
      setNodes(prev => [...prev, {
        id: newId, type: nodeType, text: '', x: point.x - 80, y: point.y - 30,
        width: 160, height: 60
      }]);
      setSelectedNodeId(newId);
    } else if (champId) {
      // Dropping a champion onto the canvas — find if over a node
      const point = getCanvasPoint(e);
      const targetNode = nodes.find(n => {
        const w = n.width || 160;
        const h = n.height || 60;
        return point.x >= n.x && point.x <= n.x + w &&
               point.y >= n.y && point.y <= n.y + h;
      });
      if (targetNode) {
        setNodes(prev => prev.map(n => n.id === targetNode.id ? { ...n, championId: champId } : n));
        setSelectedNodeId(targetNode.id);
      }
    }
  };

  const handleCanvasDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  // Also handle champion drop directly on node shapes
  const handleNodeDrop = (e, nodeId) => {
    e.preventDefault();
    e.stopPropagation();
    const champId = e.dataTransfer.getData('championId');
    if (champId) {
      setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, championId: champId } : n));
      setSelectedNodeId(nodeId);
    }
  };

  const handleNodeDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  // Node editing
  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  const updateNodeField = (field, value) => {
    setNodes(prev => prev.map(n => n.id === selectedNodeId ? { ...n, [field]: value } : n));
  };

  const deleteNode = () => {
    if (!selectedNodeId || nodes.length <= 1) return;
    setNodes(prev => prev.filter(n => n.id !== selectedNodeId));
    setEdges(prev => prev.filter(e => e.from !== selectedNodeId && e.to !== selectedNodeId));
    setSelectedNodeId(null);
  };

  const deleteEdge = (from, to) => {
    setEdges(prev => prev.filter(e => !(e.from === from && e.to === to)));
  };

  // Champion helpers
  const filteredChampions = champions.filter(c =>
    !champSearch || c.name.toLowerCase().includes(champSearch.toLowerCase())
  );

  const getChampionImage = (champId) => {
    if (!champId || !version) return null;
    return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champId}.png`;
  };

  // Compute SVG bounds
  const svgWidth = Math.max(2000, ...nodes.map(n => (n.x || 0) + (n.width || 160) + 200));
  const svgHeight = Math.max(2000, ...nodes.map(n => (n.y || 0) + (n.height || 60) + 200));

  return (
    <div className="fc-canvas-overlay">
      {/* Left Sidebar - Saved Flowcharts */}
      <div className="fc-drafts-sidebar">
        <h3 style={{ color: 'var(--accent-gold)', margin: '0 0 1rem 0' }}>Flowcharts</h3>
        <button className="btn btn-primary btn-small" onClick={handleNewFlowchart} style={{ width: '100%', marginBottom: '1rem' }}>
          + New Flowchart
        </button>
        <div className="fc-drafts-list">
          {flowcharts.map(fc => (
            <div
              key={fc.id}
              className={`fc-draft-item ${selectedFcId === fc.id ? 'active' : ''}`}
              onClick={() => loadFlowchart(fc)}
            >
              <span className="fc-draft-name">{fc.name}</span>
              <button
                className="fc-draft-delete"
                onClick={(e) => { e.stopPropagation(); onDelete(fc.id); }}
                title="Delete"
              >
                ×
              </button>
            </div>
          ))}
          {flowcharts.length === 0 && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No saved flowcharts.</p>
          )}
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="fc-editor-main">
        {/* Top Toolbar */}
        <div className="fc-toolbar">
          <div className="fc-toolbar-left">
            <input
              type="text"
              value={fcName}
              onChange={(e) => setFcName(e.target.value)}
              placeholder="Flowchart name..."
              className="fc-name-input"
            />
            <div className="fc-palette">
              {NODE_TYPES.map(type => (
                <div
                  key={type}
                  className={`fc-palette-item fc-pal-${type}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('nodeType', type);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  title={`Drag to add ${type} node`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </div>
              ))}
            </div>
          </div>
          <div className="fc-toolbar-right">
            <button
              className="btn btn-primary btn-small"
              onClick={handleSave}
              disabled={!fcName.trim()}
            >
              Save
            </button>
            <button className="btn btn-secondary btn-small" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {/* Canvas + Champion sidebar wrapper */}
        <div className="fc-canvas-wrapper">
          {/* Canvas Area */}
          <div
            className="fc-canvas-area"
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onDrop={handleCanvasDrop}
            onDragOver={handleCanvasDragOver}
          >
            <div
              className="fc-canvas-inner"
              style={{
                transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px)`,
                width: svgWidth,
                height: svgHeight
              }}
            >
              {/* SVG Overlay for arrows */}
              <svg className="fc-svg-overlay" width={svgWidth} height={svgHeight}>
                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="var(--accent-gold)" />
                  </marker>
                </defs>
                {edges.map((edge, i) => {
                  const fromNode = nodes.find(n => n.id === edge.from);
                  const toNode = nodes.find(n => n.id === edge.to);
                  if (!fromNode || !toNode) return null;

                  // Always compute ports dynamically so arrows stay aligned when nodes move
                  const fromPort = bestPort(fromNode, toNode);
                  const toPort = bestPort(toNode, fromNode);
                  const from = getPortPos(fromNode, fromPort);
                  const to = getPortPos(toNode, toPort);
                  const path = bezierPath(from, to, fromPort, toPort);

                  const midX = (from.x + to.x) / 2;
                  const midY = (from.y + to.y) / 2;

                  return (
                    <g key={i}>
                      <path d={path} fill="none" stroke="var(--border-color)" strokeWidth="2" markerEnd="url(#arrowhead)" />
                      <path
                        d={path}
                        fill="none"
                        stroke="transparent"
                        strokeWidth="12"
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); deleteEdge(edge.from, edge.to); }}
                        title="Click to delete connection"
                      />
                      {edge.label && (
                        <text
                          x={midX}
                          y={midY - 8}
                          textAnchor="middle"
                          fill="var(--accent-gold)"
                          fontSize="11"
                          fontWeight="600"
                        >
                          {edge.label}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Preview line while drawing */}
                {drawingEdge && (() => {
                  const fromNode = nodes.find(n => n.id === drawingEdge.fromNodeId);
                  if (!fromNode) return null;
                  const from = getPortPos(fromNode, drawingEdge.fromPort);
                  const to = { x: drawingEdge.mouseX, y: drawingEdge.mouseY };
                  const path = bezierPath(from, to, drawingEdge.fromPort, 'top');
                  return (
                    <path d={path} fill="none" stroke="var(--accent-gold)" strokeWidth="2" strokeDasharray="6,3" opacity="0.7" />
                  );
                })()}
              </svg>

              {/* Shape nodes */}
              {nodes.map(node => (
                <div
                  key={node.id}
                  className={`fc-canvas-shape fc-${node.type} ${selectedNodeId === node.id ? 'selected' : ''}`}
                  style={{
                    left: node.x,
                    top: node.y,
                    width: node.width || 160,
                    minHeight: node.height || 60
                  }}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  onDrop={(e) => handleNodeDrop(e, node.id)}
                  onDragOver={handleNodeDragOver}
                >
                  {node.championId && (
                    <img
                      className="fc-shape-champion"
                      src={getChampionImage(node.championId)}
                      alt={node.championId}
                    />
                  )}
                  <span className="fc-shape-text">{node.text || 'Empty'}</span>

                  {/* Port dots */}
                  {['top', 'right', 'bottom', 'left'].map(port => (
                    <div
                      key={port}
                      className={`fc-port fc-port-${port}`}
                      onMouseDown={(e) => handlePortMouseDown(e, node.id, port)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Right Sidebar - Champions */}
          <div className="fc-champ-sidebar">
            <h4 style={{ color: 'var(--accent-gold)', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Champions</h4>
            <input
              type="text"
              value={champSearch}
              onChange={(e) => setChampSearch(e.target.value)}
              placeholder="Search..."
              className="fc-champ-search"
            />
            <div className="fc-champ-grid">
              {filteredChampions.map(c => (
                <div
                  key={c.id}
                  className="fc-champ-item"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('championId', c.id);
                    e.dataTransfer.effectAllowed = 'copy';
                    setChampDragging(c.id);
                  }}
                  onDragEnd={() => setChampDragging(null)}
                  title={c.name}
                >
                  <img src={c.image} alt={c.name} />
                </div>
              ))}
              {filteredChampions.length === 0 && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', gridColumn: '1/-1', textAlign: 'center', padding: '0.5rem' }}>
                  No champions found
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Node Editor Panel (bottom-right, above champ sidebar) */}
        {selectedNode && (
          <div className="fc-node-editor">
            <h4 style={{ color: 'var(--accent-gold)', margin: '0 0 0.75rem 0' }}>Edit Node</h4>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Type</label>
              <select
                value={selectedNode.type}
                onChange={(e) => updateNodeField('type', e.target.value)}
                style={{
                  width: '100%', padding: '0.4rem', borderRadius: '4px',
                  border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)'
                }}
              >
                {NODE_TYPES.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Text</label>
              <input
                type="text"
                value={selectedNode.text}
                onChange={(e) => updateNodeField('text', e.target.value)}
                placeholder="Node text..."
                style={{
                  width: '100%', padding: '0.4rem', borderRadius: '4px',
                  border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)'
                }}
              />
            </div>

            {/* Edge labels for edges from this node */}
            {edges.filter(e => e.from === selectedNodeId).map(edge => {
              const targetNode = nodes.find(n => n.id === edge.to);
              return (
                <div key={edge.to} style={{ marginBottom: '0.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    Arrow to "{targetNode?.text || 'Empty'}"
                  </label>
                  <input
                    type="text"
                    value={edge.label || ''}
                    onChange={(e) => {
                      setEdges(prev => prev.map(ed =>
                        (ed.from === edge.from && ed.to === edge.to) ? { ...ed, label: e.target.value } : ed
                      ));
                    }}
                    placeholder="Label (e.g. Yes / No)"
                    style={{
                      width: '100%', padding: '0.4rem', borderRadius: '4px',
                      border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)'
                    }}
                  />
                </div>
              );
            })}

            {/* Champion on this node */}
            {selectedNode.championId && (
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Champion</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img src={getChampionImage(selectedNode.championId)} alt="" style={{ width: 24, height: 24, borderRadius: 4 }} />
                  <span style={{ fontSize: '0.85rem', flex: 1 }}>{selectedNode.championId}</span>
                  <button
                    className="btn btn-secondary btn-small"
                    style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                    onClick={() => updateNodeField('championId', null)}
                  >
                    ×
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              {nodes.length > 1 && (
                <button className="btn btn-danger btn-small" onClick={deleteNode}>
                  Delete Node
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FlowchartCanvas;
