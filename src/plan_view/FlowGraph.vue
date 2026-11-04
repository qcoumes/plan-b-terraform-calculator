<template>
  <div class="graph-wrap">
    <div
      ref="viewport"
      class="graph-viewport"
      @wheel="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <div
        class="graph-canvas"
        :style="{
          width: layout.width + 'px',
          height: layout.height + 'px',
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
        }"
      >
        <svg class="graph-edges" :width="layout.width" :height="layout.height" aria-hidden="true">
          <g v-for="e in edges" :key="e.id" :class="{ dim: !isLinked(e) }" :style="{ color: itemColor(e.item) }">
            <path :d="e.path" class="gedge" />
            <circle :cx="e.start.x" :cy="e.start.y" r="5" class="gport" />
            <circle :cx="e.end.x" :cy="e.end.y" r="5" class="gport" />
          </g>
        </svg>

        <div
          v-for="e in edges"
          :key="'l' + e.id"
          class="glabel"
          :class="{ dim: !isLinked(e) }"
          :style="{ left: e.labelX + 'px', top: e.labelY + 'px' }"
        >
          <GameIcon :item="e.item" :size="22" />
          <span><span class="glabel-name">{{ itemName(e.item) }}</span><b>{{ qtyText(e.qty) }}</b></span>
        </div>

        <div
          v-for="n in nodes"
          :key="n.id"
          class="gnode"
          :class="['k-' + n.kind, { dim: nodeDim(n), selected: selected === n.id, dragging: dragging === n.id }]"
          :style="{
            left: n.x - n.width / 2 + 'px',
            top: n.y - n.height / 2 + 'px',
            width: n.width + 'px',
            height: n.height + 'px',
            '--c': itemColor(n.item),
          }"
          role="button"
          tabindex="0"
          :title="nodeTitle(n)"
          @pointerdown="onNodeDown($event, n)"
          @pointermove="onNodeMove"
          @pointerup="onNodeUp"
          @pointercancel="onNodeUp"
          @click="select(n)"
          @keydown.enter="select(n)"
          @mouseenter="hovered = n.id"
          @mouseleave="hovered = null"
        >
          <template v-if="n.kind === 'step'">
            <GameIcon :item="n.step.building" :size="40" />
            <div class="gnode-title">
              <b>{{ rate ? "×" + fmt(stepAmount(n.step)) : fmt(stepAmount(n.step)) }}</b> {{ itemName(n.step.building) }}
            </div>
            <div class="gnode-sub">{{ rate ? "" : t("crafts") + " · " }}{{ outputNames(n.step.outputs) }}</div>
            <div class="gnode-sub muted" :title="gameText('UI_Selection_Progress', fmt(n.step.days))">⏱ {{ shortDays(n.step.days) }}</div>
          </template>
          <template v-else-if="n.kind === 'raw' && n.source">
            <GameIcon :item="n.source.building" :size="40" />
            <div class="gnode-title"><b>≈ ×{{ fmt(n.source.buildings) }}</b> {{ itemName(n.source.building) }}</div>
            <div class="gnode-sub">({{ itemName(n.item) }})</div>
          </template>
          <template v-else-if="n.kind === 'leftover'">
            <GameIcon :item="n.item" :size="28" />
            <div class="gnode-sub"><b>+{{ qtyText(n.qty) }}</b> {{ t("leftoverNode") }}</div>
          </template>
          <template v-else>
            <GameIcon :item="n.item" :size="40" />
            <div class="gnode-title"><b>{{ qtyText(n.qty) }}</b> {{ itemName(n.item) }}</div>
            <div class="gnode-sub muted">{{ n.kind === "raw" ? t("rawNode") : n.kind === "stock" ? t("stockNode") : "" }}</div>
          </template>
        </div>
      </div>

      <div class="graph-tools">
        <button v-if="customized" type="button" class="wide" @click="resetLayout">{{ t("resetLayout") }}</button>
        <button type="button" aria-label="Zoom in" @click="zoomIn">+</button>
        <button type="button" aria-label="Zoom out" @click="zoomOut">−</button>
        <button type="button" class="wide" @click="fit">{{ t("fit") }}</button>
      </div>
    </div>
    <div v-if="selectedNode && choiceItems.length" class="graph-selected">
      <div v-for="item in choiceItems" :key="item" class="graph-choice">
        <GameIcon :item="item" :size="24" />
        <span>{{ t("selectedRecipe", { item: itemName(item) }) }}</span>
        <RecipeChoice :item="item" />
      </div>
      <button type="button" class="icon-btn" :aria-label="t('remove')" @click="selected = null">×</button>
    </div>
  </div>
