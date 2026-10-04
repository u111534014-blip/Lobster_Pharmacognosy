/*
 * 功能模組：植物構造-花
 * 題幹是「花」工作表的名詞，從選項選出所有屬於這個名詞的內容
 * 記錄存在 App.store 的 'flowerQuiz'，題目 id 是名詞
 */
App.factModule({
  id: 'flowers', title: '植物構造-花', storeKey: 'flowerQuiz',
  dataKey: 'flowers', unit: '個', noun: '名詞', head: '花',
  blurb: '看花的構造名詞選出對應的內容',
  ask: '選出所有屬於這個名詞的內容（可複選）'
});
