// 案C：数字で直す（Q3 ②）。長老の木は★★★の実りを1枚2点→1点（★★★の点は2のまま）。自分の色に変える札（るつぼガニ・発酵キノコ）は変える数+1
const convertPlus = (c) => { for (const st of c.stages) for (const e of st.effects) if (e.do === 'convert') e.amount += 1; };
export default {
  長老の木: (c) => { c.stages[2].effects[0].amount = 1; },
  るつぼガニ: convertPlus,
  発酵キノコ: convertPlus,
};