</template>

<script lang="ts">
// Wheel and buttons. "Fit" uses MIN_FIT_SCALE / MAX_FIT_SCALE instead.
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 3;
const ZOOM_STEP = 1.25;
// Applied exponentially, so zooming in then out gets back to the same scale.
const WHEEL_ZOOM_SPEED = 0.0025;
// Pixels the pointer must move before a press on a node becomes a drag.
const DRAG_THRESHOLD = 4;
const FIT_MARGIN = 16;
// When the graph is too big to fit.
const OVERFLOW_OFFSET = 8;
// Curves between moved nodes.
const MIN_CURVE_PULL = 50;
// So labels count in the graph's bounds.
const LABEL_HALF_WIDTH = 75;
const LABEL_HALF_HEIGHT = 20;
</script>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";

import { Plan, Quantities } from "../engine/types";
import GameIcon from "../shared/GameIcon.vue";
import RecipeChoice from "../shared/RecipeChoice.vue";
import { currentChoice, fmt, gameData, gameText, itemName, perYear, shortDays, t } from "../state/store";
import {
  GRID,
  MAX_FIT_SCALE,
  MIN_FIT_SCALE,
  PlacedEdge,
  PlacedNode,
  Position,
  Positions,
  buildGraph,
  hashString,
  itemColor,
  layoutGraph,
  loadLayout,
  saveLayout,
  smoothPath,
} from "./graph";
import { stepAmount } from "./view_models";

interface DrawnEdge extends PlacedEdge {
  path: string;
  start: Position;
  end: Position;
}

// x, y: where the graph's origin is in the panel.
interface View {
  x: number;
  y: number;
  scale: number;
}

interface PanStart {
  pointerX: number;
  pointerY: number;
  viewX: number;
  viewY: number;
}

// A click until the pointer moves DRAG_THRESHOLD pixels, then a drag.
interface NodePress {
  id: string;
  pointerX: number;
  pointerY: number;
  nodeX: number;
  nodeY: number;
  moved: boolean;
}

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const props = defineProps<{ plan: Plan }>();

const rate = computed(() => props.plan.mode === "rate");
const viewport = ref<HTMLElement | null>(null);
const view = reactive<View>({ x: 0, y: 0, scale: 1 });
const hovered = ref<string | null>(null);
const selected = ref<string | null>(null);
const dragging = ref<string | null>(null);
// Only the nodes the user moved; the others keep dagre's positions.
const positions = reactive<Positions>({});

const layout = computed(() => layoutGraph(buildGraph(props.plan)));

// The layout is saved per set of nodes: same chain, same arrangement.
const layoutKey = computed(() => {
  const ids = layout.value.nodes.map((n) => n.id).sort();
  return hashString(ids.join("|"));
});

function setPositions(next: Positions): void {
  for (const id of Object.keys(positions)) {
    delete positions[id];
  }
  Object.assign(positions, next);
}

const nodes = computed<PlacedNode[]>(() => layout.value.nodes.map((n) => ({ ...n, ...positions[n.id] })));
const nodeById = computed(() => new Map(nodes.value.map((n) => [n.id, n])));

function nodeAt(id: string): PlacedNode {
  const node = nodeById.value.get(id);
  if (!node) throw new Error(`No graph node "${id}"`);
  return node;
}

// Spreads the ports along a node side, ordered by the height of their other end.
function portY(node: PlacedNode, sideEdges: PlacedEdge[], edge: PlacedEdge, otherEnd: "from" | "to"): number {
  const sorted = [...sideEdges].sort((a, b) => nodeAt(a[otherEnd]).y - nodeAt(b[otherEnd]).y);
  return node.y - node.height / 2 + (node.height * (sorted.indexOf(edge) + 1)) / (sorted.length + 1);
}

