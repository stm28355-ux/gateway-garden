// 案A：値段から直す（Q3 ①）。長老の木は値段を上げ、弱い変換2枚は値段を下げる
export default {
  長老の木: (c) => { c.cost = { green: 3, any: 1 }; },
  水車のビーバー: (c) => { c.cost = { blue: 2 }; },
  鏡のネコ: (c) => { c.cost = { white: 1 }; },
};
