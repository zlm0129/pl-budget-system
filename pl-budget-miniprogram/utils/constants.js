// 业务类型与角色预设（与 Web 版 v36 完全一致）
const BIZ_KEYS = [
  'self_software', 'custom_dev', 'integration_impl', 'maintenance',
  'hr_frame', 'sys_integration', 'service_integration'
];

const BIZ_TYPES = {
  self_software:      { name: '自研软件产品销售项目', remark: '', targetRate: 0.60, inTax: 0.13 },
  custom_dev:         { name: '软件定制化开发项目',   remark: '', targetRate: 0.45, inTax: 0.06 },
  integration_impl:   { name: '集成实施项目',         remark: '（外采硬件+部署）', targetRate: 0.60, inTax: 0.06 },
  maintenance:        { name: '运行维护项目',         remark: '', targetRate: 0.40, inTax: 0.06 },
  hr_frame:           { name: '人力框架项目',         remark: '', targetRate: 0.30, inTax: 0.06 },
  sys_integration:    { name: '系统集成项目',         remark: '（外采软硬件+交付）', targetRate: 0.20, inTax: 0.13 },
  service_integration:{ name: '服务集成项目',         remark: '（外采服务+交付）', targetRate: 0.20, inTax: 0.06 }
};

const ROLE_PRESETS = [
  { key: 'dev_general', label: '一般研发',   cost: 18000 },
  { key: 'bigdata',     label: '大数据',     cost: 23000 },
  { key: 'algorithm',   label: '算法工程师', cost: 30000 },
  { key: 'custom',      label: '自定义',     cost: 0 }
];

function getTypeName(key) {
  const bt = BIZ_TYPES[key];
  return bt ? (bt.name + (bt.remark || '')) : key;
}

module.exports = { BIZ_KEYS, BIZ_TYPES, ROLE_PRESETS, getTypeName };