// Edges between unmoved nodes keep dagre's routing, which avoids nodes. Edges
// touching a moved node become a plain curve between the facing sides.
const edges = computed<DrawnEdge[]>(() => {
  const outgoing = new Map<string, PlacedEdge[]>();
  const incoming = new Map<string, PlacedEdge[]>();
  for (const edge of layout.value.edges) {
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]);
    incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge]);
  }
  return layout.value.edges.map((edge): DrawnEdge => {
    if (!positions[edge.from] && !positions[edge.to]) {
      const points = edge.points;
      const first = points[0] ?? { x: 0, y: 0 };
      return { ...edge, path: smoothPath(points), start: first, end: points[points.length - 1] ?? first };
    }
    const source = nodeAt(edge.from);
    const target = nodeAt(edge.to);
    const start = { x: source.x + source.width / 2, y: portY(source, outgoing.get(edge.from) ?? [], edge, "to") };
    const end = { x: target.x - target.width / 2, y: portY(target, incoming.get(edge.to) ?? [], edge, "from") };
    const pull = Math.max(MIN_CURVE_PULL, Math.abs(end.x - start.x) / 2);
    const path = `M${start.x},${start.y} C${start.x + pull},${start.y} ${end.x - pull},${end.y} ${end.x},${end.y}`;
    return { ...edge, path, start, end, labelX: (start.x + end.x) / 2, labelY: (start.y + end.y) / 2 };
  });
});

const bounds = computed((): Bounds => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  function grow(left: number, top: number, right: number, bottom: number): void {
    x0 = Math.min(x0, left);
    y0 = Math.min(y0, top);
    x1 = Math.max(x1, right);
    y1 = Math.max(y1, bottom);
  }
  for (const n of nodes.value) {
    grow(n.x - n.width / 2, n.y - n.height / 2, n.x + n.width / 2, n.y + n.height / 2);
  }
  for (const e of edges.value) {
    grow(e.labelX - LABEL_HALF_WIDTH, e.labelY - LABEL_HALF_HEIGHT, e.labelX + LABEL_HALF_WIDTH, e.labelY + LABEL_HALF_HEIGHT);
  }
  if (x0 === Infinity) return { x: 0, y: 0, width: 1, height: 1 };
  return { x: x0 - FIT_MARGIN, y: y0 - FIT_MARGIN, width: x1 - x0 + 2 * FIT_MARGIN, height: y1 - y0 + 2 * FIT_MARGIN };
});

function fit(): void {
  const el = viewport.value;
  if (!el) return;
  const b = bounds.value;
  const scale = Math.min(MAX_FIT_SCALE, (el.clientWidth - FIT_MARGIN) / b.width, (el.clientHeight - FIT_MARGIN) / b.height);
  view.scale = Math.max(MIN_FIT_SCALE, scale);
  // Too big to fit: start from the raw resources (left) and let the user pan.
  const width = b.width * view.scale;
  const height = b.height * view.scale;
  view.x = (width <= el.clientWidth ? (el.clientWidth - width) / 2 : OVERFLOW_OFFSET) - b.x * view.scale;
  view.y = (height <= el.clientHeight ? (el.clientHeight - height) / 2 : OVERFLOW_OFFSET) - b.y * view.scale;
}

// Reload the saved arrangement and refit when the set of nodes changes
// (not when only quantities change).
function reload(): void {
  setPositions(loadLayout(layoutKey.value));
  void nextTick(fit);
}
watch(layoutKey, reload);
onMounted(reload);

// Keeps (centerX, centerY) in place, e.g. the point under the cursor.
function zoomAt(factor: number, centerX: number, centerY: number): void {
  const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.scale * factor));
  view.x = centerX - ((centerX - view.x) * scale) / view.scale;
  view.y = centerY - ((centerY - view.y) * scale) / view.scale;
  view.scale = scale;
}

