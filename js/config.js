/*
 * 題庫設定
 * sheetUrl：Google 試算表的分享連結（「知道連結的任何人」都能檢視）。
 *           留空就只用 js/data/families.js 內建的題庫。
 * 工作表名稱要和試算表下方的分頁名稱一模一樣。
 */
window.App = window.App || {};
App.config = {
  sheetUrl: '',
  familySheet: '科名',
  traitSheet: '植物特徵'
};
