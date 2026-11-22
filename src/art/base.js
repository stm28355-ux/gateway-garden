// 基本セットの住人の絵（32×32）。工程7の試し描き：6匹。顔は描かず、形と持ち物で見分ける。
import { grid, toSvg } from './pixel.js';

const P = {
  ink: '#1d1a33',
  cream: '#f6f0dc', creamShade: '#d9ceb0', pink: '#f2c6c0',
  lanternGlow: '#fff1a8', lantern: '#ffd35c', lanternCap: '#8a5a2b',
  red: '#e3604f', redShade: '#b8443a', redBelly: '#f4a07a', ember: '#ffd15c', emberHot: '#ff8a3c',
  blue: '#5c9ae6', blueLight: '#a9d2ff', blueShade: '#3a6fb8', tentacle: '#8fc0f2',
  brown: '#b97a45', brownLight: '#d9a066', brownShade: '#8a5530', leaf: '#4ea860', leafLight: '#8fd39a',
  yellow: '#ffd03a', yellowShade: '#e0a91c', stripe: '#3a2c20', wing: '#e8f4ff', wingEdge: '#b8d6f0',
  owl: '#ece4cc', owlShade: '#c9bd98', disc: '#f8f3e2', beak: '#e8a43c', post: '#8a5a2b', sign: '#c99a5b',
};

const DRAW = {
  // 灯りうさぎ：長い耳と、手に下げた小さなランタン
  rabbit: () => grid()
    .ellipse(11, 7, 2, 6, P.cream).ellipse(18, 7, 2, 6, P.cream)
    .rect(11, 3, 11, 9, P.pink).rect(18, 3, 18, 9, P.pink)
    .ellipse(15, 21, 8, 7, P.cream).ellipse(14.5, 13, 6, 5, P.cream)
    .tint(8, 23, 23, 28, P.creamShade)
    .ellipse(7, 22, 2, 2, P.cream)
    .ellipse(11, 28, 3, 1.5, P.cream).ellipse(19, 28, 3, 1.5, P.cream)
    .line(23, 17, 25, 15, P.lanternCap).ellipse(26, 22, 4, 4, P.lanternGlow)
    .rect(24, 19, 28, 25, P.lantern).rect(24, 18, 28, 18, P.lanternCap).rect(24, 26, 28, 26, P.lanternCap)
    .outline(P.ink),
  // 火の粉トカゲ：低い体と巻いたしっぽ、上に舞う火の粉
  lizard: () => grid()
    .poly([[9, 20], [4, 22], [2, 26], [5, 28], [7, 25], [10, 23]], P.red)
    .ellipse(15, 21, 8, 4, P.red).ellipse(25, 18, 4.5, 3, P.red)
    .tint(9, 23, 22, 25, P.redBelly)
    .rect(10, 24, 11, 27, P.redShade).rect(19, 24, 20, 27, P.redShade)
    .rect(13, 17, 19, 17, P.redShade)
    .px1(22, 9, P.ember).px1(23, 8, P.emberHot).px1(18, 6, P.ember).px1(26, 11, P.emberHot).px1(20, 11, P.ember).px1(25, 5, P.ember)
    .outline(P.ink),
  // しずくクラゲ：丸いかさと、ゆれる足
  jelly: () => {
    const g = grid().ellipse(16, 12, 10, 8, P.blue).clear(0, 15, 31, 31)
      .ellipse(12, 9, 3, 2, P.blueLight).rect(6, 14, 26, 14, P.blueShade);
    for (const x of [8, 12, 16, 20, 24]) {
      for (let y = 16; y <= 28; y++) g.px1(x + (Math.floor((y + x) / 3) % 2), y, P.tentacle);
    }
    return g.outline(P.ink);
  },
  // 芽吹きリス：大きなしっぽと、頭から出た芽
  squirrel: () => grid()
    .ellipse(23, 15, 5, 9, P.brownLight).tint(20, 6, 28, 12, P.brown)
    .ellipse(13, 21, 6, 6, P.brown).ellipse(13, 13, 5, 4, P.brown)
    .poly([[9, 11], [10, 6], [12, 10]], P.brown).poly([[15, 10], [17, 6], [18, 11]], P.brown)
    .tint(9, 22, 17, 26, P.brownShade)
    .ellipse(10, 27, 2.5, 1.5, P.brown).ellipse(16, 27, 2.5, 1.5, P.brown)
    .line(13, 8, 13, 4, P.leaf).ellipse(10.5, 3.5, 2, 1, P.leaf).ellipse(15.5, 3.5, 2, 1, P.leafLight)
    .outline(P.ink),
  // ひだまりハチ：しまの丸い体と、すき通る羽
  bee: () => grid()
    .ellipse(10, 9, 4, 5, P.wing).ellipse(19, 8, 4, 5, P.wing).tint(6, 4, 23, 7, P.wingEdge)
    .ellipse(15, 19, 9, 7, P.yellow)
    .tint(10, 13, 11, 26, P.stripe).tint(15, 12, 16, 26, P.stripe).tint(20, 13, 21, 26, P.stripe)
    .tint(7, 22, 24, 26, P.yellowShade, P.yellow)
    .poly([[24, 18], [29, 20], [24, 22]], P.stripe)
    .line(8, 13, 5, 10, P.stripe).line(11, 12, 9, 9, P.stripe)
    .outline(P.ink),
  // 道しるべフクロウ：耳の羽と、道しるべの杭
  owl: () => grid()
    .rect(25, 8, 26, 30, P.post).poly([[21, 6], [29, 6], [31, 8], [29, 10], [21, 10]], P.sign)
    .ellipse(14, 18, 8, 10, P.owl)
    .poly([[7, 10], [8, 4], [11, 9]], P.owl).poly([[17, 9], [20, 4], [21, 10]], P.owl)
    .ellipse(14, 20, 5, 6, P.disc).ellipse(8, 19, 3, 6, P.owlShade)
    .poly([[13, 14], [15, 14], [14, 17]], P.beak)
    .rect(10, 28, 12, 29, P.beak).rect(16, 28, 18, 29, P.beak)
    .outline(P.ink),
};

export const BASE_ART_NAMES = { '灯りうさぎ': 'rabbit', '火の粉トカゲ': 'lizard', 'しずくクラゲ': 'jelly', '芽吹きリス': 'squirrel', 'ひだまりハチ': 'bee', '道しるべフクロウ': 'owl' };

export function baseArt(name, size = 96) {
  const key = BASE_ART_NAMES[name] ?? name;
  return DRAW[key] ? toSvg(DRAW[key](), size) : null;
}
