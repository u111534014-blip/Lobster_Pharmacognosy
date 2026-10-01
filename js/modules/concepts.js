/*
 * 功能模組：概論/通則
 * 題幹是「概論通則」工作表的名詞，從選項選出所有屬於這個名詞的內容
 * 記錄存在 App.store 的 'conceptQuiz'，題目 id 是名詞
 */
App.factModule({
  id: 'concepts', title: '概論/通則', storeKey: 'conceptQuiz',
  dataKey: 'concepts', unit: '個', noun: '名詞', head: '名詞',
  blurb: '看名詞選出對應的內容',
  ask: '選出所有屬於這個名詞的內容（可複選）'
});