function onWheel(event: WheelEvent): void {
  if (!event.ctrlKey && !event.metaKey) return; // a plain wheel scrolls the page
  const el = viewport.value;
  if (!el) return;
  event.preventDefault();
  const rect = el.getBoundingClientRect();
  zoomAt(Math.exp(-event.deltaY * WHEEL_ZOOM_SPEED), event.clientX - rect.left, event.clientY - rect.top);
}

function zoomCentered(factor: number): void {
  const el = viewport.value;
  if (el) zoomAt(factor, el.clientWidth / 2, el.clientHeight / 2);
}

function zoomIn(): void {
  zoomCentered(ZOOM_STEP);
}

function zoomOut(): void {
  zoomCentered(1 / ZOOM_STEP);
}

// Panning the background.
let pan: PanStart | null = null;

function onPointerDown(event: PointerEvent): void {
  const target = event.target instanceof Element ? event.target : null;
  if (event.button !== 0 || target?.closest(".gnode, .graph-tools")) return;
  pan = { pointerX: event.clientX, pointerY: event.clientY, viewX: view.x, viewY: view.y };
  viewport.value?.setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent): void {
  if (!pan) return;
  view.x = pan.viewX + event.clientX - pan.pointerX;
  view.y = pan.viewY + event.clientY - pan.pointerY;
}

function onPointerUp(): void {
  pan = null;
}

// Moving a node. A press without movement stays a click, which opens the recipe picker.
let press: NodePress | null = null;
let suppressClick = false;

function snap(value: number): number {
  return Math.round(value / GRID) * GRID;
}

function onNodeDown(event: PointerEvent, node: PlacedNode): void {
  if (event.button !== 0) return;
  event.stopPropagation();
  press = { id: node.id, pointerX: event.clientX, pointerY: event.clientY, nodeX: node.x, nodeY: node.y, moved: false };
  if (event.currentTarget instanceof Element) event.currentTarget.setPointerCapture(event.pointerId);
}

function onNodeMove(event: PointerEvent): void {
  if (!press) return;
  const dx = event.clientX - press.pointerX;
  const dy = event.clientY - press.pointerY;
  if (!press.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
  press.moved = true;
  dragging.value = press.id;
  positions[press.id] = { x: snap(press.nodeX + dx / view.scale), y: snap(press.nodeY + dy / view.scale) };
}

function onNodeUp(): void {
  if (press?.moved) {
    suppressClick = true;
    saveLayout(layoutKey.value, { ...positions });
  }
  press = null;
  dragging.value = null;
}

function resetLayout(): void {
  setPositions({});
  saveLayout(layoutKey.value, {});
  void nextTick(fit);
}

const customized = computed(() => Object.keys(positions).length > 0);

// All edges count as linked when nothing is hovered.
function isLinked(edge: PlacedEdge): boolean {
  return !hovered.value || edge.from === hovered.value || edge.to === hovered.value;
}

function nodeDim(node: PlacedNode): boolean {
  return (
    hovered.value !== null &&
    node.id !== hovered.value &&
    !edges.value.some((e) => isLinked(e) && (e.from === node.id || e.to === node.id))
  );
}

const selectedNode = computed(() => nodes.value.find((n) => n.id === selected.value) ?? null);

const choiceItems = computed((): string[] => {
  const node = selectedNode.value;
  if (!node) return [];
  if (node.kind === "step") {
    const outputs = Object.keys(node.step.outputs);
    const produced = outputs.filter((item) => currentChoice(item) === node.step.recipe);
    return produced.length > 0 ? produced : outputs;
  }
  return (gameData().producers[node.item] ?? []).length > 0 ? [node.item] : [];
});

function select(node: PlacedNode): void {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  selected.value = selected.value === node.id ? null : node.id;
}

function qtyText(qty: number): string {
  return rate.value ? perYear(qty) : fmt(qty);
}

function nodeTitle(node: PlacedNode): string {
  return itemName(node.kind === "step" ? node.step.building : node.item);
}

function outputNames(outputs: Quantities): string {
  return Object.keys(outputs).map(itemName).join(" + ");
}
</script>
