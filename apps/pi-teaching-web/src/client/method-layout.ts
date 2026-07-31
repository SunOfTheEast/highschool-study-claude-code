import type { KnowledgeGraphNode } from '../shared/view-contracts';

export type PositionedMethodNode = KnowledgeGraphNode & {
  depth: number;
  x: number;
  y: number;
};

const columnWidth = 260;
const rowHeight = 88;

export function layoutMethodTree(
  nodes: KnowledgeGraphNode[],
): PositionedMethodNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const depth = (node: KnowledgeGraphNode): number => {
    let result = 0;
    let parent = node.parentId ? byId.get(node.parentId) : undefined;
    const visited = new Set([node.id]);
    while (parent) {
      if (visited.has(parent.id)) throw new Error('KNOWLEDGE_GRAPH_CYCLE');
      visited.add(parent.id);
      result += 1;
      parent = parent.parentId ? byId.get(parent.parentId) : undefined;
    }
    return result;
  };
  return nodes.map((node, index) => {
    const nodeDepth = depth(node);
    return {
      ...node,
      depth: nodeDepth,
      x: 72 + nodeDepth * columnWidth,
      y: 56 + index * rowHeight,
    };
  });
}
