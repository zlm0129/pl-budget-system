// 核心计算引擎（纯函数，无 DOM 依赖）
// 移植自 Web 版 v36，口径与 Excel 完全一致：
//   净订单(净值) = 收入（不扣悦报销）
//   项目净订单毛利润 = 收入 - 成本（不扣悦报销）
//   净订单毛利率 = 毛利润 / 净订单(净值)
const { BIZ_TYPES, ROLE_PRESETS, getTypeName } = require('./constants.js');

const DAYS_PER_MONTH = 20.67;

function fmt(n) {
  if (n == null || isNaN(n)) return '¥0';
  return '¥' + Math.round(n).toLocaleString('zh-CN');
}
function pct(n) { return isNaN(n) ? '0.0%' : (n * 100).toFixed(1) + '%'; }
function pct2(n) { return isNaN(n) ? '0.00%' : (n * 100).toFixed(2) + '%'; }
function num(v) { return (v === '' || v == null || isNaN(v)) ? 0 : parseFloat(v); }

function tColor(rate) {
  if (rate >= 0.55) return '#34d399';
  if (rate >= 0.40) return '#6c8cff';
  if (rate >= 0.25) return '#fbbf24';
  return '#f87171';
}

// 主入口：state -> 全部展示数据
function calc(state) {
  const items = state.items || [];
  const swFixed = state.swFixed || {};
  const tpFixed = state.tpFixed || {};
  const market = state.market || {};
  const pm = state.pm || {};

  // ---- 第一遍：成本分量 ----
  const itemsRaw = [];
  let totalCostExTax = 0;
  let minTargetRate = 1;

  for (let c = 0; c < items.length; c++) {
    const it = items[c];
    const bt = BIZ_TYPES[it.typeKey] || BIZ_TYPES.custom_dev;
    let laborCost = 0;
    const staff = it.staff || [];
    for (let s = 0; s < staff.length; s++) {
      laborCost += num(staff[s].cost) * (num(staff[s].days) / DAYS_PER_MONTH);
    }
    const outTax = num(it.outsource) / 1.06;
    const hwTax = num(it.hwSw) / 1.13;
    const csTax = num(it.tpCS) / 1.09;
    const other = num(it.other);

    const itemSwCost = laborCost + outTax;
    const itemTpCost = hwTax + csTax + other;
    const itemCost = laborCost + outTax + hwTax + csTax + other;

    itemsRaw.push({ id: it.id, name: it.name, bt, typeKey: it.typeKey, itemCost, swCost: itemSwCost, tpCost: itemTpCost });
    if (bt.targetRate < minTargetRate) minTargetRate = bt.targetRate;
    totalCostExTax += itemCost;
  }

  // ---- 项目固定费用成本（嵌入 SW/TP 成本） ----
  const swFixedItems = [num(swFixed.meetingFee), num(swFixed.agencyFee), num(swFixed.techFee), num(swFixed.bidFee), num(swFixed.evalFee)];
  const tpFixedItems = [num(tpFixed.meetingFee), num(tpFixed.agencyFee), num(tpFixed.techFee), num(tpFixed.bidFee), num(tpFixed.evalFee)];
  let swFixedSum = 0, tpFixedSum = 0;
  for (let i = 0; i < swFixedItems.length; i++) swFixedSum += swFixedItems[i];
  for (let i = 0; i < tpFixedItems.length; i++) tpFixedSum += tpFixedItems[i];

  // ---- 全局悦报销费用 ----
  const mkt = [num(market.entertainmentFee), num(market.officeFee), num(market.trafficFee), num(market.welfareFee), num(market.travelFee)];
  const pmArr = [num(pm.trafficFee), num(pm.rentFee), num(pm.dailyOfficeFee), num(pm.welfareFee), num(pm.travelFee), num(pm.vehicleFee)];
  let mktSum = 0, pmSum = 0;
  for (let a = 0; a < mkt.length; a++) mktSum += mkt[a];
  for (let b = 0; b < pmArr.length; b++) pmSum += pmArr[b];
  const mktTax = mktSum / 1.06, pmTax = pmSum / 1.06;
  const mkt4Sum = num(market.officeFee) + num(market.trafficFee) + num(market.welfareFee) + num(market.travelFee);

  // ---- 第二遍：反算收入 + 分摊固定费用成本 ----
  let totalSwDirect = 0, totalTpDirect = 0;
  for (let rx = 0; rx < itemsRaw.length; rx++) { totalSwDirect += itemsRaw[rx].swCost; totalTpDirect += itemsRaw[rx].tpCost; }

  const itemsInfo = [];
  let totalRevExTax = 0, totalContract = 0;

  for (let p = 0; p < itemsRaw.length; p++) {
    const it = itemsRaw[p];
    const swFixedShare = totalSwDirect > 0 ? (it.swCost / totalSwDirect) * swFixedSum : 0;
    const tpFixedShare = totalTpDirect > 0 ? (it.tpCost / totalTpDirect) * tpFixedSum : 0;

    let R_i = it.itemCost / (1 - it.bt.targetRate);
    if (R_i < 0) R_i = 0;
    const contract_i = R_i * (1 + it.bt.inTax);

    const itemGross_i = R_i - it.itemCost;
    const itemNetOrder_i = R_i;
    const itemRate_i = (R_i > 0) ? itemGross_i / itemNetOrder_i : 0;

    const actual = num(getItemActual(items, it.id));
    const actualRev = actual > 0 ? actual / (1 + it.bt.inTax) : 0;
    const actualGross = actualRev - it.itemCost;
    const actualNet = actualRev;
    const actualRate = actual > 0 ? (actualNet > 0 ? actualGross / actualNet : -1) : null;

    totalRevExTax += R_i;
    totalContract += contract_i;

    itemsInfo.push({
      id: it.id, name: it.name, bt: it.bt, typeKey: it.typeKey, itemCost: it.itemCost,
      neededRev: R_i, neededContract: contract_i, netOrder_i: itemNetOrder_i, itemRate_i,
      swCost: it.swCost + swFixedShare, tpCost: it.tpCost + tpFixedShare,
      swFixedShare, tpFixedShare, actual, actualRev, actualRate
    });
  }

  // ---- 项目级实际值 ----
  let projActualRev = 0, projActualCost = 0;
  for (let p2 = 0; p2 < itemsRaw.length; p2++) {
    const it2 = itemsRaw[p2];
    const actual2 = num(getItemActual(items, it2.id));
    if (actual2 > 0) {
      projActualRev += actual2 / (1 + it2.bt.inTax);
      projActualCost += it2.itemCost;
    }
  }
  const projActualGross = projActualRev - projActualCost;
  const projActualNet = projActualRev;
  const projActualRate = projActualNet > 0 ? projActualGross / projActualNet : 0;

  // ---- 整体净订单毛利率 ----
  const projG = totalRevExTax - totalCostExTax - swFixedSum - tpFixedSum - mktTax - pmTax;
  const netO = totalRevExTax - mktTax - pmTax;
  const overallNetRate = netO > 0 ? projG / netO : 0;
  const displayOverallRate = projActualRev > 0 ? projActualRate : overallNetRate;

  // ---- 子项展示对象（替代 innerHTML） ----
  const itemDisplays = itemsInfo.map((inf) => {
    const bt = inf.bt;
    const staff = (items.find((x) => x.id === inf.id) || {}).staff || [];
    let totalMM = 0, totalLabor = 0;
    for (let i = 0; i < staff.length; i++) { totalMM += num(staff[i].days) / DAYS_PER_MONTH; totalLabor += num(staff[i].cost) * (num(staff[i].days) / DAYS_PER_MONTH); }
    const avgMM = totalMM > 0 ? fmt(Math.round(totalLabor / totalMM)) + '（' + totalMM.toFixed(1) + '人月）' : '';

    const displayRate = (inf.actualRate !== null && inf.actualRate >= 0) ? inf.actualRate : inf.itemRate_i;
    const ratePass = displayRate >= bt.targetRate - 0.001;
    const hasActual = inf.actual > 0;
    const actualPass = inf.actualRate !== null ? inf.actualRate >= bt.targetRate - 0.001 : false;

    return {
      id: inf.id, name: inf.name, typeName: getTypeName(inf.typeKey),
      meta: '目标毛利 ' + Math.round(bt.targetRate * 100) + '% · 收入税率 ' + Math.round(bt.inTax * 100) + '%',
      dispCost: fmt(inf.itemCost),
      dispRev: fmt(Math.round(inf.neededRev)),
      dispRate: pct(displayRate), ratePass,
      avgMM, dispContract: fmt(Math.round(inf.neededContract)),
      hasActual,
      actualDispRate: inf.actualRate !== null && !isNaN(inf.actualRate) ? pct(inf.actualRate) : '',
      actualDispRev: fmt(Math.round(inf.actualRev)),
      actualPass, actualOver: inf.actualRate < 0
    };
  });

  // ---- 子项净订单毛利率卡片 ----
  const itemRates = itemsInfo.map((inf) => {
    const bt = inf.bt;
    const itemCalcRate = inf.itemRate_i || bt.targetRate;
    const itemPass = itemCalcRate >= bt.targetRate - 0.001;
    const diffPct = ((itemCalcRate - bt.targetRate) * 100).toFixed(1);
    const rateColor = tColor(bt.targetRate);
    return {
      name: inf.name || getTypeName(inf.typeKey),
      inTaxPct: Math.round(bt.inTax * 100) + '%',
      targetPct: pct(bt.targetRate),
      actualPct: pct(itemCalcRate),
      pass: itemPass, diffAbs: Math.abs(diffPct),
      rateColor
    };
  });

  // ---- 项目损益总表 ----
  const useActual = projActualRev > 0;
  const projRev = useActual ? projActualRev : totalRevExTax;
  const projCost = totalCostExTax;
  const projGross = useActual ? projActualGross : (projRev - projCost);
  const netOrder = useActual ? projActualNet : projRev;
  const fixedFees = mktSum + pmSum;
  const netProfit = projGross - fixedFees;
  const projNetMarginRate = netOrder > 0 ? projGross / netOrder : 0;
  const projMarginRate = projRev > 0 ? projGross / projRev : 0;
  const projNetProfitRate = netOrder > 0 ? netProfit / netOrder : 0;
  const projNetRateAll = projRev > 0 ? netProfit / projRev : 0;

  let swRev = 0, swCost = 0, swGross = 0, tpRev = 0, tpCost = 0, tpGross = 0;
  for (let i = 0; i < itemsInfo.length; i++) {
    const it = itemsInfo[i];
    const rev = it.neededRev;
    const itemSwCost = it.swCost, itemTpCost = it.tpCost;
    const swRevShare2 = (itemSwCost + itemTpCost > 0) ? rev * (itemSwCost / (itemSwCost + itemTpCost)) : 0;
    const tpRevShare2 = (itemSwCost + itemTpCost > 0) ? rev * (itemTpCost / (itemSwCost + itemTpCost)) : 0;
    const swGrossShare = swRevShare2 - itemSwCost;
    const tpGrossShare = tpRevShare2 - itemTpCost;
    swRev += swRevShare2; swCost += itemSwCost; swGross += swGrossShare;
    tpRev += tpRevShare2; tpCost += itemTpCost; tpGross += tpGrossShare;
  }
  if (useActual && (swRev + tpRev) > 0 && projRev > 0) {
    const scale = projRev / (swRev + tpRev);
    swRev *= scale; tpRev *= scale; swGross = swRev - swCost; tpGross = tpRev - tpCost;
  }
  const swNetRate = swRev > 0 ? (swRev - swCost) / swRev : 0;
  const tpNetRate = tpRev > 0 ? (tpRev - tpCost) / tpRev : 0;

  const rows = [];
  function pushRow(label, valText, opts) {
    opts = opts || {};
    rows.push({
      label, val: valText, note: opts.note || '',
      indent: !!opts.indent, isGroup: !!opts.isGroup, isSubhead: !!opts.isSubhead,
      isHighlight: !!opts.isHighlight,
      valCls: opts.valCls || (opts.neg ? 'neg' : (opts.pos ? 'pos' : 'plain'))
    });
  }

  if (itemsInfo.length === 0) {
    pushRow('暂无数据，请添加子项后重新计算', '', { isGroup: true });
  } else {
    pushRow('项目毛利', '', { isGroup: true });
    pushRow('软件/服务项目毛利', '', { isSubhead: true });
    pushRow('软件/服务收入', fmt(Math.round(swRev)), { indent: true, pos: true });
    pushRow('软件/服务成本（人工成本、委外成本、固定费用成本）', fmt(Math.round(swCost)), { indent: true });
    if (swFixedSum > 0) pushRow('　└ 其中：固定费用成本', fmt(Math.round(swFixedSum)), { indent: true });
    pushRow('软件/服务毛利', fmt(Math.round(swGross)), { indent: true, neg: swGross < 0 });
    pushRow('软件/服务毛利率', (swRev > 0 ? (swGross / swRev * 100).toFixed(2) + '%' : '0.00%'), { indent: true });
    pushRow('软件/服务净订单毛利率', pct2(swNetRate), { indent: true, neg: swNetRate < 0 });

    pushRow('第三方采购项目毛利', '', { isSubhead: true });
    pushRow('第三方收入', fmt(Math.round(tpRev)), { indent: true, pos: true });
    pushRow('第三方成本', fmt(Math.round(tpCost)), { indent: true });
    if (tpFixedSum > 0) pushRow('　└ 其中：固定费用成本', fmt(Math.round(tpFixedSum)), { indent: true });
    pushRow('第三方毛利', fmt(Math.round(tpGross)), { indent: true, neg: tpGross < 0 });
    pushRow('第三方毛利率', (tpRev > 0 ? (tpGross / tpRev * 100).toFixed(2) + '%' : '0.00%'), { indent: true });
    pushRow('第三方净订单毛利率', pct2(tpNetRate), { indent: true, neg: tpNetRate < 0 });

    pushRow('项目损益汇总', '', { isGroup: true });
    pushRow('净订单（净值）', fmt(Math.round(netOrder)), { indent: true, pos: netOrder >= 0 });
    pushRow('项目收入（不含税）', fmt(Math.round(projRev)), { indent: true, pos: true });
    pushRow('项目成本及费用', fmt(Math.round(swCost + tpCost + mktSum + pmSum)), { indent: true });
    pushRow('固定费用合计（悦报销）', fmt(Math.round(mktSum + pmSum)), { indent: true });
    pushRow('项目固定费用成本合计', fmt(Math.round(swFixedSum + tpFixedSum)), { indent: true });
    pushRow('项目净订单毛利润', fmt(Math.round(projGross)), { indent: true, neg: projGross < 0 });
    pushRow('项目净订单净利润', fmt(Math.round(netProfit)), { indent: true, neg: netProfit < 0 });
    pushRow('★ 项目净订单毛利率', (projNetMarginRate * 100).toFixed(2) + '%', { isHighlight: true, indent: true, note: '= 项目净订单毛利润 ÷ 净订单(净值)' });
    pushRow('项目毛利率', (projMarginRate * 100).toFixed(2) + '%', { indent: true, note: '= 项目净订单毛利润 ÷ 不含税收入' });
    pushRow('项目净订单净利润率', (projNetProfitRate * 100).toFixed(2) + '%', { indent: true });
    pushRow('项目净利率', (projNetRateAll * 100).toFixed(2) + '%', { indent: true });
  }

  // ---- 费用上限检查 ----
  const limitNetO = totalRevExTax - mktTax - pmTax;
  const limitEnt = limitNetO * 0.037;
  const limitMkt4 = limitNetO * 0.02;
  const limitPM = limitNetO * 0.02;
  const pmTotal = pmArr.reduce((a, b) => a + b, 0);
  const entVal = num(market.entertainmentFee);

  return {
    itemDisplays,
    itemRates,
    overview: {
      costExTax: fmt(totalCostExTax),
      revExTax: fmt(totalRevExTax),
      contract: fmt(totalContract),
      overallRatePct: pct(displayOverallRate),
      overallTargetPct: Math.round(minTargetRate * 100) + '%',
      pass: displayOverallRate >= minTargetRate,
      diffPct: ((minTargetRate - displayOverallRate) * 100).toFixed(1)
    },
    fixed: {
      swFixedSum: fmt(swFixedSum), tpFixedSum: fmt(tpFixedSum),
      mktSum: fmt(mktSum), pmSum: fmt(pmSum), mkt4Sum: fmt(mkt4Sum),
      totalExpense: fmt(mktSum + pmSum)
    },
    feeLimits: {
      entertainment: { limit: limitEnt > 0 ? fmt(limitEnt) : '--', value: entVal, over: limitEnt > 0 && entVal > limitEnt },
      market: { limit: limitMkt4 > 0 ? fmt(limitMkt4) : '--', sum: mkt4Sum, over: limitMkt4 > 0 && mkt4Sum > limitMkt4, overAmt: Math.round(mkt4Sum - limitMkt4) },
      pm: { limit: limitPM > 0 ? fmt(limitPM) : '--', sum: pmTotal, over: limitPM > 0 && pmTotal > limitPM, overAmt: Math.round(pmTotal - limitPM) }
    },
    plSummary: rows,
    raw: {
      totalCostExTax, totalRevExTax, totalContract,
      swFixedSum, tpFixedSum, mktSum, pmSum, mkt4Sum,
      projActualRev, projActualGross, projActualNet,
      overallNetRate, projNetMarginRate,
      items: itemsInfo.map((i) => ({
        name: i.name, typeKey: i.typeKey, itemCost: i.itemCost,
        neededRev: i.neededRev, neededContract: i.neededContract,
        itemRate_i: i.itemRate_i, swCost: i.swCost, tpCost: i.tpCost,
        actual: i.actual, actualRev: i.actualRev, actualRate: i.actualRate
      }))
    }
  };
}

// 从 state.items 取某子项的实际合同金额
function getItemActual(items, id) {
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === id) return items[i].actual;
  }
  return 0;
}

module.exports = { calc, fmt, pct, pct2, num, DAYS_PER_MONTH };
