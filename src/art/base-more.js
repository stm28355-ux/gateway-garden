// 基本セットの住人の絵（残り24匹）。描き方は base.js の6匹と同じ（工程7の判定 U1）：
// 32×32、太い縁取り、生き物には顔、物（鏡・旗・宝箱など）には顔を付けない。持ち物で役目と名前が分かるように。
import { grid } from './pixel.js';

const INK = '#1d1a33';
const C = {
  cream: '#f6f0dc', creamShade: '#d9ceb0', white: '#ffffff', pink: '#f2b8c0', grey: '#b8b4c8', greyDark: '#7c788e',
  red: '#e3604f', redDark: '#b8443a', orange: '#ec8a3c', orangeLight: '#f6b26b',
  blue: '#5c9ae6', blueLight: '#a9d2ff', blueDark: '#3a5f9e', navy: '#34436e',
  green: '#4ea860', greenLight: '#8fd39a', greenDark: '#2f7a40',
  yellow: '#ffd03a', yellowDark: '#d9a21c', gold: '#e6b23c', goldLight: '#ffe28a',
  brown: '#b97a45', brownLight: '#d9a066', brownDark: '#7e4f2a', wood: '#a8743f',
  smoke: '#cfcadc', water: '#8fc0f2',
};

export const MORE = {
  // 狼煙ギツネ：ふさふさのしっぽから上がる狼煙
  '狼煙ギツネ': () => grid()
    .ellipse(24, 8, 2.5, 2.5, C.smoke).ellipse(27, 4, 2, 2, C.smoke).ellipse(21, 4, 1.5, 1.5, C.smoke)
    .ellipse(24, 17, 5, 4, C.orange).ellipse(27, 14, 2, 2, C.cream)
    .ellipse(14, 21, 7, 5, C.orange).tint(9, 23, 19, 26, C.orangeLight)
    .ellipse(8, 14, 4.5, 4, C.orange).poly([[4, 12], [5, 6], [8, 10]], C.orange).poly([[9, 10], [11, 6], [12, 12]], C.orange)
    .ellipse(6.5, 16, 2.5, 1.5, C.cream).px1(4, 16, INK)
    .rect(9, 25, 10, 28, C.redDark).rect(18, 25, 19, 28, C.redDark)
    .eye(6, 13).eye(9, 13)
    .outline(INK),
  // 潮見ペンギン：遠めがねで潮を見る
  '潮見ペンギン': () => grid()
    .ellipse(15, 18, 7, 10, C.navy).ellipse(16, 21, 4.5, 6.5, C.white)
    .ellipse(15, 11, 4, 2.5, C.white).ellipse(8, 20, 2, 5, C.navy)
    .poly([[17, 13], [21, 14], [17, 15]], C.orange)
    .rect(11, 28, 13, 29, C.orange).rect(17, 28, 19, 29, C.orange)
    .path([[21, 15], [28, 10]], 1, C.gold).ellipse(28.5, 9.5, 1.5, 1.5, C.goldLight)
    .eye(13, 10).eye(17, 10)
    .outline(INK),
  // つる草ヘビ：葉のついたつるのような体
  'つる草ヘビ': () => grid()
    .path([[7, 27], [12, 27], [16, 25], [18, 21], [15, 18], [11, 16], [10, 12], [13, 9]], 2.3, C.green)
    .ellipse(17.5, 8, 3.8, 2.8, C.green)
    .ellipse(14, 26.5, 1.5, 1, C.greenLight).ellipse(12, 15.5, 1.5, 1, C.greenLight).ellipse(17, 21, 1, 1.5, C.greenLight)
    .ellipse(6, 23, 2, 1, C.greenLight).line(7, 24, 8, 26, C.greenDark)
    .px1(22, 8, C.red).px1(23, 7, C.red).px1(23, 9, C.red)
    .eye(18, 6)
    .outline(INK),
  // 渡り鳥：大きく羽を広げて飛ぶ
  '渡り鳥': () => grid()
    .poly([[10, 16], [3, 12], [4, 19], [10, 19]], C.yellowDark)
    .ellipse(16, 18, 6.5, 4, C.yellow).ellipse(22, 14, 3.5, 3.5, C.yellow)
    .poly([[11, 16], [15, 5], [20, 15]], C.yellowDark).poly([[13, 15], [15, 9], [18, 15]], C.yellow)
    .poly([[25, 13], [29, 15], [25, 16]], C.orange)
    .tint(12, 20, 21, 22, C.goldLight, C.yellow)
    .eye(22, 13)
    .outline(INK),
  // 庭番カメ：もようのある甲らと、頭の小さな葉
  '庭番カメ': () => grid()
    .ellipse(26, 18, 3.5, 3, C.greenLight).ellipse(8, 24, 2.5, 1.5, C.greenLight).ellipse(22, 24, 2.5, 1.5, C.greenLight)
    .ellipse(15, 19, 9, 6, C.cream)
    .line(9, 17, 21, 17, C.creamShade).line(15, 13, 15, 24, C.creamShade).line(10, 21, 20, 21, C.creamShade)
    .tint(7, 23, 23, 25, C.creamShade, C.cream)
    .line(26, 15, 26, 13, C.greenDark).ellipse(27.5, 12, 1.5, 1, C.green)
    .eye(26, 17)
    .outline(INK),
  // 応援ダヌキ：両手に赤いポンポン
  '応援ダヌキ': () => grid()
    .ellipse(5, 13, 2.8, 2.8, C.red).ellipse(25, 13, 2.8, 2.8, C.red)
    .line(7, 16, 9, 19, C.brown).line(23, 16, 21, 19, C.brown)
    .ellipse(15, 22, 7, 7, C.brown).ellipse(15, 23, 4, 4.5, C.brownLight)
    .ellipse(10, 7, 2, 2, C.brownDark).ellipse(20, 7, 2, 2, C.brownDark)
    .ellipse(15, 12, 6, 5, C.brown).ellipse(15, 12.5, 5, 2, C.brownDark)
    .ellipse(15, 15, 2, 1.2, C.brownLight).px1(15, 15, INK)
    .eyeW(11, 12).eyeW(17, 12)
    .outline(INK),
  // 水やりカエル：じょうろで水をまく
  '水やりカエル': () => grid()
    .ellipse(13, 21, 8, 6, C.blue).ellipse(13, 23, 5, 3, C.blueLight)
    .ellipse(9, 14, 2.6, 2.6, C.blue).ellipse(17, 14, 2.6, 2.6, C.blue)
    .ellipse(6, 27, 3, 1.5, C.blue).ellipse(20, 27, 3, 1.5, C.blue)
    .rect(22, 17, 28, 23, C.grey).rect(22, 17, 28, 17, C.greyDark).line(28, 18, 31, 15, C.grey).line(21, 18, 21, 22, C.greyDark)
    .px1(30, 18, C.water).px1(31, 20, C.water).px1(29, 21, C.water)
    .eye(8, 13).eye(16, 13).line(11, 19, 15, 19, C.blueDark)
    .outline(INK),
  // 庭師モグラ：緑のぼうしとシャベル
  '庭師モグラ': () => grid()
    .rect(24, 6, 25, 23, C.wood).ellipse(24.5, 26, 2.5, 3, C.grey)
    .ellipse(14, 21, 8, 7, C.greyDark).ellipse(14, 23, 5, 4, C.grey)
    .ellipse(21, 18, 2.2, 1.8, C.pink)
    .ellipse(8, 25, 2.5, 1.5, C.cream).ellipse(21, 24, 2.5, 1.5, C.cream)
    .ellipse(13, 13, 6, 2, C.green).rect(10, 10, 16, 12, C.green).rect(10, 9, 16, 9, C.greenDark)
    .eyeW(15, 16)
    .outline(INK),
  // 蜜運びアリ：頭の上に大きな蜜のしずく
  '蜜運びアリ': () => grid()
    .ellipse(14, 8, 4.5, 4.5, C.yellow).ellipse(12.5, 6.5, 1.2, 1.2, C.goldLight)
    .ellipse(8, 17, 3, 3, C.brownDark).ellipse(13, 19, 2.2, 2, C.brownDark).ellipse(20, 20, 4.5, 3.8, C.brownDark)
    .line(10, 15, 12, 12, C.brownDark).line(15, 17, 15, 12, C.brownDark)
    .line(12, 21, 10, 26, C.brownDark).line(14, 21, 15, 26, C.brownDark).line(18, 23, 19, 27, C.brownDark).line(22, 23, 24, 27, C.brownDark)
    .line(7, 14, 5, 10, C.brownDark).line(9, 14, 9, 10, C.brownDark)
    .eyeW(6, 16)
    .outline(INK),
  // 鏡のネコ：となりに金の手鏡
  '鏡のネコ': () => grid()
    .ellipse(25, 14, 4, 6, C.gold).ellipse(25, 14, 2.8, 4.8, C.blueLight).ellipse(24, 12, 0.8, 1.5, C.white).rect(24, 20, 26, 26, C.gold)
    .ellipse(21, 26, 4, 1.8, C.cream)
    .ellipse(12, 21, 7, 7, C.cream).ellipse(12, 12, 6, 5, C.cream)
    .poly([[6, 10], [7, 4], [10, 8]], C.cream).poly([[14, 8], [17, 4], [18, 10]], C.cream)
    .px1(8, 7, C.pink).px1(16, 7, C.pink)
    .tint(6, 24, 18, 27, C.creamShade, C.cream)
    .eye(9, 11).eye(14, 11).px1(12, 14, C.pink)
    .outline(INK),
  // るつぼガニ：甲らの上の、火のついたるつぼ
  'るつぼガニ': () => grid()
    .rect(12, 9, 20, 13, C.greyDark).rect(12, 9, 20, 9, C.orange).px1(14, 8, C.yellow).px1(17, 7, C.orange).px1(19, 8, C.yellow)
    .ellipse(16, 20, 9, 5, C.red).tint(8, 22, 24, 24, C.redDark, C.red)
    .ellipse(5, 14, 3, 3, C.red).ellipse(27, 14, 3, 3, C.red).clear(5, 12, 6, 13).clear(26, 12, 27, 13)
    .line(8, 17, 6, 16, C.red).line(24, 17, 26, 16, C.red)
    .line(9, 24, 6, 27, C.redDark).line(12, 25, 10, 28, C.redDark).line(20, 25, 22, 28, C.redDark).line(23, 24, 26, 27, C.redDark)
    .eye(12, 17).eye(18, 17)
    .outline(INK),
  // 水車のビーバー：となりで回る水車
  '水車のビーバー': () => grid()
    .ellipse(24, 17, 6, 6, C.wood).ellipse(24, 17, 4, 4, C.brownLight)
    .line(24, 11, 24, 23, C.brownDark).line(18, 17, 30, 17, C.brownDark).line(20, 13, 28, 21, C.brownDark).line(20, 21, 28, 13, C.brownDark)
    .px1(22, 25, C.water).px1(25, 26, C.water).px1(27, 25, C.water)
    .ellipse(5, 26, 4, 2, C.brownDark)
    .ellipse(11, 21, 7, 7, C.brown).ellipse(11, 12, 5, 4.5, C.brown).ellipse(7, 8, 1.5, 1.5, C.brown).ellipse(15, 8, 1.5, 1.5, C.brown)
    .ellipse(11, 23, 4, 4, C.brownLight).rect(10, 15, 11, 16, C.white)
    .eye(8, 11).eye(13, 11)
    .outline(INK),
  // 発酵キノコ：ぷくぷくの泡
  '発酵キノコ': () => grid()
    .ellipse(16, 12, 10, 7, C.green).clear(0, 15, 31, 31)
    .ellipse(11, 9, 2, 1.5, C.greenLight).ellipse(19, 7, 1.5, 1.2, C.greenLight).ellipse(22, 11, 1.5, 1.2, C.greenLight)
    .rect(11, 14, 21, 26, C.cream).tint(11, 24, 21, 26, C.creamShade)
    .ellipse(27, 6, 1.5, 1.5, C.greenLight).ellipse(4, 9, 1.2, 1.2, C.greenLight).ellipse(28, 12, 1, 1, C.greenLight)
    .eye(13, 18).eye(18, 18).px1(16, 21, C.creamShade)
    .outline(INK),
  // 両替カラス：金貨をくわえる
  '両替カラス': () => grid()
    .ellipse(14, 19, 8, 6, C.navy).ellipse(21, 12, 4.5, 4, C.navy).ellipse(10, 19, 5, 4, C.blueDark)
    .poly([[6, 20], [1, 24], [7, 24]], C.navy)
    .poly([[25, 11], [29, 13], [25, 14]], C.grey)
    .ellipse(26, 19, 3.5, 3.5, C.gold).ellipse(26, 19, 2, 2, C.goldLight).rect(26, 17, 26, 21, C.gold)
    .line(12, 25, 11, 28, C.greyDark).line(16, 25, 17, 28, C.greyDark)
    .eyeW(21, 11)
    .outline(INK),
  // 星読みヤギ：角と、上に光る星
  '星読みヤギ': () => grid()
    .poly([[24, 2], [25.5, 6], [29, 6], [26, 8.5], [27, 12], [24, 10], [21, 12], [22, 8.5], [19, 6], [22.5, 6]], C.yellow)
    .ellipse(15, 21, 8, 6, C.cream).ellipse(9, 12, 4.5, 4.5, C.cream)
    .path([[7, 9], [6, 5], [8, 3]], 1, C.grey).path([[11, 9], [12, 5], [14, 4]], 1, C.grey)
    .poly([[8, 15], [10, 15], [9, 19]], C.creamShade)
    .rect(10, 26, 11, 29, C.greyDark).rect(18, 26, 19, 29, C.greyDark)
    .tint(7, 24, 23, 26, C.creamShade, C.cream)
    .eye(7, 11).eye(10, 11)
    .outline(INK),
  // 旗持ちイヌ：赤い旗をかかげる
  '旗持ちイヌ': () => grid()
    .rect(24, 4, 25, 28, C.wood).poly([[26, 4], [31, 7], [26, 10]], C.red)
    .ellipse(13, 21, 7, 6, C.brownLight).ellipse(12, 12, 5, 4.5, C.brownLight)
    .ellipse(7.5, 12, 1.8, 3.5, C.brown).ellipse(16.5, 12, 1.8, 3.5, C.brown)
    .ellipse(12, 15, 2.5, 1.5, C.cream).px1(12, 14, INK)
    .line(19, 18, 23, 16, C.brownLight)
    .rect(9, 26, 10, 28, C.brown).rect(16, 26, 17, 28, C.brown)
    .eye(10, 11).eye(13, 11)
    .outline(INK),
  // 水面のハクチョウ：水の上に浮かぶ
  '水面のハクチョウ': () => grid()
    .rect(1, 25, 30, 27, C.water).line(3, 26, 6, 26, C.blueLight).line(14, 27, 18, 27, C.blueLight).line(24, 26, 27, 26, C.blueLight)
    .ellipse(13, 21, 9, 5, C.white).ellipse(10, 19, 5, 3, C.cream)
    .path([[19, 20], [21, 15], [20, 10], [18, 8]], 1.5, C.white)
    .ellipse(17, 7, 2.5, 2.2, C.white).poly([[14, 7], [11, 8], [14, 9]], C.orange)
    .eye(16, 6)
    .outline(INK),
  // 長老の木：大きな冠と、幹の顔
  '長老の木': () => grid()
    .ellipse(16, 9, 10, 7, C.green).ellipse(8, 12, 5, 4, C.green).ellipse(24, 12, 5, 4, C.green)
    .ellipse(12, 6, 2.5, 1.5, C.greenLight).ellipse(21, 8, 2, 1.2, C.greenLight)
    .rect(12, 15, 20, 27, C.brown).poly([[12, 27], [8, 29], [13, 29]], C.brown).poly([[20, 27], [24, 29], [19, 29]], C.brown)
    .line(14, 23, 14, 26, C.brownDark).line(18, 22, 18, 26, C.brownDark)
    .eye(13, 18).eye(17, 18).rect(15, 21, 16, 21, C.brownDark)
    .outline(INK),
  // 宝探しネズミ：となりに宝箱
  '宝探しネズミ': () => grid()
    .rect(20, 20, 29, 27, C.brown).rect(20, 20, 29, 21, C.brownDark).rect(20, 23, 29, 23, C.gold).rect(24, 22, 25, 25, C.goldLight)
    .path([[8, 24], [4, 26], [2, 23]], 0.6, C.pink)
    .ellipse(13, 22, 6, 5, C.grey).ellipse(10, 15, 4, 3.5, C.grey)
    .ellipse(7, 10, 2.5, 2.5, C.grey).ellipse(13, 10, 2.5, 2.5, C.grey).ellipse(7, 10, 1.2, 1.2, C.pink).ellipse(13, 10, 1.2, 1.2, C.pink)
    .px1(6, 16, C.pink)
    .eye(9, 14).eye(12, 14)
    .outline(INK),
  // 鈴のハリネズミ：とげの背中と、首の金の鈴
  '鈴のハリネズミ': () => grid()
    .poly([[5, 22], [6, 15], [9, 17], [10, 11], [13, 15], [15, 10], [17, 14], [20, 11], [21, 16], [24, 15], [25, 22]], C.brownLight)
    .ellipse(15, 22, 9, 5, C.brownLight).tint(6, 16, 24, 20, C.brown, C.brownLight)
    .ellipse(23, 22, 4.5, 4, C.cream).px1(27, 22, INK)
    .ellipse(19, 27, 2, 2, C.gold).px1(19, 28, C.yellowDark)
    .eye(23, 20)
    .outline(INK),
  // 花火モモンガ：膜を広げて飛び、後ろで花火
  '花火モモンガ': () => grid()
    .line(26, 3, 26, 9, C.yellow).line(23, 6, 29, 6, C.red).line(24, 4, 28, 8, C.orange).line(24, 8, 28, 4, C.yellow).px1(26, 6, C.white)
    .poly([[15, 11], [26, 18], [15, 25], [4, 18]], C.brownLight).ellipse(15, 18, 4, 6, C.brown)
    .ellipse(15, 10, 4, 3.5, C.brownLight).ellipse(15, 27, 1.8, 3, C.brown)
    .ellipse(12, 7, 1.2, 1.2, C.brownLight).ellipse(18, 7, 1.2, 1.2, C.brownLight)
    .eye(13, 9).eye(16, 9)
    .outline(INK),
  // 波紋のイルカ：水から跳ねて、下に波紋
  '波紋のイルカ': () => grid()
    .ellipse(14, 28, 10, 2, C.water).ellipse(14, 28, 6, 1, C.blueLight)
    .poly([[4, 23], [9, 15], [18, 10], [26, 12], [24, 17], [14, 20]], C.blue)
    .poly([[9, 19], [16, 17], [22, 16], [14, 20]], C.blueLight)
    .poly([[14, 11], [17, 6], [18, 11]], C.blue).poly([[5, 22], [1, 19], [3, 26]], C.blue)
    .poly([[26, 12], [30, 13], [26, 14]], C.blue)
    .eye(22, 12)
    .outline(INK),
  // 根っこのミミズ：土の中の根っこと、頭の若葉
  '根っこのミミズ': () => grid()
    .path([[12, 2], [13, 8], [11, 13]], 0.6, C.brownDark).path([[22, 2], [21, 7], [24, 11]], 0.6, C.brownDark)
    .path([[5, 26], [9, 24], [13, 25], [17, 23], [19, 19], [22, 17]], 2.3, C.pink)
    .line(8, 22, 8, 26, '#e08896').line(12, 23, 12, 27, '#e08896').line(16, 21, 16, 25, '#e08896')
    .ellipse(23, 16, 3, 2.8, C.pink).line(24, 13, 25, 11, C.greenDark).ellipse(26.5, 10.5, 1.5, 1, C.green)
    .eye(22, 15)
    .outline(INK),
  // 伝書バト：手紙を運ぶ
  '伝書バト': () => grid()
    .rect(5, 7, 13, 13, C.goldLight).line(5, 7, 9, 10, C.yellowDark).line(13, 7, 9, 10, C.yellowDark)
    .ellipse(16, 20, 8, 6, C.smoke).ellipse(13, 19, 5, 3.5, C.grey)
    .ellipse(22, 13, 4, 4, C.smoke).ellipse(21, 16.5, 2.5, 1.5, C.green)
    .poly([[26, 12], [29, 13], [26, 14]], C.greyDark)
    .poly([[8, 20], [3, 18], [4, 23]], C.grey)
    .line(14, 26, 13, 28, C.orange).line(18, 26, 19, 28, C.orange)
    .eye(22, 12)
    .outline(INK),
};
