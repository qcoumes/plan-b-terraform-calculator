import { EdgeLabel, GraphLabel, NodeLabel, Point, graphlib, layout } from "@dagrejs/dagre";

import { EPSILON, Plan, Step } from "../engine/engine";
import { storageGet, storageSet } from "../state/storage";
import { fmt, itemGroup, itemName, recipe } from "../state/store";
import { SupplyBuilding, makeProducerOf, rawSourceOf } from "./view_models";

const NODE_WIDTH = 140;
const NODE_HEIGHT = 114;
// Stock and raw nodes without a supplying building.
const SMALL_NODE_HEIGHT = 96;
const LEFTOVER_NODE_WIDTH = 130;
const LEFTOVER_NODE_HEIGHT = 64;

// Edge labels have two lines (item name, quantity) and are sized on the longer one.
const LABEL_HEIGHT = 38;
const LABEL_MAX_WIDTH = 150;
const LABEL_PADDING = 36;
const LABEL_CHAR_WIDTH = 5.6;
// " / year" after the number.
const LABEL_UNIT_CHARS = 7;

// Below this, text gets hard to read: pan instead.
export const MIN_FIT_SCALE = 0.5;
// Small graphs are enlarged up to this to fill the panel.
export const MAX_FIT_SCALE = 2;
// Dragged nodes snap to this grid.
export const GRID = 10;

export interface Position {
  x: number;
  y: number;
}

interface NodeBase {
  id: string;
  /** The item whose group sets the node's colour. */
  item: string;
  width: number;
  height: number;
}

export interface StepNode extends NodeBase {
  kind: "step";
  step: Step;
}

export interface AmountNode extends NodeBase {
  kind: "target" | "stock" | "leftover";
  qty: number;
}

export interface RawNode extends NodeBase {
  kind: "raw";
  qty: number;
  source: SupplyBuilding | null;
}

export type GraphNode = StepNode | AmountNode | RawNode;

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  item: string;
  qty: number;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// x and y are the node's centre.
export type PlacedNode = GraphNode & Position;

export interface PlacedEdge extends GraphEdge {
  points: Point[];
  labelX: number;
  labelY: number;
}

export interface Layout {
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  width: number;
  height: number;
}

