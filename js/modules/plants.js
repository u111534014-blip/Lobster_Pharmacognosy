/*
 * 功能模組：植物個論
 * 題幹是「植物個論」工作表的中文植物名，從選項選出所有屬於這種植物的內容（學名、科別、功效、特徵…）
 * 記錄存在 App.store 的 'plantQuiz'，題目 id 是中文植物名
 */
App.factModule({
  id: 'plants', title: '植物個論', storeKey: 'plantQuiz',
  dataKey: 'plants', unit: '種', noun: '植物', head: '植物',
  blurb: '看植物名選學名、科別、功效與特徵',
  ask: '選出所有屬於這種植物的內容（可複選）',
  grouped: true
});
