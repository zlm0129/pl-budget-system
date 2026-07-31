const { BIZ_KEYS, BIZ_TYPES, ROLE_PRESETS, getTypeName } = require('../../utils/constants.js');
const { calc, fmt, DAYS_PER_MONTH } = require('../../utils/calc.js');

const MAX_ITEMS = BIZ_KEYS.length;

function defaultItem(id) {
  return {
    id,
    name: '',
    typeKey: 'custom_dev',
    typeIndex: 1,
    staff: [defaultStaff(1)],
    outsource: '', hwSw: '', tpCS: '', other: '', actual: ''
  };
}
function defaultStaff(rid, roleKey, cost, days) {
  const rk = roleKey || 'dev_general';
  let c = cost;
  if (c == null) {
    for (let i = 0; i < ROLE_PRESETS.length; i++) if (ROLE_PRESETS[i].key === rk) c = ROLE_PRESETS[i].cost || 18000;
  }
  const idx = ROLE_PRESETS.findIndex((r) => r.key === rk);
  return { rid, roleKey: rk, roleIndex: idx < 0 ? 0 : idx, cost: c, days: days || '' };
}

Page({
  data: {
    bizKeys: BIZ_KEYS,
    bizNames: BIZ_KEYS.map((k) => getTypeName(k)),
    roleNames: ROLE_PRESETS.map((r) => r.label + ' (' + fmt(r.cost) + '/月)'),
    maxItems: MAX_ITEMS,
    project: { projectName: '', quoteValidity: '', customerName: '', salesName: '', presaleName: '', salesPhone: '' },
    items: [],
    swFixed: { meetingFee: '', agencyFee: '', techFee: '', bidFee: '', evalFee: '' },
    tpFixed: { meetingFee: '', agencyFee: '', techFee: '', bidFee: '', evalFee: '' },
    market: { entertainmentFee: '', officeFee: '', trafficFee: '', welfareFee: '', travelFee: '' },
    pm: { trafficFee: '', rentFee: '', dailyOfficeFee: '', welfareFee: '', travelFee: '', vehicleFee: '' },
    pay: { pay1Pct: '', pay2Pct: '', pay3Pct: '', pay4Pct: '' },
    itemCount: 0,
    result: null,
    collapsed: { fixed: false, market: false, pm: false, payment: false }
  },

  onLoad() {
    const items = [defaultItem(1)];
    this.setData({ items, itemCount: items.length }, () => this.recalc());
  },

  // 通用：从 data 构造纯 state 并调用 calc
  recalc() {
    const d = this.data;
    const result = calc({
      project: d.project,
      items: d.items,
      swFixed: d.swFixed,
      tpFixed: d.tpFixed,
      market: d.market,
      pm: d.pm,
      pay: d.pay
    });
    // 将展示字段合并回 items，方便 WXML 按项渲染
    const displays = result.itemDisplays || [];
    const items = d.items.map((it, idx) => {
      const n = Object.assign({}, it);
      n.display = displays[idx] || {};
      return n;
    });
    this.setData({ result, items });
  },

  // ---- 项目信息 ----
  onProjectInput(e) {
    const field = e.currentTarget.dataset.field;
    const project = Object.assign({}, this.data.project);
    project[field] = e.detail.value;
    this.setData({ project });
  },

  // ---- 子项 ----
  addItem() {
    if (this.data.items.length >= MAX_ITEMS) {
      wx.showToast({ title: '已达子项上限(' + MAX_ITEMS + ')', icon: 'none' });
      return;
    }
    const items = this.data.items.slice();
    const nextId = items.length ? Math.max.apply(null, items.map((i) => i.id)) + 1 : 1;
    items.push(defaultItem(nextId));
    this.setData({ items, itemCount: items.length }, () => this.recalc());
  },
  removeItem(e) {
    const iid = e.currentTarget.dataset.iid;
    const items = this.data.items.filter((i) => i.id !== iid);
    this.setData({ items, itemCount: items.length }, () => this.recalc());
  },
  onItemInput(e) {
    const { iid, field } = e.currentTarget.dataset;
    const items = this.data.items.map((i) => {
      if (i.id !== iid) return i;
      const n = Object.assign({}, i);
      n[field] = e.detail.value;
      return n;
    });
    this.setData({ items }, () => this.recalc());
  },
  onItemTypeChange(e) {
    const iid = e.currentTarget.dataset.iid;
    const idx = parseInt(e.detail.value, 10);
    const key = BIZ_KEYS[idx];
    const items = this.data.items.map((i) => {
      if (i.id !== iid) return i;
      const n = Object.assign({}, i);
      n.typeKey = key; n.typeIndex = idx;
      return n;
    });
    this.setData({ items }, () => this.recalc());
  },
  applyItemRec(e) {
    const iid = e.currentTarget.dataset.iid;
    const idx = this.data.items.findIndex((i) => i.id === iid);
    if (idx < 0) return;
    const raw = (this.data.result && this.data.result.raw && this.data.result.raw.items) || [];
    const contract = raw[idx] ? Math.round(raw[idx].neededContract) : '';
    const items = this.data.items.map((i) => {
      if (i.id !== iid) return i;
      const n = Object.assign({}, i);
      n.actual = contract || '';
      return n;
    });
    this.setData({ items }, () => this.recalc());
    wx.showToast({ title: '已填入推荐合同', icon: 'none' });
  },

  // ---- 人员 ----
  addStaff(e) {
    const iid = e.currentTarget.dataset.iid;
    const items = this.data.items.map((i) => {
      if (i.id !== iid) return i;
      const n = Object.assign({}, i);
      const staff = n.staff.slice();
      const nextRid = staff.length ? Math.max.apply(null, staff.map((s) => s.rid)) + 1 : 1;
      staff.push(defaultStaff(nextRid));
      n.staff = staff;
      return n;
    });
    this.setData({ items }, () => this.recalc());
  },
  removeStaffRow(e) {
    const { iid, rid } = e.currentTarget.dataset;
    const items = this.data.items.map((i) => {
      if (i.id !== iid) return i;
      const n = Object.assign({}, i);
      n.staff = n.staff.filter((s) => s.rid !== rid);
      return n;
    });
    this.setData({ items }, () => this.recalc());
  },
  onStaffInput(e) {
    const { iid, rid, field } = e.currentTarget.dataset;
    const items = this.data.items.map((i) => {
      if (i.id !== iid) return i;
      const n = Object.assign({}, i);
      n.staff = n.staff.map((s) => {
        if (s.rid !== rid) return s;
        const ns = Object.assign({}, s);
        ns[field] = e.detail.value;
        return ns;
      });
      return n;
    });
    this.setData({ items }, () => this.recalc());
  },
  onStaffRoleChange(e) {
    const { iid, rid } = e.currentTarget.dataset;
    const idx = parseInt(e.detail.value, 10);
    const rk = ROLE_PRESETS[idx].key;
    let cost = ROLE_PRESETS[idx].cost;
    const items = this.data.items.map((i) => {
      if (i.id !== iid) return i;
      const n = Object.assign({}, i);
      n.staff = n.staff.map((s) => {
        if (s.rid !== rid) return s;
        const ns = Object.assign({}, s);
        ns.roleKey = rk; ns.roleIndex = idx;
        if (cost > 0) ns.cost = cost;
        return ns;
      });
      return n;
    });
    this.setData({ items }, () => this.recalc());
  },

  // ---- 固定费用 / 悦报销 / 收款 ----
  onGroupInput(e) {
    const { group, field } = e.currentTarget.dataset;
    const obj = Object.assign({}, this.data[group]);
    obj[field] = e.detail.value;
    const patch = {}; patch[group] = obj;
    this.setData(patch, () => this.recalc());
  },

  // ---- 折叠 ----
  toggleCollapse(e) {
    const key = e.currentTarget.dataset.key;
    const collapsed = Object.assign({}, this.data.collapsed);
    collapsed[key] = !collapsed[key];
    this.setData({ collapsed });
  },

  // ---- 重置 / 示例 ----
  resetAll() {
    wx.showModal({
      title: '确认', content: '确定清空所有数据？', success: (res) => {
        if (!res.confirm) return;
        const items = [defaultItem(1)];
        const empty = (o) => Object.keys(o).reduce((a, k) => (a[k] = '', a), {});
        this.setData({
          project: { projectName: '', quoteValidity: '', customerName: '', salesName: '', presaleName: '', salesPhone: '' },
          items, itemCount: items.length,
          swFixed: empty(this.data.swFixed), tpFixed: empty(this.data.tpFixed),
          market: empty(this.data.market), pm: empty(this.data.pm), pay: empty(this.data.pay)
        }, () => this.recalc());
      }
    });
  },
  autoFillDemo() {
    const items = [defaultItem(1)];
    items[0].name = '智慧交管平台定制开发';
    items[0].staff = [
      defaultStaff(1, 'dev_general', 18000, 124),
      defaultStaff(2, 'bigdata', 23000, 41),
      defaultStaff(3, 'algorithm', 30000, 21)
    ];
    items[0].outsource = 60000; items[0].hwSw = 80000; items[0].tpCS = 0; items[0].other = 5000; items[0].actual = '';
    this.setData({
      items, itemCount: items.length,
      market: { entertainmentFee: 15000, officeFee: '', trafficFee: '', welfareFee: '', travelFee: 20000 },
      swFixed: { meetingFee: 3000, agencyFee: 5000, techFee: '', bidFee: '', evalFee: '' },
      tpFixed: { meetingFee: 2000, agencyFee: '', techFee: '', bidFee: 3000, evalFee: '' },
      pm: { trafficFee: '', rentFee: 8000, dailyOfficeFee: '', welfareFee: '', travelFee: '', vehicleFee: 5000 }
    }, () => this.recalc());
    wx.showToast({ title: '已填入示例', icon: 'none' });
  },

  // ---- 导出 ----
  exportPL() { require('../../utils/export.js').exportPL(this.data); },
  exportQuote() { require('../../utils/export.js').exportQuote(this.data); },
  exportJSON() { require('../../utils/export.js').exportJSON(this.data); },

  onShareAppMessage() {
    return { title: '项目预算损益表 PL 系统', path: '/pages/index/index' };
  }
});
