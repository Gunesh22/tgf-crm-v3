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

/* Pre-built node positions — laid out cleanly without overlapping */
export function buildDefaultNodes() {
  const positions = [
    { x: 480, y: 30 },     // 0  New Lead
    { x: 480, y: 220 },    // 1  Attempting Contact
    { x: 480, y: 430 },    // 2  Information Given
    { x: 60,  y: 640 },    // 3  Previous Program Pending
    { x: 480, y: 640 },    // 4  Nurture / Interested
    { x: 900, y: 640 },    // 5  Future Pool
    { x: 260, y: 870 },    // 6  Registered / Won
    { x: 700, y: 870 },    // 7  Existing Alumni
    { x: 260, y: 1080 },   // 8  Closed / Lost
    { x: 700, y: 1080 },   // 9  Closed / Invalid
  ];

  return defaultStages.map((label, i) => ({
    id: `stage-${i}`,
    type: 'stageNode',
    position: positions[i],
    data: { label },
  }));
}

/* Pre-built edges connecting the pipeline with multiple outcome options */
export function buildDefaultEdges() {
  const edges = [
    { source: 'stage-0', target: 'stage-1', options: ['Attempting Contact', 'Call Initiated'] },
    { source: 'stage-0', target: 'stage-2', options: ['Info Given'] },
    { source: 'stage-0', target: 'stage-7', options: ['Already Reg.d', 'Already Registered', 'Shivir Done'] },
    { source: 'stage-0', target: 'stage-8', options: ['Not Interested'] },
    { source: 'stage-0', target: 'stage-9', options: ['Invalid Number', 'Wrong No'] },
    { source: 'stage-1', target: 'stage-2', options: ['Info Given'] },
    { source: 'stage-1', target: 'stage-7', options: ['Already Reg.d', 'Already Registered', 'Shivir Done'] },
    { source: 'stage-1', target: 'stage-8', options: ['Not Interested'] },
    { source: 'stage-1', target: 'stage-9', options: ['Call Not Connected', 'Invalid Number'] },
    { source: 'stage-2', target: 'stage-3', options: ['Previous Program Pending'] },
    { source: 'stage-2', target: 'stage-4', options: ['Interested', 'Needs Callback'] },
    { source: 'stage-2', target: 'stage-5', options: ['Next Time', 'Future Batch'] },
    { source: 'stage-2', target: 'stage-6', options: ['Reg.Done', 'Registered'] },
    { source: 'stage-2', target: 'stage-7', options: ['Already Reg.d', 'Already Registered', 'Shivir Done'] },
    { source: 'stage-2', target: 'stage-8', options: ['Not Interested', 'Not possible'] },
    { source: 'stage-3', target: 'stage-4', options: ['Shivir Done', 'Interested'] },
    { source: 'stage-3', target: 'stage-6', options: ['Reg.Done', 'Registered'] },
    { source: 'stage-3', target: 'stage-7', options: ['Already Reg.d', 'Already Registered'] },
    { source: 'stage-4', target: 'stage-5', options: ['Next Time', 'Future Batch'] },
    { source: 'stage-4', target: 'stage-6', options: ['Reg.Done', 'Registered'] },
    { source: 'stage-4', target: 'stage-7', options: ['Already Reg.d', 'Already Registered', 'Shivir Done'] },
    { source: 'stage-4', target: 'stage-8', options: ['Not Interested', 'Not possible'] },
    { source: 'stage-5', target: 'stage-4', options: ['Interested', 'Needs Callback'] },
    { source: 'stage-5', target: 'stage-6', options: ['Reg.Done', 'Registered'] },
    { source: 'stage-6', target: 'stage-7', options: ['Shivir Done', 'Already Reg.d'] },
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
