// 案E：案C ＋ 効果の形（Q3 ③、相談する）。好きな色に変える札（鏡のネコ・水車のビーバー・両替カラス）は、どの★でも開花で好きな色を1つ得る（変える力はそのまま）
import c from './c-numbers.mjs';
const plusAny = (card) => { for (const st of card.stages) st.effects.push({ when: 'activate', do: 'gain', color: 'any', amount: 1 }); };
export default { ...c, 鏡のネコ: plusAny, 水車のビーバー: plusAny, 両替カラス: plusAny };
