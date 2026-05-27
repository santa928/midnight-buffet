export interface DishPresentation {
  points: number;
  name: string;
  description: string;
  asset: string;
  tone: "delight" | "trouble";
}

const dishAsset = `${import.meta.env.BASE_URL}assets/dishes/jewel-strawberry-tart.webp`;

const dishCatalog = new Map<number, DishPresentation>([
  [1, delight(1, "ひとくちマカロン", "軽やかな乾杯の一皿")],
  [2, delight(2, "金蜜のフィナンシェ", "香ばしく甘い焼き菓子")],
  [3, delight(3, "宵色ベリーのムース", "きらめく小さな前菜デザート")],
  [4, delight(4, "薔薇香るフルーツ皿", "会場が華やぐ盛り合わせ")],
  [5, delight(5, "月光のショコラタルト", "濃厚な人気のひと皿")],
  [6, delight(6, "宝石仕立ての苺タルト", "拍手を呼ぶ祝宴の名物")],
  [7, delight(7, "金箔ベリーの祝福皿", "誰もが狙う豪華な甘味")],
  [8, delight(8, "王冠仕立ての苺タルト", "スポットライトを集める逸品")],
  [9, delight(9, "真夜中の至宝デザート", "会場の目線を奪う傑作")],
  [10, delight(10, "祝宴のグランド・タルト", "今宵ただ一つの最高皿")],
  [-1, trouble(-1, "酸っぱすぎる苺タルト", "笑顔が少し曇る酸味")],
  [-2, trouble(-2, "焦げ目だらけの苺タルト", "香ばしさが行き過ぎた失敗作")],
  [-3, trouble(-3, "激辛ルージュタルト", "唐辛子ソースで涙が出る")],
  [-4, trouble(-4, "塩まみれのショコラタルト", "会場が静まり返る塩加減")],
  [-5, trouble(-5, "宴会長の罰ゲームタルト", "最後まで語り継がれる災難")],
]);

/** Resolves signed scoring data into an accessible dish presentation. */
export function getDishPresentation(points: number): DishPresentation {
  const presentation = dishCatalog.get(points);
  if (!presentation) {
    throw new Error(`料理表示が未定義です: ${points}`);
  }
  return presentation;
}

/** Creates presentation for a rewarding plated dish. */
function delight(points: number, name: string, description: string): DishPresentation {
  return { points, name, description, asset: dishAsset, tone: "delight" };
}

/** Creates presentation for a troublesome dish with warning treatment in the UI. */
function trouble(points: number, name: string, description: string): DishPresentation {
  return { points, name, description, asset: dishAsset, tone: "trouble" };
}
