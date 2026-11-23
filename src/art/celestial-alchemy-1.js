// 拡張「天体の錬金術（Celestial Alchemy）」の住人の絵（32×32）。基本セットと同じ道具・太い縁取り。
// 人には顔を描き、素材・刻印・器（物）には描かない。
// 素材は Celestial Alchemy の元の絵と同じ「素材の色のブロックに、白っぽい印」（判定 A2・A3）。色も元のゲームのまま。
// 見本（マルタ・火種・鱗・×の刻印・穴のある器）の判定 D1〜D4 が OK のあと、残りを同じ描き方で描いた。
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
  insideGold: '#fbebb5', insideLead: '#e3e5ec',
  lead: '#565b69', leadInk: '#c9ced9', leadDeep: '#3d414c',
  gold: '#e6b422', goldInk: '#fff3c2', goldDeep: '#a77b06',
  water: '#2f62c8', waterInk: '#cfe0ff', waterDeep: '#1d3f8a',
  vine: '#3f9b4c', vineInk: '#d8f5c9', vineDeep: '#286a33',
  slime: '#f6a3cb', slimeInk: '#fff0f7', slimeDeep: '#d0679b',
  sand: '#5d3f9a', sandInk: '#f3e8ff', sandDeep: '#3d2670',
  horn: '#efe2c2', hornInk: '#8a6a35', hornDeep: '#c9b17d',
  stone: '#a5123c', stoneInk: '#ffd6e2', stoneDeep: '#6d0624',
  // 人
  noelHair: '#c0703f', noelHairDark: '#9a5530', noelCoat: '#3f8f9a', noelCoatDark: '#2f6f78', ribbon: '#d9822b', flask: '#e8f6ff', potion: '#7fd0c4', cork: '#b98a5a',
  lunaHair: '#c9d3e6', lunaHairDark: '#a8b4cc', lunaRobe: '#5f7fb8', lunaRobeDark: '#4a66a0', moon: '#ffe27a', quill: '#ffffff',
  joveSkin: '#f3cfa8', joveSkinShade: '#e0b48a', straw: '#f2cf6b', strawDark: '#d9b04e', joveCloth: '#4f9a55', joveClothDark: '#3a7a40', leafGreen: '#5cb85c', sideburn: '#b5642f',
  solHair: '#f0c03a', solHairDark: '#d9a020', crown: '#ffd84d', ray: '#f2b31b', robe: '#fffaf0', robeShade: '#e8dcc4', gem: '#e2574c',
  white: '#ffffff', cheek: '#f6b6a8',
};

