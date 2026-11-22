// 案B：数字で直す（Q3 ②）。長老の木の★★★の実りを1枚2点→1点（★★★の点は2→4）、変換の札は変える数をどの★でも+1
const convertPlus = (c) => { for (const st of c.stages) for (const e of st.effects) if (e.do === 'convert') e.amount += 1; };
export default {
  長老の木: (c) => { c.stages[2].effects[0].amount = 1; c.stages[2].points = 4; },
  水車のビーバー: convertPlus,
  鏡のネコ: convertPlus,
  両替カラス: convertPlus,
  るつぼガニ: convertPlus,
  発酵キノコ: convertPlus,
};
