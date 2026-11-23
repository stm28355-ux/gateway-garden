// 拡張「天体の錬金術（Celestial Alchemy）」の住人の絵（32×32）。基本セットと同じ道具・太い縁取り。
// 人には顔を描き、素材・刻印・器（物）には描かない。
// 素材は Celestial Alchemy の元の絵と同じ「素材の色のブロックに、白っぽい印」（判定 A2・A3）。色も元のゲームのまま。
// 1回目の見本：マルタ（人）・サラマンダーの火種・氷竜の鱗（素材）。残りは見本の判定の後。
import { grid, toSvg } from './pixel.js';

const P = {
  ink: '#1d1a33',
  skin: '#fde6cf', skinShade: '#f0c9a8', hair: '#3e3a44', hairLight: '#5a5563',
  band: '#e2574c', bandShade: '#b5523a', apron: '#b5523a', apronLight: '#d06a4e', shirt: '#d9e0ea', shirtShade: '#b4bfcf',
  wood: '#a0703e', woodShade: '#7a5230', steel: '#8a8f9c', steelLight: '#c6cbd6',
  fire: '#f0882a', fireHot: '#ffd15c', fireCore: '#fff1d6', fireDeep: '#c45a10',
  ice: '#cdeefa', iceLight: '#ffffff', iceDeep: '#6fb6cf', iceMid: '#9fd6ec',
  brow: '#2a2630', mouth: '#8a3a2c',
  // 器と刻印（元のゲームの器の木の枠・中の地・刻印の色）
  wood: '#8a5a36', woodDark: '#6a4327', woodLight: '#a8744a', inside: '#fbf3e3', rune: '#c8a46a', runeDeep: '#a07c3e',
};

// 素材のブロック：素材の色の四角に、上の光の帯と、下の影（元のゲームのピース1マスと同じ）
const block = (fill, light, shade) => grid().rect(3, 3, 28, 28, fill).rect(5, 5, 26, 7, light).rect(3, 26, 28, 28, shade);

const DRAW = {
  // マルタ（火星の錬金術師）：黒い髪に赤い鉢巻、赤い前かけ。肩に鍛冶のかなづち。口数の少ない落ち着いた目
  marta: () => grid()
    .line(25, 30, 27, 13, P.wood).line(26, 30, 28, 13, P.woodShade) // かなづちの柄（右肩に立てかける）
    .rect(23, 8, 31, 12, P.steel).rect(23, 8, 31, 9, P.steelLight) // かなづちの頭
    .ellipse(14, 27, 10, 5, P.shirt).tint(4, 29, 24, 31, P.shirtShade, P.shirt) // 肩と服
    .poly([[8, 23], [20, 23], [22, 31], [6, 31]], P.apron).tint(8, 23, 20, 24, P.apronLight, P.apron) // 前かけ
    .rect(12, 19, 16, 22, P.skinShade) // 首
    .ellipse(14, 13, 7, 7, P.skin).tint(8, 17, 20, 20, P.skinShade, P.skin) // 顔
    .ellipse(14, 6, 8, 4, P.hair).rect(6, 6, 7, 16, P.hair).rect(21, 6, 22, 16, P.hair).tint(9, 2, 19, 3, P.hairLight, P.hair) // 髪
    .rect(6, 7, 22, 8, P.band).rect(6, 8, 22, 8, P.bandShade).poly([[22, 7], [26, 9], [25, 11], [22, 9]], P.band) // 鉢巻
    .line(9, 11, 12, 12, P.brow).line(16, 12, 19, 11, P.brow) // 寄せた眉
    .rect(9, 14, 12, 14, P.ink).rect(16, 14, 19, 14, P.ink) // つむった目
    .rect(13, 17, 15, 17, P.mouth).px1(12, 18, P.mouth).px1(16, 18, P.mouth) // への字の口
    .outline(P.ink),
  // サラマンダーの火種：オレンジのブロックに、トカゲのしっぽのように巻いた白い炎と、赤い芯（元の絵のとおり）
  ember: () => block(P.fire, '#f6a85a', P.fireDeep)
    .poly([[16, 6], [20, 11], [24, 16], [23, 21], [19, 25], [13, 25], [9, 21], [9, 16], [12, 11], [14, 15], [15, 11]], P.fireCore)
    .ellipse(16, 20, 2.5, 3, P.fireDeep)
    .outline(P.ink),
  // 氷竜の鱗：白に近い水色のブロックに、上が丸く下がとがった鱗と、まん中の筋（元の絵のとおり）
  scale: () => block(P.ice, '#eaf8fd', P.iceMid)
    .poly([[7, 11], [10, 7], [16, 5], [22, 7], [25, 11], [23, 18], [16, 26], [9, 18]], P.iceDeep)
    .poly([[10, 12], [12, 9], [16, 8], [20, 9], [22, 12], [20, 17], [16, 22], [12, 17]], P.iceLight)
    .poly([[12, 12], [14, 10], [16, 10], [18, 10], [20, 12], [18, 16], [16, 19], [14, 16]], P.iceDeep)
    .line(16, 7, 16, 21, P.iceLight)
    .outline(P.ink),
  // ×の刻印：器の中のマス（明るい地）に、金茶の線で刻んだ ×（元のゲームの刻印のマス）
  xMark: () => grid().rect(3, 3, 28, 28, P.inside).rect(3, 3, 28, 4, '#efe2c6')
    .rect(5, 5, 26, 5, P.rune).rect(5, 26, 26, 26, P.rune).rect(5, 5, 5, 26, P.rune).rect(26, 5, 26, 26, P.rune)
    .path([[10, 10], [21, 21]], 1.3, P.runeDeep).path([[21, 10], [10, 21]], 1.3, P.runeDeep)
    .outline(P.ink),
  // 穴のある器：横から見た木の器（左右と底の枠）。底の枠の1か所が外れて穴があいている
  holeVessel: () => grid().rect(5, 6, 26, 25, P.inside)
    .rect(3, 4, 5, 28, P.wood).rect(26, 4, 28, 28, P.wood).rect(3, 26, 28, 28, P.wood)
    .rect(3, 4, 3, 28, P.woodLight).rect(28, 4, 28, 28, P.woodDark)
    .clear(14, 26, 17, 28).rect(14, 25, 17, 25, P.woodDark)
    .px1(15, 30, P.inside).px1(16, 31, P.inside)
    .outline(P.ink),
};

export const CA_ART_NAMES = { 'マルタ': 'marta', 'サラマンダーの火種': 'ember', '氷竜の鱗': 'scale', '×の刻印': 'xMark', '穴のある器': 'holeVessel' };

export function celestialArt(name, size = 96) {
  const key = CA_ART_NAMES[name];
  return key ? toSvg(DRAW[key](), size) : null;
}
