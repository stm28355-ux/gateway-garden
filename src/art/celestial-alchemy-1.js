// 拡張「天体の錬金術（Celestial Alchemy）」の住人の絵（32×32）。基本セットと同じ道具・太い縁取り。
// 人には顔を描き、素材・刻印・器（物）には描かない。色は Celestial Alchemy の素材の色に合わせる。
// 1回目の見本：マルタ（人）・サラマンダーの火種・氷竜の鱗（素材）。残りは見本の判定の後。
import { grid, toSvg } from './pixel.js';

const P = {
  ink: '#1d1a33',
  skin: '#fde6cf', skinShade: '#f0c9a8', hair: '#3e3a44', hairLight: '#5a5563',
  band: '#e2574c', bandShade: '#b5523a', apron: '#b5523a', apronLight: '#d06a4e', shirt: '#d9e0ea', shirtShade: '#b4bfcf',
  wood: '#a0703e', woodShade: '#7a5230', steel: '#8a8f9c', steelLight: '#c6cbd6',
  fire: '#f0882a', fireHot: '#ffd15c', fireCore: '#fff1d6', fireDeep: '#c45a10',
  ice: '#cdeefa', iceLight: '#ffffff', iceDeep: '#6fb6cf', iceMid: '#9fd6ec',
};

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
    .eye(10, 12).eye(16, 12) // 目
    .rect(13, 17, 15, 17, P.bandShade) // 結んだ口
    .outline(P.ink),
  // サラマンダーの火種：燃える小さな石。芯が白く、まわりに火の粉（物なので顔はなし）
  ember: () => grid()
    .ellipse(16, 22, 9, 6, P.fireDeep) // 石の台
    .poly([[8, 22], [11, 12], [14, 16], [16, 6], [19, 15], [22, 10], [24, 22]], P.fire) // 炎
    .poly([[11, 22], [13, 15], [16, 11], [19, 17], [21, 22]], P.fireHot)
    .ellipse(16, 20, 3, 3, P.fireCore)
    .tint(7, 24, 25, 28, P.fireDeep)
    .px1(9, 7, P.fireHot).px1(24, 6, P.fire).px1(26, 14, P.fireHot).px1(6, 15, P.fire).px1(13, 4, P.fireHot)
    .outline(P.ink),
  // 氷竜の鱗：ひし形に近い、重なった3枚の鱗。光る縁（物なので顔はなし）
  scale: () => grid()
    .poly([[6, 14], [13, 5], [20, 14], [13, 25]], P.iceMid)
    .poly([[12, 17], [19, 8], [26, 17], [19, 28]], P.ice)
    .poly([[14, 17], [19, 11], [24, 17], [19, 25]], P.iceLight)
    .line(19, 11, 19, 25, P.iceDeep).line(14, 17, 24, 17, P.iceMid)
    .line(13, 5, 6, 14, P.iceDeep).line(20, 14, 13, 25, P.iceDeep)
    .px1(9, 4, P.iceLight).px1(27, 9, P.iceLight).px1(4, 22, P.iceLight)
    .outline(P.ink),
};

export const CA_ART_NAMES = { 'マルタ': 'marta', 'サラマンダーの火種': 'ember', '氷竜の鱗': 'scale' };

export function celestialArt(name, size = 96) {
  const key = CA_ART_NAMES[name];
  return key ? toSvg(DRAW[key](), size) : null;
}
