export const defaultStages = [
  'New Lead',
  'Attempting Contact',
  'Information Given',
  'Previous Program Pending',
  'Nurture / Interested',
  'Future Pool',
  'Registered / Won',
  'Existing Alumni',
  'Closed / Lost',
  'Closed / Invalid',
];

export const defaultOutcomes = [
  'Info Given',
  'Interested',
  'Previous Program Pending',
  'Next Time',
  'Reg.Done',
  'Already Reg.d',
  'Shivir Done',
  'Not Interested',
  'Call Not Connected',
];

/* Pre-built node positions — laid out cleanly matching canonical flowchart */
export function buildDefaultNodes() {
  const positions = [
    { x: 480, y: 40 },     // 0  New Lead
    { x: 480, y: 200 },    // 1  Attempting Contact
    { x: 480, y: 370 },    // 2  Information Given
    { x: 230, y: 310 },    // 3  Previous Program Pending
    { x: 480, y: 540 },    // 4  Nurture / Interested
    { x: 570, y: 700 },    // 5  Future Pool
    { x: 440, y: 830 },    // 6  Registered / Won
    { x: 680, y: 120 },    // 7  Existing Alumni
    { x: 740, y: 700 },    // 8  Closed / Lost
    { x: 680, y: 370 },    // 9  Closed / Invalid
  ];

  return defaultStages.map((label, i) => ({
    id: `stage-${i}`,
    type: 'stageNode',
    position: positions[i],
    data: { label },
  }));
}

/* Pre-built edges connecting the pipeline cleanly matching canonical flowchart */
export function buildDefaultEdges() {
  const edges = [
    { source: 'stage-0', target: 'stage-1', options: ['Attempting Contact', 'Call Initiated'] },
    { source: 'stage-1', target: 'stage-7', options: ['Shivir Done', 'Already Reg.d'] },
    { source: 'stage-1', target: 'stage-3', options: ['Previous Program Pending'] },
    { source: 'stage-1', target: 'stage-2', options: ['Info Given'] },
    { source: 'stage-1', target: 'stage-9', options: ['Invalid Number'] },
    { source: 'stage-3', target: 'stage-2', options: ['Info Given'] },
    { source: 'stage-2', target: 'stage-4', options: ['Interested'] },
    { source: 'stage-4', target: 'stage-6', options: ['Reg.Done'] },
    { source: 'stage-4', target: 'stage-5', options: ['Next Time'] },
    { source: 'stage-4', target: 'stage-8', options: ['Not Interested'] },
    { source: 'stage-5', target: 'stage-6', options: ['Reg.Done'] },
  ];

  return edges.map((e, i) => ({
    id: `edge-${i}`,
    source: e.source,
    target: e.target,
    type: 'customEdge',
    label: (e.options || [e.label]).join(', '),
    data: {
      options: e.options || (e.label ? [e.label] : ['Info Given']),
    },
    markerEnd: { type: 'arrowclosed' },
    style: { stroke: '#94a3b8', strokeWidth: 2 },
  }));
}