// 笑った目（への字の逆）・おだやかな目（下がった線）
const smileEye = (g, x, y, c = '#1d1a33') => g.px1(x, y + 1, c).px1(x + 1, y, c).px1(x + 2, y + 1, c);
const calmEye = (g, x, y, c = '#1d1a33') => g.px1(x, y, c).px1(x + 1, y + 1, c).px1(x + 2, y + 1, c).px1(x + 3, y, c);
// 小さな星（4方向に光る点）
const star = (g, x, y, c) => g.px1(x, y, c).px1(x - 1, y, c).px1(x + 1, y, c).px1(x, y - 1, c).px1(x, y + 1, c);

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

  // ---- 人（顔を描く）----
  // ノエル：見習い錬金術師。茶色の髪とはねた毛、青緑の学院の上着に白いえりとオレンジのリボン、手に光る小びん
  noel: () => {
    const g = grid()
      .ellipse(14, 27, 10, 5, P.noelCoat).tint(4, 29, 24, 31, P.noelCoatDark, P.noelCoat) // 上着
      .poly([[10, 22], [14, 26], [18, 22]], P.white).poly([[12, 24], [14, 26], [16, 24], [15, 27], [13, 27]], P.ribbon) // えりとリボン
      .rect(12, 19, 16, 22, P.skinShade)
      .ellipse(14, 13, 7, 7, P.skin).tint(8, 17, 20, 20, P.skinShade, P.skin)
      .ellipse(14, 7, 8, 4.5, P.noelHair).rect(6, 7, 7, 15, P.noelHair).rect(21, 7, 22, 13, P.noelHair)
      .poly([[8, 9], [13, 9], [10, 12]], P.noelHair).tint(9, 3, 19, 4, P.noelHairDark, P.noelHair)
      .line(16, 3, 18, 0, P.noelHair).px1(19, 0, P.noelHair) // はねた毛
      .eye(10, 12).eye(16, 12).px1(9, 15, P.cheek).px1(20, 15, P.cheek)
      .rect(13, 17, 15, 17, P.mouth).px1(14, 18, P.mouth) // 開いた口
      // 光る小びん（右下）
      .rect(25, 17, 27, 18, P.cork).rect(24, 19, 28, 20, P.flask).poly([[23, 21], [29, 21], [31, 27], [29, 29], [23, 29], [21, 27]], P.flask)
      .poly([[22, 25], [30, 25], [31, 27], [29, 29], [23, 29], [21, 27]], P.potion).px1(24, 26, P.white);
    star(g, 29, 13, P.crown);
    return g.px1(20, 24, P.skin).px1(21, 25, P.skin).outline(P.ink);
  },
  // ルーナ：月の錬金術師。銀の長い髪に三日月の飾り、青い衣、おだやかな目、羽ペン
  luna: () => {
    const g = grid()
      .poly([[6, 12], [22, 12], [24, 28], [4, 28]], P.lunaHair) // 後ろの長い髪
      .ellipse(14, 28, 10, 4, P.lunaRobe).tint(4, 29, 24, 31, P.lunaRobeDark, P.lunaRobe)
      .rect(12, 19, 16, 22, P.skinShade)
      .ellipse(14, 13, 7, 7, P.skin).tint(8, 17, 20, 20, P.skinShade, P.skin)
      .ellipse(14, 7, 8, 4.5, P.lunaHair).rect(6, 7, 7, 20, P.lunaHair).rect(21, 7, 22, 20, P.lunaHair)
      .poly([[8, 9], [12, 9], [9, 13]], P.lunaHair).poly([[16, 9], [20, 9], [20, 12]], P.lunaHair)
      .tint(4, 20, 24, 28, P.lunaHairDark, P.lunaHair)
      .ellipse(20, 5, 2.5, 2.5, P.moon).ellipse(21.5, 4, 2, 2, null); // 三日月
    calmEye(g, 9, 13); calmEye(g, 16, 13);
    g.rect(13, 17, 15, 17, P.mouth).px1(9, 15, P.cheek).px1(20, 15, P.cheek);
    g.line(29, 14, 25, 26, P.quill).line(30, 15, 27, 21, P.quill).line(28, 16, 25, 26, P.lunaHairDark); // 羽ペン
    star(g, 27, 4, P.white); star(g, 3, 4, P.white);
    return g.outline(P.ink);
  },
  // ジョーヴ：木星の錬金術師。陽気な庭師。麦わら帽子に赤い帯と葉っぱ、緑の作業着、笑った目
  jove: () => {
    const g = grid()
      .ellipse(15, 28, 10, 4, P.joveCloth).tint(5, 29, 25, 31, P.joveClothDark, P.joveCloth)
      .rect(10, 25, 11, 31, P.joveClothDark).rect(19, 25, 20, 31, P.joveClothDark) // つりひも
      .rect(13, 20, 17, 23, P.joveSkinShade)
      .ellipse(15, 15, 7, 6.5, P.joveSkin).tint(9, 19, 21, 21, P.joveSkinShade, P.joveSkin)
      .rect(8, 13, 9, 17, P.sideburn).rect(21, 13, 22, 17, P.sideburn)
      .ellipse(15, 9, 14, 2.5, P.straw).ellipse(15, 6, 7, 4, P.straw).rect(8, 7, 22, 8, P.gem) // 帽子と赤い帯
      .tint(1, 10, 29, 11, P.strawDark, P.straw)
      .poly([[21, 4], [26, 1], [27, 3], [23, 6]], P.leafGreen); // 葉っぱ
    smileEye(g, 10, 14); smileEye(g, 17, 14);
    g.rect(13, 18, 17, 18, P.mouth).rect(14, 19, 16, 19, P.mouth).px1(10, 17, P.cheek).px1(20, 17, P.cheek);
    return g.outline(P.ink);
  },
  // ソレイユ：太陽の錬金術師。後ろに太陽の輪、金の髪と冠に赤い石、白と金の衣、笑った目
  soleil: () => {
    const g = grid();
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6;
      g.line(Math.round(15 + Math.cos(a) * 11), Math.round(13 + Math.sin(a) * 11), Math.round(15 + Math.cos(a) * 14), Math.round(13 + Math.sin(a) * 14), P.ray);
    }
    g.poly([[6, 12], [24, 12], [25, 26], [5, 26]], P.solHair) // 後ろの髪
      .ellipse(15, 28, 10, 4, P.robe).tint(5, 29, 25, 31, P.robeShade, P.robe)
      .poly([[11, 25], [15, 28], [19, 25], [20, 31], [10, 31]], P.solHair) // 金の前かけ
      .rect(13, 20, 17, 23, P.skinShade)
      .ellipse(15, 14, 7, 7, P.skin).tint(9, 18, 21, 21, P.skinShade, P.skin)
      .ellipse(15, 8, 8, 4, P.solHair).rect(7, 8, 8, 18, P.solHair).rect(22, 8, 23, 18, P.solHair).tint(5, 19, 25, 26, P.solHairDark, P.solHair)
      .poly([[10, 6], [11, 1], [13, 4], [15, 0], [17, 4], [19, 1], [20, 6]], P.crown).px1(15, 4, P.gem); // 冠
    smileEye(g, 10, 13); smileEye(g, 17, 13);
    g.rect(13, 18, 17, 18, P.mouth).px1(10, 16, P.cheek).px1(20, 16, P.cheek);
    return g.outline(P.ink);
  },
  // ---- 素材（元のゲームのピース1マス：素材の色のブロックに印）----
  // 鉛：重りの形の地金と、横の筋
  lead: () => block(P.lead, '#70768a', P.leadDeep)
    .poly([[10, 11], [22, 11], [25, 22], [7, 22]], P.leadDeep)
    .line(10, 11, 22, 11, P.leadInk).line(22, 11, 25, 22, P.leadInk).line(25, 22, 7, 22, P.leadInk).line(7, 22, 10, 11, P.leadInk)
    .line(12, 14, 20, 14, P.leadInk)
    .outline(P.ink),
  // 金：光る地金と、きらめき
  gold: () => {
    const g = block(P.gold, '#f2cc5a', P.goldDeep)
      .poly([[8, 13], [20, 13], [23, 24], [5, 24]], P.goldInk)
      .line(8, 13, 20, 13, P.goldDeep).line(20, 13, 23, 24, P.goldDeep).line(23, 24, 5, 24, P.goldDeep).line(5, 24, 8, 13, P.goldDeep);
    star(g, 23, 8, P.white);
    return g.px1(23, 6, P.white).px1(23, 10, P.white).px1(21, 8, P.white).px1(25, 8, P.white).outline(P.ink);
  },
  // ウンディーネの水玉：しずくと光
  water: () => block(P.water, '#4f7fd8', P.waterDeep)
    .poly([[16, 6], [20, 12], [23, 17], [23, 21], [20, 25], [12, 25], [9, 21], [9, 17], [12, 12]], P.waterInk)
    .ellipse(13, 19, 1.5, 2.5, P.water)
    .outline(P.ink),
  // ドリアードのつる：巻きひげのある茎と2枚の葉
  vine: () => block(P.vine, '#5cb366', P.vineDeep)
    .line(16, 28, 16, 10, P.vineInk).line(17, 26, 17, 14, P.vineInk)
    .poly([[16, 19], [22, 14], [25, 17], [20, 21]], P.vineInk).poly([[16, 15], [10, 10], [7, 13], [12, 17]], P.vineInk)
    .line(16, 10, 19, 7, P.vineInk).px1(20, 7, P.vineInk).px1(20, 8, P.vineInk).px1(19, 9, P.vineInk)
    .outline(P.ink),
  // スライムゼリー：ぷるぷるのかたまりと、光
  slime: () => block(P.slime, '#f9c0dc', P.slimeDeep)
    .ellipse(16, 18, 9, 7, P.slimeDeep).rect(7, 18, 25, 24, P.slimeDeep)
    .ellipse(12, 15, 2, 1, P.slimeInk).px1(10, 18, P.slimeInk)
    .outline(P.ink),
  // ヘルメスの星砂：星の形の粒
  sand: () => {
    const g = block(P.sand, '#7558b0', P.sandDeep);
    const big = (x, y) => { star(g, x, y, P.sandInk); g.px1(x - 2, y, P.sandInk).px1(x + 2, y, P.sandInk).px1(x, y - 2, P.sandInk).px1(x, y + 2, P.sandInk); };
    big(11, 11); big(21, 15);
    star(g, 12, 21, P.sandInk);
    return g.px1(22, 23, P.sandInk).outline(P.ink);
  },
  // シルフの角笛：左下が細く、右が広い口の角笛と、口から出る風
  horn: () => block(P.horn, '#f7eed8', P.hornDeep)
    .poly([[5, 20], [17, 21], [19, 8], [14, 13]], P.hornDeep)
    .ellipse(18.5, 14.5, 1.5, 6, P.horn).line(18, 8, 18, 21, P.hornInk).line(20, 8, 20, 21, P.hornInk)
    .line(10, 16, 11, 20, P.hornInk)
    .line(23, 10, 26, 9, P.hornInk).line(23, 14, 27, 14, P.hornInk).line(23, 18, 26, 19, P.hornInk)
    .outline(P.ink),
  // 賢者の石：カットした深紅の宝石と、面の線
  stone: () => block(P.stone, '#c43a5e', P.stoneDeep)
    .poly([[16, 6], [25, 12], [22, 25], [10, 25], [7, 12]], P.stoneDeep)
    .line(7, 12, 25, 12, P.stoneInk).line(16, 6, 13, 12, P.stoneInk).line(16, 6, 19, 12, P.stoneInk)
    .line(13, 12, 16, 25, P.stoneInk).line(19, 12, 16, 25, P.stoneInk)
    .line(16, 6, 7, 12, P.stoneInk).line(16, 6, 25, 12, P.stoneInk)
    .outline(P.ink),
  // ---- 刻印（器の中のマスに刻んだ印）----
  // 鉛の刻印：鉛の地（灰色がかった地）に、鉛（土星）の印
  leadMark: () => grid().rect(3, 3, 28, 28, P.insideLead).rect(3, 3, 28, 4, '#d4d7e0')
    .rect(5, 5, 26, 5, P.rune).rect(5, 26, 26, 26, P.rune).rect(5, 5, 5, 26, P.rune).rect(26, 5, 26, 26, P.rune)
    .path([[13, 8], [13, 22]], 1, P.runeDeep).path([[10, 11], [16, 11]], 1, P.runeDeep)
    .path([[13, 16], [18, 15], [20, 18], [18, 22], [20, 23]], 1, P.runeDeep)
    .outline(P.ink),
  // 金の刻印：金の地（明るい黄の地）に、金（太陽）の印＝丸に点
  goldMark: () => grid().rect(3, 3, 28, 28, P.insideGold).rect(3, 3, 28, 4, '#f3dc94')
    .rect(5, 5, 26, 5, P.rune).rect(5, 26, 26, 26, P.rune).rect(5, 5, 5, 26, P.rune).rect(26, 5, 26, 26, P.rune)
    .ellipse(15.5, 15.5, 6, 6, P.runeDeep).ellipse(15.5, 15.5, 4, 4, P.insideGold).rect(15, 15, 16, 16, P.runeDeep)
    .outline(P.ink),
  // ---- 器 ----
  // 肩のある器：横から見た木の器。上が狭く、途中で外へ広がる段（肩）がある
  shoulderVessel: () => grid().rect(5, 6, 26, 25, P.inside).clear(5, 6, 9, 13).clear(22, 6, 26, 13)
    .rect(8, 4, 10, 15, P.wood).rect(21, 4, 23, 15, P.wood) // 上の狭い口
    .rect(3, 13, 10, 15, P.wood).rect(21, 13, 28, 15, P.wood) // 肩
    .rect(3, 13, 5, 28, P.wood).rect(26, 13, 28, 28, P.wood).rect(3, 26, 28, 28, P.wood)
    .rect(3, 13, 3, 28, P.woodLight).rect(8, 4, 8, 13, P.woodLight).rect(28, 13, 28, 28, P.woodDark).rect(23, 4, 23, 13, P.woodDark)
    .outline(P.ink),
};

export const CA_ART_NAMES = {
  'ノエル': 'noel', 'マルタ': 'marta', 'ルーナ': 'luna', 'ジョーヴ': 'jove', 'ソレイユ': 'soleil',
  '鉛': 'lead', '金': 'gold', 'サラマンダーの火種': 'ember', '氷竜の鱗': 'scale', 'ウンディーネの水玉': 'water',
  'ドリアードのつる': 'vine', 'スライムゼリー': 'slime', 'ヘルメスの星砂': 'sand', 'シルフの角笛': 'horn', '賢者の石': 'stone',
  '鉛の刻印': 'leadMark', '×の刻印': 'xMark', '金の刻印': 'goldMark', '穴のある器': 'holeVessel', '肩のある器': 'shoulderVessel',
};

export function celestialArt(name, size = 96) {
  const key = CA_ART_NAMES[name];
  return key ? toSvg(DRAW[key](), size) : null;
}
