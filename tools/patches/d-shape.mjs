// 案D：案C ＋ 効果の形（Q3 ③、相談する）。好きな色に変える札（鏡のネコ・水車のビーバー・両替カラス）は、開花ではなく「手入れ」（育てる前に好きなときに1回）で変える
import c from './c-numbers.mjs';
const toUse = (card) => { for (const st of card.stages) for (const e of st.effects) if (e.do === 'convert') e.when = 'use'; };
export default { ...c, 鏡のネコ: toUse, 水車のビーバー: toUse, 両替カラス: toUse };
