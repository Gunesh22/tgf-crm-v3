import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  BaseEdge,
  getBezierPath,
  EdgeLabelRenderer,
  ConnectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  defaultOutcomes,
  buildDefaultNodes,
  buildDefaultEdges,
} from '../../../utils/defaultWorkflow';
import './WorkflowEditor.css';

/* ---------- helpers ---------- */
const STORAGE_KEY = 'workflow-global';
const TERMINAL_IDS = ['stage-8', 'stage-9']; // Closed/Lost, Closed/Invalid
const WIN_IDS = ['stage-6', 'stage-7']; // Registered/Won, Existing Alumni
const MAX_SIM_STEPS = 20;

/* Categorized Call Results and Call Outcomes */
export const CALL_RESULTS = [
  'Connected',
  'Not Connected',
  'Invalid Number',
];

export const CALL_OUTCOMES_BY_CATEGORY = {
  'Connected Outcomes': [
    'Attempting Contact',
    'Info Given',
    'Interested',
    'Needs Callback',
    'Previous Program Pending',
    'Next Time',
    'Reg.Done',
    'Already Reg.d',
    'Shivir Done',
    'Not Interested',
  ],
  'Not Connected Outcomes': [
    'Call Not Connected',
    'Not Picked Up',
    'Busy',
    'Call Cut',
    'Switched Off',
    'No Network',
    'Ringing',
  ],
  'Invalid Number Outcomes': [
    'Invalid Number',
    'Wrong No',
    'Called by mistake',
  ],
};

/* ---------- Custom Node ---------- */
function StageNode({ id, data, selected }) {
  const { label, onRename, onDelete, simState } = data;
  let extraClass = '';
  if (simState === 'active') extraClass = ' sim-active';
  else if (simState === 'visited') extraClass = ' sim-visited';
  if (TERMINAL_IDS.includes(id)) extraClass += ' terminal-node';
  if (WIN_IDS.includes(id)) extraClass += ' win-node';

  return (
    <div className={`stage-node${selected ? ' selected' : ''}${extraClass}`}>
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        isConnectable={true}
        className="wf-handle wf-handle-target"
      />
      <div className="node-actions">
        <button
          type="button"
          title="Rename stage"
          onClick={(e) => { e.stopPropagation(); onRename && onRename(id); }}
        >✏️</button>
        <button
          type="button"
          title="Delete stage"
          onClick={(e) => { e.stopPropagation(); onDelete && onDelete(id); }}
        >🗑️</button>
      </div>
      <div className="node-label">{label}</div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        isConnectable={true}
        className="wf-handle wf-handle-source"
      />
    </div>
  );
}

