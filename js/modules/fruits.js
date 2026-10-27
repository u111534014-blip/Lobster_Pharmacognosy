/*
 * 功能模組：植物構造-果實
 * 題幹是「果實」工作表的名詞，從選項選出所有屬於這個名詞的內容；可加「分組」欄（用法同「花」）
 * 記錄存在 App.store 的 'fruitQuiz'，題目 id 是名詞
 */
App.factModule({
  id: 'fruits', title: '植物構造-果實', storeKey: 'fruitQuiz',
  dataKey: 'fruits', unit: '個', noun: '名詞', head: '果實',
  blurb: '看果實的構造名詞選出對應的內容',
  ask: '選出所有屬於這個名詞的內容（可複選）'
});
