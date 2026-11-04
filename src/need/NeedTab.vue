<template>
  <div class="planner">
    <section class="planner-main panel" :class="{ stale: loading }">
      <p v-if="error" class="error pad">{{ error }}</p>
      <ResultPanel v-else-if="result" :plan="result" />
      <p v-else class="muted pad">{{ t("pickItem") }}</p>
    </section>

    <aside class="planner-side">
      <div class="infobox">
        {{ rate ? t("infoRate") : t("infoTotal") }}
        <br>{{ t("graphHint") }}
      </div>
      <div class="segmented">
        <button type="button" :class="{ active: rate }" @click="store.needMode = 'rate'">{{ t("modeRate") }}</button>
        <button type="button" :class="{ active: !rate }" @click="store.needMode = 'total'">{{ t("modeTotal") }}</button>
      </div>
      <div class="panel">
        <PanelTabs v-model="sideTab" :tabs="sideTabs" />
        <div class="pbody pad">
          <template v-if="sideTab === 'outputs'">
            <p class="hint">{{ rate ? t("outputsHintRate", { u: yearUnit() }) : t("outputsHintTotal") }}</p>
            <QtyList v-model:rows="targets" :fraction="rate" />
          </template>
          <template v-else-if="sideTab === 'inputs'">
            <p class="hint">{{ rate ? t("inputsHintRate", { u: yearUnit() }) : t("inputsHintTotal") }}</p>
            <QtyList v-model:rows="stock" :fraction="rate" />
          </template>
          <OptionsPanel v-else />
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

import { Planner, toQuantities, Choice, Plan, QuantityRow } from "../engine/engine";
import { useAutoCalc } from "../shared/use_auto_calc";
import { cleanRows } from "../shared/rows";
import { storageGet, storageSet } from "../state/storage";
import { extractionLevel, gameData, store, t, yearUnit } from "../state/store";
import OptionsPanel from "../shared/OptionsPanel.vue";
import PanelTabs, { PanelTab } from "../shared/PanelTabs.vue";
import QtyList from "../shared/QtyList.vue";
import ResultPanel from "../plan_view/ResultPanel.vue";

type SideTab = "outputs" | "inputs" | "options";

// QtyList replaces the arrays on every edit, so plain watches see every change.
const targets = ref<QuantityRow[]>(storageGet("planb.need.targets", [{ item: "robotics", qty: 60 }]));
const stock = ref<QuantityRow[]>(storageGet("planb.need.stock", []));
const sideTab = ref<SideTab>("outputs");
watch(targets, (v) => { storageSet("planb.need.targets", v); });
watch(stock, (v) => { storageSet("planb.need.stock", v); });

const rate = computed(() => store.needMode === "rate");

const sideTabs = computed((): Array<PanelTab<SideTab>> => {
  const inputs = cleanRows(stock.value).length;
  return [
    { key: "outputs", icon: "↗", label: t("sideOutputs") },
    { key: "inputs", icon: "↘", label: t("sideInputs") + (inputs ? ` (${inputs})` : "") },
    { key: "options", icon: "⚙", label: t("sideOptions") },
  ];
});

interface Request {
  rate: boolean;
  targets: QuantityRow[];
  stock: QuantityRow[];
  choices: Record<string, Choice>;
  extractionLevel: number;
}

const request = computed((): Request | null => {
  const wanted = cleanRows(targets.value, rate.value);
  if (!wanted.length) return null;
  return {
    rate: rate.value,
    targets: wanted,
    stock: cleanRows(stock.value, rate.value),
    choices: { ...store.choices },
    extractionLevel: rate.value ? extractionLevel() : 0,
  };
});

const { result, error, loading } = useAutoCalc(request, (req): Plan => {
  const data = gameData();
  const planner = new Planner(data, req.choices, req.extractionLevel);
  const wanted = toQuantities(data, req.targets, req.rate);
  const have = toQuantities(data, req.stock, req.rate);
  return req.rate ? planner.rates(wanted, have) : planner.plan(wanted, have);
});
</script>