/* ---------- Custom Edge Component with Perpendicular Curvature Separation ---------- */
function WorkflowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data = {},
}) {
  const total = data.total || 1;
  const index = data.index || 0;

  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const dist = Math.hypot(dx, dy) || 1;
  const isLongJump = dy > 280;

  let edgePath = '';
  let labelX = 0;
  let labelY = 0;

  if (total === 1 && !isLongJump) {
    // Standard bezier curve for adjacent or single edge
    const [path] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      curvature: 0.22,
    });
    edgePath = path;
    // Bias label closer to source stage (around 38% down) so it never covers target handle
    labelX = sourceX + dx * 0.4;
    labelY = sourceY + dy * 0.4;
  } else {
    // Calculate normal vector perpendicular to direction vector
    const nx = -dy / dist;
    const ny = dx / dist;

    // Parallel edge offset
    const parallelOffset = (index - (total - 1) / 2) * 50;

    // Lateral curve for long bypass edges (e.g. from stage 0 or 1 down to 7, 8, 9)
    let bypassOffset = 0;
    if (isLongJump) {
      // If target is to the left, curve outward left; if right, curve outward right
      const side = dx < -20 ? -1 : (dx > 20 ? 1 : (index % 2 === 0 ? -1 : 1));
      bypassOffset = side * Math.min(150, Math.max(70, dy * 0.15));
    }

    const totalOffset = parallelOffset + bypassOffset;

    const c1x = sourceX + dx * 0.25 + nx * totalOffset * 1.15;
    const c1y = sourceY + dy * 0.25 + ny * totalOffset * 0.85;
    const c2x = sourceX + dx * 0.75 + nx * totalOffset * 1.15;
    const c2y = sourceY + dy * 0.75 + ny * totalOffset * 0.85;

    edgePath = `M ${sourceX},${sourceY} C ${c1x},${c1y} ${c2x},${c2y} ${targetX},${targetY}`;

    // Place label along the curved arc closer to the source stage (t = 0.35)
    const t = isLongJump ? 0.32 : 0.4;
    const invT = 1 - t;
    labelX = invT * invT * invT * sourceX + 3 * invT * invT * t * c1x + 3 * invT * t * t * c2x + t * t * t * targetX;
    labelY = invT * invT * invT * sourceY + 3 * invT * invT * t * c1y + 3 * invT * t * t * c2y + t * t * t * targetY;
  }

  const options = data.options || (data.label ? [data.label] : []);
  const onEdit = data.onEditEdge;
  const onDelete = data.onDeleteEdge;
  const isActiveSim = data.isActiveSim;
  const simChosenOutcome = data.simChosenOutcome;

  // Render primary option and a count badge if multiple options exist to keep layout clean
  const primaryOption = options.length > 0 ? options[0] : null;
  const extraCount = options.length > 1 ? options.length - 1 : 0;

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="edge-label-wrapper nodrag nopan"
        >
          <div
            className={`edge-options-badge${isActiveSim ? ' active-sim-edge' : ''}`}
            onClick={() => onEdit && onEdit(id)}
            title={`Options: ${options.join(', ')} (Click to edit)`}
          >
            {primaryOption ? (
              <>
                <span
                  className={`outcome-pill${simChosenOutcome === primaryOption ? ' sim-chosen' : ''}`}
                >
                  {primaryOption}
                </span>
                {extraCount > 0 && (
                  <span
                    className="outcome-pill-more"
                    title={options.slice(1).join(', ')}
                  >
                    +{extraCount}
                  </span>
                )}
              </>
            ) : (
              <span className="outcome-pill-empty">+ Add Options</span>
            )}
            <div className="edge-quick-actions">
              <button
                className="edge-icon-btn edit-btn"
                title="Edit options"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit && onEdit(id);
                }}
              >
                ✏️
              </button>
              <button
                className="edge-icon-btn del-btn"
                title="Delete this line"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete && onDelete(id);
                }}
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { stageNode: StageNode };
const edgeTypes = { customEdge: WorkflowEdge };

