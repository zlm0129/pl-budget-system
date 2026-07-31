// 导出工具（小程序端）
// 说明：小程序无 openpyxl/DOM，无法直接回填用户 Excel 模板。
// 采用与 Web 版一致的 SpreadsheetML(.xls) 方案，手机端 Excel/WPS 可直接打开；
// 同时提供 JSON 复制（最稳妥，可交由后端/电脑生成正式模板）。
const { calc, fmt } = require('./calc.js');
const { getTypeName } = require('./constants.js');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 生成 SpreadsheetML 2003 的 .xls 文本
function buildXls(rows) {
  let body = '';
  for (let r = 0; r < rows.length; r++) {
    const cells = rows[r];
    let row = '<Row>';
    for (let c = 0; c < cells.length; c++) {
      const v = cells[c];
      const t = typeof v === 'number' ? 'Number' : 'String';
      row += '<Cell><Data ss:Type="' + t + '">' + esc(v) + '</Data></Cell>';
    }
    row += '</Row>';
    body += row;
  }
  return '<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ' +
    'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n' +
    '<Worksheet ss:Name="Sheet1"><Table>' + body + '</Table></Worksheet>\n</Workbook>';
}

function saveAndOpen(content, filename) {
  const fs = wx.getFileSystemManager();
  const path = `${wx.env.USER_DATA_PATH}/${filename}`;
  // 前置 BOM 保证中文在 Excel/WPS 中不乱码
  fs.writeFile({
    filePath: path,
    data: '\ufeff' + content,
    encoding: 'utf8',
    success: () => {
      wx.openDocument({
        filePath: path,
        fileType: 'xls',
        showMenu: true,
        success: () => {},
        fail: (err) => {
          wx.showModal({ title: '打开失败', content: '请手动在文件管理中打开：' + path + '\n' + (err && err.errMsg || ''), showCancel: false });
        }
      });
    },
    fail: (err) => {
      wx.showToast({ title: '保存失败', icon: 'none' });
      console.error('writeFile fail', err);
    }
  });
}

function exportPL(data) {
  try {
    const r = calc({
      project: data.project, items: data.items, swFixed: data.swFixed,
      tpFixed: data.tpFixed, market: data.market, pm: data.pm, pay: data.pay
    });
    const rows = [];
    const p = data.project;
    rows.push(['项目预算损益表 PL 表']);
    rows.push(['项目名称', p.projectName || '（未填）']);
    rows.push(['客户名称', p.customerName || '']);
    rows.push(['销售姓名', p.salesName || '']);
    rows.push(['售前姓名', p.presaleName || '']);
    rows.push(['报价有效期', p.quoteValidity || '']);
    rows.push([]);
    rows.push(['项目净订单毛利率标准（参考）']);
    rows.push(['自研软件产品销售', '≥60%', '软件定制化开发', '≥45%']);
    rows.push(['集成实施(外采硬件+部署)', '≥60%', '运行维护', '≥40%']);
    rows.push(['人力框架', '≥30%', '系统集成(软硬件+交付)', '≥20%']);
    rows.push(['服务集成(服务+交付)', '≥20%']);
    rows.push([]);
    rows.push(['项目损益总表']);
    for (let i = 0; i < r.plSummary.length; i++) {
      const row = r.plSummary[i];
      if (row.isGroup || row.isSubhead) {
        rows.push([row.label]);
      } else {
        rows.push([row.label, row.val, row.note]);
      }
    }
    rows.push([]);
    rows.push(['公式：项目净订单毛利率 = 项目净订单毛利润 ÷ 净订单（净值）']);
    saveAndOpen(buildXls(rows), 'PL表_' + (p.projectName || '未命名') + '.xls');
  } catch (e) {
    console.error('exportPL', e);
    wx.showToast({ title: '生成失败', icon: 'none' });
  }
}

function exportQuote(data) {
  try {
    const r = calc({
      project: data.project, items: data.items, swFixed: data.swFixed,
      tpFixed: data.tpFixed, market: data.market, pm: data.pm, pay: data.pay
    });
    const p = data.project;
    const rows = [];
    rows.push(['正式报价单']);
    rows.push(['客户名称', p.customerName || '（必填）']);
    rows.push(['项目名称', p.projectName || '（必填）']);
    rows.push(['销售姓名', p.salesName || '（必填）']);
    rows.push(['销售电话', p.salesPhone || '（必填）']);
    rows.push(['报价有效期', p.quoteValidity || '（必填）']);
    rows.push(['售前姓名', p.presaleName || '']);
    rows.push([]);
    rows.push(['序号', '子项名称', '业务类型', '推荐合同(含税)', '净订单毛利率']);
    const displays = r.itemDisplays || [];
    for (let i = 0; i < displays.length; i++) {
      const d = displays[i];
      rows.push([i + 1, d.name || '（未命名子项）', d.typeName, d.dispContract, d.dispRate]);
    }
    rows.push([]);
    rows.push(['合计（含税合同）', r.overview.contract]);
    rows.push(['整体净订单毛利率', r.overview.overallRatePct]);
    saveAndOpen(buildXls(rows), '报价单_' + (p.projectName || '未命名') + '.xls');
  } catch (e) {
    console.error('exportQuote', e);
    wx.showToast({ title: '生成失败', icon: 'none' });
  }
}

function exportJSON(data) {
  const out = {
    project: data.project,
    items: data.items.map((it) => ({
      name: it.name, typeKey: it.typeKey,
      staff: (it.staff || []).map((s) => ({ roleKey: s.roleKey, cost: s.cost, days: s.days })),
      outsource: it.outsource, hwSw: it.hwSw, tpCS: it.tpCS, other: it.other, actual: it.actual
    })),
    swFixed: data.swFixed, tpFixed: data.tpFixed, market: data.market, pm: data.pm, pay: data.pay
  };
  wx.setClipboardData({
    data: JSON.stringify(out, null, 2),
    success: () => wx.showToast({ title: 'JSON已复制', icon: 'none' })
  });
}

module.exports = { exportPL, exportQuote, exportJSON };