// A consumer's demand for an item is split between stock, raw supply and the
// producing step in the same proportions as the solver's totals.
export function buildGraph(plan: Plan): Graph {
  const producerOf = makeProducerOf(plan);
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  function addNode(node: GraphNode): void {
    if (!nodes.has(node.id)) nodes.set(node.id, node);
  }

  function addEdge(from: string, to: string, item: string, qty: number): void {
    if (qty <= EPSILON || from === to) return;
    const id = `${from}>${to}>${item}`;
    let edge = edges.get(id);
    if (!edge) {
      edge = { id, from, to, item, qty: 0 };
      edges.set(id, edge);
    }
    edge.qty += qty;
  }

  for (const step of plan.steps) {
    const item = Object.keys(step.outputs)[0] ?? step.building;
    addNode({ id: `s${step.recipe}`, kind: "step", step, item, width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const [item, qty] of Object.entries(plan.targets)) {
    addNode({ id: `t:${item}`, kind: "target", item, qty, width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  // Every demand: [consumer node id, item, quantity].
  const consumers: Array<[string, string, number]> = [];
  for (const [item, qty] of Object.entries(plan.targets)) {
    consumers.push([`t:${item}`, item, qty]);
  }
  for (const step of plan.steps) {
    for (const [item, qty] of Object.entries(step.inputs)) {
      consumers.push([`s${step.recipe}`, item, qty]);
    }
  }
  const demand = new Map<string, number>();
  for (const [, item, qty] of consumers) {
    demand.set(item, (demand.get(item) ?? 0) + qty);
  }

  for (const [consumer, item, qty] of consumers) {
    const total = demand.get(item) ?? qty;
    const stockTotal = plan.stockUsed[item] ?? 0;
    const rawTotal = plan.raw[item] ?? 0;
    const fromStock = (stockTotal * qty) / total;
    const fromRaw = (rawTotal * qty) / total;
    const crafted = qty - fromStock - fromRaw;
    if (fromStock > EPSILON) {
      addNode({ id: `k:${item}`, kind: "stock", item, qty: stockTotal, width: NODE_WIDTH, height: SMALL_NODE_HEIGHT });
      addEdge(`k:${item}`, consumer, item, fromStock);
    }
    if (fromRaw > EPSILON) {
      const src = rawSourceOf(plan, item);
      addNode({
        id: `r:${item}`,
        kind: "raw",
        item,
        qty: rawTotal,
        width: NODE_WIDTH,
        height: src ? NODE_HEIGHT : SMALL_NODE_HEIGHT,
        source: src ? { building: recipe(src.recipe).building, buildings: src.buildings } : null,
      });
      addEdge(`r:${item}`, consumer, item, fromRaw);
    }
    const producer = crafted > EPSILON ? producerOf(item) : null;
    if (producer) addEdge(`s${producer.recipe}`, consumer, item, crafted);
  }

  for (const [item, qty] of Object.entries(plan.leftover)) {
    const producer = plan.steps.find((s) => item in s.outputs);
    if (!producer) continue;
    addNode({ id: `l:${item}`, kind: "leftover", item, qty, width: LEFTOVER_NODE_WIDTH, height: LEFTOVER_NODE_HEIGHT });
    addEdge(`s${producer.recipe}`, `l:${item}`, item, qty);
  }

  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

export function layoutGraph(graph: Graph): Layout {
  const g = new graphlib.Graph<GraphLabel, NodeLabel, EdgeLabel>({ multigraph: true });
  g.setGraph({ rankdir: "LR", nodesep: 22, ranksep: 26, edgesep: 12, marginx: 16, marginy: 16 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const node of graph.nodes) {
    g.setNode(node.id, { width: node.width, height: node.height });
  }
  for (const edge of graph.edges) {
    const chars = Math.max(itemName(edge.item).length, fmt(edge.qty).length + LABEL_UNIT_CHARS);
    const width = Math.min(LABEL_MAX_WIDTH, LABEL_PADDING + chars * LABEL_CHAR_WIDTH);
    g.setEdge(edge.from, edge.to, { width, height: LABEL_HEIGHT, labelpos: "c" }, edge.id);
  }
  layout(g);
  const nodes = graph.nodes.map((node): PlacedNode => {
    const laid = g.node(node.id);
    return { ...node, x: laid.x ?? 0, y: laid.y ?? 0 };
  });
  const edges = graph.edges.map((edge): PlacedEdge => {
    const laid = g.edge({ v: edge.from, w: edge.to, name: edge.id });
    return { ...edge, points: laid.points ?? [], labelX: laid.x ?? 0, labelY: laid.y ?? 0 };
  });
  const size = g.graph();
  return { nodes, edges, width: size.width ?? 0, height: size.height ?? 0 };
}

// Catmull-Rom curve through dagre's points, written as Bezier segments.
export function smoothPath(points: Point[]): string {
  if (points.length === 0) return "";
  let path = `M${points[0]!.x},${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p0 = points[i - 1] ?? p1;
    const p3 = points[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    path += ` C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`;
  }
  return path;
}

const GROUP_COLORS: { [group: string]: string } = {
  resources: "--g-resources",
  minerals: "--g-minerals",
  construction: "--g-construction",
  tech: "--g-tech",
  organic: "--g-organic",
  plants: "--g-organic",
  greenhousegas: "--g-greenhousegas",
};

// Buildings all share one colour.
export function itemColor(item: string): string {
  return `var(${GROUP_COLORS[itemGroup(item)] ?? "--g-building"})`;
}

const LAYOUTS_KEY = "planb.graphLayouts";
const MAX_SAVED_LAYOUTS = 30;

export interface Positions {
  [nodeId: string]: Position;
}

interface SavedLayout {
  positions: Positions;
  /** Used to keep only the most recent ones. */
  at: number;
}

// Keyed by hashString() of the graph's sorted node ids.
interface SavedLayouts {
  [layoutKey: string]: SavedLayout;
}

// djb2.
export function hashString(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

export function loadLayout(key: string): Positions {
  return storageGet<SavedLayouts>(LAYOUTS_KEY, {})[key]?.positions ?? {};
}

// Saving no positions forgets the graph.
export function saveLayout(key: string, positions: Positions): void {
  const all = storageGet<SavedLayouts>(LAYOUTS_KEY, {});
  if (Object.keys(positions).length > 0) {
    all[key] = { positions, at: Date.now() };
  } else {
    delete all[key];
  }
  const kept = Object.entries(all)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, MAX_SAVED_LAYOUTS);
  storageSet(LAYOUTS_KEY, Object.fromEntries(kept));
}