/* ========== MAIN COMPONENT ========== */
export default function VisualWorkflowModal({ isOpen, onClose, defaultProgram = "CBT Basic", programOptions = [] }) {
  const allPrograms = useMemo(() => {
    const list = Array.isArray(programOptions) && programOptions.length > 0 ? programOptions : ['CBT Basic', 'CBT Advanced', 'Yoga', 'Other'];
    return Array.from(new Set([defaultProgram, ...list].filter(Boolean)));
  }, [programOptions, defaultProgram]);

  const [program, setProgram] = useState(defaultProgram);

  useEffect(() => {
    if (defaultProgram) {
      setProgram(defaultProgram);
    }
  }, [defaultProgram]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  /* ---- toast notifications ---- */
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* ---- custom in-app dialog state (replaces native prompt and confirm) ---- */
  const [dialogState, setDialogState] = useState(null);
  // dialogState: { type: 'prompt' | 'confirm', title: '', message: '', defaultValue: '', placeholder: '', confirmText: '', isDestructive: false, onConfirm: (val) => {} }

  /* ---- modal state for connection options ---- */
  const [modalConfig, setModalConfig] = useState(null);
  const [customOptionInput, setCustomOptionInput] = useState('');
  const [connectionMode, setConnectionMode] = useState('merge'); // 'merge' or 'separate'
  const [isFullscreen, setIsFullscreen] = useState(false);

  /* ---- escape key handler ---- */
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (dialogState) {
          setDialogState(null);
        } else if (modalConfig) {
          setModalConfig(null);
        } else if (isFullscreen) {
          setIsFullscreen(false);
        } else if (onClose) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullscreen, modalConfig, dialogState, onClose]);

  /* ---- simulation state ---- */
  const [simRunning, setSimRunning] = useState(false);
  const [simCurrentId, setSimCurrentId] = useState(null);
  const [simCurrentEdgeId, setSimCurrentEdgeId] = useState(null);
  const [simChosenOutcome, setSimChosenOutcome] = useState(null);
  const [simLog, setSimLog] = useState([]);
  const [simVisited, setSimVisited] = useState(new Set());

  // Store timer references to avoid orphaned callbacks
  const simOuterTimer = useRef(null);
  const simInnerTimer = useRef(null);

  /* ---- clear timers helper ---- */
  const clearSimTimers = useCallback(() => {
    if (simOuterTimer.current) clearTimeout(simOuterTimer.current);
    if (simInnerTimer.current) clearTimeout(simInnerTimer.current);
    simOuterTimer.current = null;
    simInnerTimer.current = null;
  }, []);

  /* ---- stop simulation helper ---- */
  const stopSim = useCallback(() => {
    clearSimTimers();
    setSimRunning(false);
    setSimCurrentId(null);
    setSimCurrentEdgeId(null);
    setSimChosenOutcome(null);
    setSimLog([]);
    setSimVisited(new Set());
  }, [clearSimTimers]);

  /* ---- load / reset workflow on open ---- */
  useEffect(() => {
    if (!isOpen) return;
    stopSim();
    setModalConfig(null);

    const saved = localStorage.getItem('workflow-global') || localStorage.getItem('workflow-CBT Basic');
    if (saved) {
      try {
        const { nodes: sn, edges: se } = JSON.parse(saved);
        setNodes(sn);
        setEdges(
          se.map((e) => ({
            ...e,
            type: 'customEdge',
            data: {
              ...e.data,
              options:
                e.data?.options ||
                (e.label ? e.label.split(', ') : []),
            },
          }))
        );
        return;
      } catch (err) {
        console.error('Failed to parse saved workflow:', err);
      }
    }
    setNodes(buildDefaultNodes());
    setEdges(buildDefaultEdges());
  }, [isOpen, stopSim, setNodes, setEdges]);

  /* ---- node callbacks ---- */
  const handleRename = useCallback(
    (nodeId) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      setDialogState({
        type: 'prompt',
        title: 'Rename Stage',
        message: 'Enter a new name for this pipeline stage:',
        defaultValue: node.data.label || '',
        placeholder: 'e.g. Follow-up Needed',
        confirmText: 'Rename',
        onConfirm: (newName) => {
          if (newName && newName.trim()) {
            setNodes((nds) =>
              nds.map((n) =>
                n.id === nodeId
                  ? { ...n, data: { ...n.data, label: newName.trim() } }
                  : n
              )
            );
            showToast(`Stage renamed to "${newName.trim()}"`);
          }
        },
      });
    },
    [nodes, setNodes]
  );

  const handleDeleteNode = useCallback(
    (nodeId) => {
      const node = nodes.find((n) => n.id === nodeId);
      const label = node?.data?.label || 'stage';
      setDialogState({
        type: 'confirm',
        title: 'Delete Stage',
        message: `Are you sure you want to delete stage "${label}" and all its connection lines?`,
        confirmText: 'Delete Stage',
        isDestructive: true,
        onConfirm: () => {
          if (simCurrentId === nodeId) {
            stopSim();
          }
          if (modalConfig && (modalConfig.source === nodeId || modalConfig.target === nodeId)) {
            setModalConfig(null);
          }
          setNodes((nds) => nds.filter((n) => n.id !== nodeId));
          setEdges((eds) =>
            eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
          );
          showToast(`Deleted stage "${label}"`, 'info');
        },
      });
    },
    [nodes, simCurrentId, modalConfig, stopSim, setNodes, setEdges]
  );

  /* inject callbacks + sim state into every node */
  const nodesWithCallbacks = useMemo(
    () =>
      nodes.map((n) => {
        let simState = null;
        if (simRunning) {
          if (n.id === simCurrentId) simState = 'active';
          else if (simVisited.has(n.id)) simState = 'visited';
        }
        return {
          ...n,
          data: {
            ...n.data,
            onRename: handleRename,
            onDelete: handleDeleteNode,
            simState,
          },
        };
      }),
    [nodes, handleRename, handleDeleteNode, simRunning, simCurrentId, simVisited]
  );

  /* ---- edge callbacks ---- */
  const handleEditEdge = useCallback(
    (edgeId) => {
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge) return;
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);
      const currentOptions =
        edge.data?.options || (edge.label ? edge.label.split(', ') : []);

      setCustomOptionInput('');
      setModalConfig({
        isOpen: true,
        mode: 'edit',
        edgeId,
        source: edge.source,
        target: edge.target,
        sourceName: sourceNode?.data?.label || edge.source,
        targetName: targetNode?.data?.label || edge.target,
        selectedOptions: currentOptions.length > 0 ? [...currentOptions] : [],
      });
    },
    [edges, nodes]
  );

  const handleDeleteEdge = useCallback(
    (edgeId) => {
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      showToast('Connection line deleted', 'info');
    },
    [setEdges]
  );

  /* ---- compute parallel curvatures & inject callbacks ---- */
  const edgesStyled = useMemo(() => {
    // Count how many edges connect each source -> target pair
    const pairCounts = {};
    edges.forEach((e) => {
      const key = `${e.source}->${e.target}`;
      pairCounts[key] = (pairCounts[key] || 0) + 1;
    });

    const pairIndices = {};
    return edges.map((e) => {
      const key = `${e.source}->${e.target}`;
      const idx = pairIndices[key] || 0;
      pairIndices[key] = idx + 1;
      const total = pairCounts[key] || 1;

      const isActive = simRunning && e.source === simCurrentId;
      const isChosenEdge = simRunning && simCurrentEdgeId === e.id;

      const opts =
        e.data?.options || (e.label ? e.label.split(', ') : ['Info Given']);

      return {
        ...e,
        type: 'customEdge',
        markerEnd: { type: MarkerType.ArrowClosed },
        style: {
          ...e.style,
          stroke: isActive ? '#0d9488' : '#94a3b8',
          strokeWidth: isActive ? 2.8 : 2,
        },
        animated: isActive,
        data: {
          ...e.data,
          options: opts,
          index: idx,
          total,
          isActiveSim: isActive,
          simChosenOutcome: isChosenEdge ? simChosenOutcome : null,
          onEditEdge: handleEditEdge,
          onDeleteEdge: handleDeleteEdge,
        },
      };
    });
  }, [
    edges,
    simRunning,
    simCurrentId,
    simCurrentEdgeId,
    simChosenOutcome,
    handleEditEdge,
    handleDeleteEdge,
  ]);

  /* ---- onConnect: open modal to choose 1, 2, or more options ---- */
  const onConnect = useCallback(
    (params) => {
      if (!params.source || !params.target) return;
      if (params.source === params.target) {
        showToast('Connecting a stage to itself is not supported.', 'warning');
        return;
      }

      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);
      const existingEdge = edges.find(
        (e) => e.source === params.source && e.target === params.target
      );

      const existingOptions = existingEdge
        ? existingEdge.data?.options || (existingEdge.label ? existingEdge.label.split(', ') : [])
        : [];

      setCustomOptionInput('');
      setConnectionMode('merge');
      setModalConfig({
        isOpen: true,
        mode: 'create',
        source: params.source,
        target: params.target,
        sourceName: sourceNode?.data?.label || params.source,
        targetName: targetNode?.data?.label || params.target,
        selectedOptions: existingEdge && existingOptions.length > 0
          ? [...existingOptions]
          : params.source === 'stage-0' && params.target === 'stage-1'
            ? ['Attempting Contact']
            : [],
        hasExistingConnection: !!existingEdge,
        existingEdgeId: existingEdge?.id,
      });
    },
    [nodes, edges]
  );

  /* ---- modal handlers ---- */
  const toggleOption = (option) => {
    if (!modalConfig) return;
    const exists = modalConfig.selectedOptions.includes(option);
    const updated = exists
      ? modalConfig.selectedOptions.filter((o) => o !== option)
      : [...modalConfig.selectedOptions, option];
    setModalConfig({ ...modalConfig, selectedOptions: updated });
  };

  const addCustomOption = () => {
    if (!customOptionInput || !customOptionInput.trim()) return;
    const trimmed = customOptionInput.trim();
    if (!modalConfig.selectedOptions.includes(trimmed)) {
      setModalConfig({
        ...modalConfig,
        selectedOptions: [...modalConfig.selectedOptions, trimmed],
      });
    }
    setCustomOptionInput('');
  };

  const saveModalConnection = () => {
    if (!modalConfig) return;

    // If user typed custom option text but didn't click "+ Add", include it automatically!
    let finalOptions = [...modalConfig.selectedOptions];
    if (customOptionInput && customOptionInput.trim()) {
      const trimmed = customOptionInput.trim();
      if (!finalOptions.includes(trimmed)) {
        finalOptions.push(trimmed);
      }
    }

    if (finalOptions.length === 0) {
      showToast('Please select at least one option', 'warning');
      return;
    }

    if (modalConfig.mode === 'create') {
      if (modalConfig.hasExistingConnection && connectionMode === 'merge') {
        // Merge into existing edge
        setEdges((eds) =>
          eds.map((e) =>
            e.id === modalConfig.existingEdgeId
              ? {
                  ...e,
                  label: finalOptions.join(', '),
                  data: {
                    ...e.data,
                    options: finalOptions,
                  },
                }
              : e
          )
        );
        showToast(`Updated connection with ${finalOptions.length} options`);
      } else {
        // Add as new edge (parallel curved edge)
        const newEdge = {
          id: `edge-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          source: modalConfig.source,
          target: modalConfig.target,
          type: 'customEdge',
          label: finalOptions.join(', '),
          data: {
            options: finalOptions,
          },
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#94a3b8', strokeWidth: 2 },
        };
        setEdges((eds) => [...eds, newEdge]);
        showToast(`Created connection with ${finalOptions.length} options`);
      }
    } else if (modalConfig.mode === 'edit') {
      setEdges((eds) =>
        eds.map((e) =>
          e.id === modalConfig.edgeId
            ? {
                ...e,
                label: finalOptions.join(', '),
                data: {
                  ...e.data,
                  options: finalOptions,
                },
              }
            : e
        )
      );
      showToast('Connection options updated');
    }
    setModalConfig(null);
  };

  /* ---- toolbar: add stage ---- */
  const addStage = () => {
    setDialogState({
      type: 'prompt',
      title: 'Add New Stage',
      message: 'Enter the title of the new pipeline stage:',
      defaultValue: '',
      placeholder: 'e.g. Document Verification',
      confirmText: 'Add Stage',
      onConfirm: (name) => {
        if (!name || !name.trim()) return;
        const id = `stage-${Date.now()}`;
        setNodes((nds) => [
          ...nds,
          {
            id,
            type: 'stageNode',
            position: { x: 300 + Math.random() * 200, y: 300 + Math.random() * 150 },
            data: { label: name.trim() },
          },
        ]);
        showToast(`Added stage "${name.trim()}"`);
      },
    });
  };

  /* ---- toolbar: clear all lines ---- */
  const clearAllLines = () => {
    if (edges.length === 0) {
      showToast('No connection lines to delete.', 'info');
      return;
    }
    setDialogState({
      type: 'confirm',
      title: 'Clear All Connection Lines',
      message: `Are you sure you want to delete all ${edges.length} connection lines? Stages will remain intact.`,
      confirmText: 'Delete Lines',
      isDestructive: true,
      onConfirm: () => {
        stopSim();
        setEdges([]);
        showToast('All connection lines deleted', 'info');
      },
    });
  };

  /* ---- toolbar: save ---- */
  const saveWorkflow = () => {
    const cleanNodes = nodes.map(
      ({ data: { onRename, onDelete, simState, ...rest }, ...n }) => ({
        ...n,
        data: rest,
      })
    );
    const cleanEdges = edges.map(({ data, ...e }) => ({
      ...e,
      data: {
        options: data?.options || (e.label ? e.label.split(', ') : []),
      },
    }));
    const payload = JSON.stringify({ nodes: cleanNodes, edges: cleanEdges });
    localStorage.setItem('workflow-global', payload);

    // Sync across all program keys so every program uses this single unified workflow
    ['CBT Basic', 'CBT Advanced', 'Yoga', 'Other', ...(programOptions || [])].forEach((p) => {
      if (p) localStorage.setItem(`workflow-${p}`, payload);
    });

    showToast('Global workflow saved successfully for all programs!');
  };

  /* ---- toolbar: reset to defaults ---- */
  const resetWorkflow = () => {
    setDialogState({
      type: 'confirm',
      title: 'Reset to Defaults',
      message: 'Reset the global workflow to defaults? All custom stages and connections will be reset for all programs.',
      confirmText: 'Reset Pipeline',
      isDestructive: true,
      onConfirm: () => {
        stopSim();
        localStorage.removeItem('workflow-global');
        ['CBT Basic', 'CBT Advanced', 'Yoga', 'Other', ...(programOptions || [])].forEach((p) => {
          if (p) localStorage.removeItem(`workflow-${p}`);
        });
        setNodes(buildDefaultNodes());
        setEdges(buildDefaultEdges());
        showToast('Global workflow reset to defaults');
      },
    });
  };

  /* ---- SIMULATION ENGINE ---- */
  const startSim = () => {
    stopSim();
    // Filter valid nodes that exist
    const startNode = nodes.find((n) => n.id === 'stage-0') || nodes[0];
    if (!startNode) {
      showToast('No stages available to simulate.', 'warning');
      return;
    }

    setSimRunning(true);
    setSimCurrentId(startNode.id);
    setSimLog([{ step: 1, node: startNode.data.label, outcome: '—' }]);
    setSimVisited(new Set([startNode.id]));
  };

  /* auto-advance simulation with loop prevention and timer safety */
  useEffect(() => {
    if (!simRunning || !simCurrentId) return;

    // Check maximum step guard to prevent infinite loops on circular paths
    if (simLog.length >= MAX_SIM_STEPS) {
      simOuterTimer.current = setTimeout(() => {
        setSimLog((prev) => [
          ...prev,
          {
            step: prev.length + 1,
            node: '🔄 Pipeline Loop Completed (Max Steps Reached)',
            outcome: '—',
          },
        ]);
        setSimRunning(false);
        setSimCurrentEdgeId(null);
        setSimChosenOutcome(null);
      }, 1000);
      return () => clearSimTimers();
    }

    // Find outgoing edges that point to valid existing target nodes
    const validOutgoing = edges.filter(
      (e) => e.source === simCurrentId && nodes.some((n) => n.id === e.target)
    );

    if (validOutgoing.length === 0) {
      // Reached a terminal node or node with no further transitions
      simOuterTimer.current = setTimeout(() => {
        setSimLog((prev) => [
          ...prev,
          {
            step: prev.length + 1,
            node: '🏁 Pipeline End / Terminal Stage',
            outcome: '—',
          },
        ]);
        setSimRunning(false);
        setSimCurrentEdgeId(null);
        setSimChosenOutcome(null);
      }, 1200);
      return () => clearSimTimers();
    }

    // Pick a random outgoing edge and a random outcome from its options
    simOuterTimer.current = setTimeout(() => {
      const chosenEdge =
        validOutgoing[Math.floor(Math.random() * validOutgoing.length)];
      const targetNode = nodes.find((n) => n.id === chosenEdge.target);
      if (!targetNode) {
        setSimRunning(false);
        return;
      }

      const opts =
        chosenEdge.data?.options ||
        (chosenEdge.label ? chosenEdge.label.split(', ') : [defaultOutcomes[0]]);
      const chosenOutcome = opts[Math.floor(Math.random() * opts.length)] || '—';

      setSimCurrentEdgeId(chosenEdge.id);
      setSimChosenOutcome(chosenOutcome);

      // Advance after animated transition
      simInnerTimer.current = setTimeout(() => {
        setSimCurrentId(chosenEdge.target);
        setSimVisited((prev) => new Set(prev).add(chosenEdge.target));
        setSimLog((prev) => [
          ...prev,
          {
            step: prev.length + 1,
            node: targetNode.data.label,
            outcome: chosenOutcome,
          },
        ]);
      }, 600);
    }, 1500);

    return () => clearSimTimers();
  }, [simRunning, simCurrentId, simLog.length, edges, nodes, clearSimTimers]);

  /* ---- render ---- */
  if (isOpen === false) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/75 backdrop-blur-sm ${isFullscreen ? '' : 'p-3 sm:p-6'}`}
      onClick={isFullscreen ? undefined : onClose}
    >
      <div
        className={`relative bg-white shadow-2xl flex flex-col overflow-hidden border border-slate-300 ${
          isFullscreen
            ? 'w-screen h-screen rounded-none'
            : 'w-full max-w-7xl h-[90vh] rounded-2xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-sm">
              🔄
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide uppercase">Visual Pipeline Flowchart</h2>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Interactive MVP Engine
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Drag arrows from the bottom handle of a stage to the top handle of another to connect them.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Global Pipeline Badge */}
            <div className="flex items-center gap-1.5 bg-slate-800/90 px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-semibold text-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
              <span>Global Pipeline (All Programs)</span>
            </div>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen((f) => !f)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? '⊠' : '⛶'}
            </button>

            {/* Close Button */}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Close Visual Pipeline"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Toast notification banner */}
        {toast && (
          <div className={`toast-banner toast-${toast.type}`}>
            {toast.message}
          </div>
        )}

        <div className="workflow-toolbar">
          <button onClick={addStage} title="Add a new custom stage">
            + Add Stage
          </button>
          <button
            className="clear-lines-btn"
            onClick={clearAllLines}
            title="Delete all connection lines across all stages"
          >
            🗑️ Clear All Lines
          </button>
          <button onClick={resetWorkflow} title="Reset to default pipeline">
            ↺ Reset
          </button>
          <button
            className="save-btn"
            onClick={saveWorkflow}
            title="Save workflow to local storage"
          >
            💾 Save
          </button>
          <button
            type="button"
            className="fullscreen-btn"
            onClick={() => setIsFullscreen((f) => !f)}
            title={isFullscreen ? "Exit Full Screen" : "Full Screen"}
          >
            {isFullscreen ? "⊠ Exit Full Screen" : "⛶ Full Screen"}
          </button>
          <div style={{ flex: 1 }} />
          {!simRunning ? (
            <button className="sim-btn" onClick={startSim} title="Start simulated lead flow">
              ▶ Simulate Flow
            </button>
          ) : (
            <button className="sim-stop-btn" onClick={stopSim} title="Stop simulation">
              ⏹ Stop Simulation
            </button>
          )}
          {simRunning && (
            <div className="sim-info">
              <span className="sim-dot" />
              Simulating lead flow…
            </div>
          )}
        </div>

        <div className="editor-wrap flex-1" style={{ position: 'relative', height: '100%', minHeight: '400px' }}>
          <ReactFlow
          nodes={nodesWithCallbacks}
          edges={edgesStyled}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          connectionRadius={60}
          connectOnClick={true}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          deleteKeyCode="Delete"
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#cbd5e1" gap={24} size={1.5} />
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              if (n.id === simCurrentId) return '#0d9488';
              if (TERMINAL_IDS.includes(n.id)) return '#e11d48';
              if (WIN_IDS.includes(n.id)) return '#10b981';
              return '#94a3b8';
            }}
            maskColor="rgba(248,250,252,0.7)"
            style={{ background: '#fff' }}
          />
        </ReactFlow>

        {/* Live Simulation Log Panel */}
        {simLog.length > 0 && (
          <div className="sim-log">
            <div className="sim-log-header">
              <span>📋 Simulation Log</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>
                  {simLog.length} step{simLog.length > 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => setSimLog([])}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                  title="Close log"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="sim-log-body">
              {simLog.map((entry, i) => (
                <div className="sim-log-entry" key={i}>
                  <span className="sim-log-step">{entry.step}</span>
                  <span>
                    {entry.outcome !== '—' && (
                      <span style={{ color: '#0d9488', fontWeight: 600, marginRight: 6 }}>
                        [{entry.outcome}] →
                      </span>
                    )}
                    {entry.node}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MODAL: Connection Options — fixed overlay so it always renders on top */}
        {modalConfig && (
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setModalConfig(null)}
          >
            <div
              className="relative w-full max-w-lg max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-indigo-500 mb-1">
                    {modalConfig.mode === 'create' ? 'New Connection Options' : 'Edit Connection Options'}
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md">{modalConfig.sourceName}</span>
                    <span className="text-slate-400">➔</span>
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md">{modalConfig.targetName}</span>
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setModalConfig(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                  title="Close"
                >✕</button>
              </div>

              {/* Body — scrollable */}
              <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
                <p className="text-xs text-slate-500">
                  Select <strong>one or more outcomes</strong> that lead from <em>{modalConfig.sourceName}</em> to <em>{modalConfig.targetName}</em>:
                </p>

                {/* Existing connection merge/separate choice */}
                {modalConfig.hasExistingConnection && modalConfig.mode === 'create' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-2">
                    <div className="font-semibold text-amber-700">A connection already exists. Choose action:</div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="connectionMode" value="merge" checked={connectionMode === 'merge'} onChange={() => setConnectionMode('merge')} />
                      <span>Update / Add options to existing line</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="connectionMode" value="separate" checked={connectionMode === 'separate'} onChange={() => setConnectionMode('separate')} />
                      <span>Create as separate curved line</span>
                    </label>
                  </div>
                )}

                {/* CALL RESULT */}
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1.5 rounded-md mb-2 flex items-center gap-1.5 border border-indigo-100">
                    📞 Call Result
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {CALL_RESULTS.map((res) => {
                      const sel = modalConfig.selectedOptions.includes(res);
                      return (
                        <button
                          key={res}
                          type="button"
                          onClick={() => toggleOption(res)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                            sel
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400 hover:text-indigo-600'
                          }`}
                        >
                          {sel ? '✓ ' : '+ '}{res}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* CALL OUTCOME by category */}
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-md mb-3 flex items-center gap-1.5 border border-slate-200">
                    🎯 Call Outcome (Statuses)
                  </div>
                  <div className="space-y-3">
                    {Object.entries(CALL_OUTCOMES_BY_CATEGORY).map(([cat, list]) => (
                      <div key={cat}>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{cat}</div>
                        <div className="flex flex-wrap gap-2">
                          {list.map((outcome) => {
                            const sel = modalConfig.selectedOptions.includes(outcome);
                            return (
                              <button
                                key={outcome}
                                type="button"
                                onClick={() => toggleOption(outcome)}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                                  sel
                                    ? 'bg-teal-600 text-white border-teal-600'
                                    : 'bg-white text-slate-600 border-slate-300 hover:border-teal-400 hover:text-teal-600'
                                }`}
                              >
                                {sel ? '✓ ' : '+ '}{outcome}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom option */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1.5">Add Custom Option:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Needs Callback..."
                      value={customOptionInput}
                      onChange={(e) => setCustomOptionInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomOption(); } }}
                      className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <button
                      type="button"
                      onClick={addCustomOption}
                      className="px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 transition cursor-pointer"
                    >+ Add</button>
                  </div>
                </div>

                {/* Selected summary */}
                {modalConfig.selectedOptions.length > 0 && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Selected ({modalConfig.selectedOptions.length}):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {modalConfig.selectedOptions.map((opt) => (
                        <span key={opt} className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">
                          {opt}
                          <button type="button" onClick={() => toggleOption(opt)} className="hover:text-red-600 cursor-pointer leading-none">×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50 shrink-0">
                {modalConfig.mode === 'edit' && (
                  <button
                    type="button"
                    onClick={() => { handleDeleteEdge(modalConfig.edgeId); setModalConfig(null); }}
                    className="px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition cursor-pointer"
                  >🗑️ Delete Line</button>
                )}
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => setModalConfig(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
                >Cancel</button>
                <button
                  type="button"
                  disabled={modalConfig.selectedOptions.length === 0 && !customOptionInput.trim()}
                  onClick={saveModalConnection}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition cursor-pointer"
                >
                  {modalConfig.mode === 'create'
                    ? (modalConfig.hasExistingConnection && connectionMode === 'merge' ? 'Update Options' : 'Create Connection')
                    : 'Save Options'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CUSTOM IN-APP DIALOG BOX (Replaces window prompt & confirm on top layer) */}
        {dialogState && (
          <div 
            className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
            onClick={() => setDialogState(null)}
          >
            <div 
              className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4 animate-tab-fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{dialogState.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">{dialogState.message}</p>
                </div>
                <button
                  onClick={() => setDialogState(null)}
                  className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {dialogState.type === 'prompt' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const inputEl = e.currentTarget.elements.dialogInput;
                    const val = inputEl ? inputEl.value : '';
                    dialogState.onConfirm(val);
                    setDialogState(null);
                  }}
                  className="space-y-4"
                >
                  <input
                    name="dialogInput"
                    type="text"
                    defaultValue={dialogState.defaultValue || ''}
                    placeholder={dialogState.placeholder || 'Enter value...'}
                    autoFocus
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setDialogState(null)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition border border-slate-200 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm transition cursor-pointer"
                    >
                      {dialogState.confirmText || 'Confirm'}
                    </button>
                  </div>
                </form>
              )}

              {dialogState.type === 'confirm' && (
                <div className="flex items-center justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setDialogState(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition border border-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      dialogState.onConfirm();
                      setDialogState(null);
                    }}
                    className={`px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-sm transition cursor-pointer ${
                      dialogState.isDestructive
                        ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
                        : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                    }`}
                  >
                    {dialogState.confirmText || 'Yes, Proceed'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>,
    document.body
  );
}
