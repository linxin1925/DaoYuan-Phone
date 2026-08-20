export type BeautyRankRealm = '玄天界' | '仙界';

// These pools are the literal values used by the original card's
// [RANDOM_BEAUTY]/[RANDOM_JUESE] and [RANDOM_XUAN]/[RANDOM_XIAN] regexes.
const XUANTIAN_CANDIDATES = '瑶汐,林雪,苏沐雪,小D,白薇,苏清雪,叶冰,陆雪琪,云舒窈,般若,紫薇,大衍,曦和,许千寻,嫣雨烟,绯月,秦心,秦浅月,幽梦,天妤,红绡,林欣,璃宫花火,幽悦,凌月,晚絮,星宿,凤灵儿,公孙清,万璇玑,小翠,乔梦玉,黑姬结灯,玄璃,林寒绾,朱离,小显示,叶焚渊,江楚楚,叶清,韩月灵,林妙音,慕清弦,九歌,白疏影,欧阳灵,海伊,银月,南宫婉,红蝶,温月清,红莲,宫银叶,侯小妹,温小暖,苏灿灿,灵玥,阴丽华,冰凤,姬紫月,苏媚,萧婉儿,商心慈,苏千媚,苏琉璃,袁琪,孔灵月,蛛心儿,敖凌霜,银黎,青练,青衣,柳青螭,柳舞蝶,长孙镜华,白祈昼,金玉满,姜梦,林素铃,桃幽,颜小落,桃夭诺,百铃,卡斯蒂利亚·哈布斯堡,云初未来,苏清漪,君姝,樊月汐,李溯,姬觅弥,李铭,魏喑,白倾颜,代安池,顾清清'.split(',');

const IMMORTAL_CANDIDATES = '玖柒,南可熙,李未晞,舞弦琴,慕欣心,楚星绾,上官玥,柳依依,林若悠,萧玉寒,苏清禾,云糯糯,苏绾影,凌阮阮,叶倾心,汐怡,桃夭夭,苏珞刹,霖仙怡,冥霜儿,楚玉璃,白玖璃,青木璇,璃杏,杜月菲,慕容初袖,慕容落羽,萌梦,钰仙儿,青渝,风梧音,秦汐雅,凌紫嫣,叶婷'.split(',');

export function getBeautyRankCandidatePool(realm: BeautyRankRealm): readonly string[] {
  return realm === '仙界' ? IMMORTAL_CANDIDATES : XUANTIAN_CANDIDATES;
}

export function selectBeautyRankCandidates(
  realm: BeautyRankRealm,
  recentNames: readonly string[],
  count: number = 5,
  random: () => number = Math.random,
  availableNames?: ReadonlySet<string>,
): string[] {
  const pool = [...getBeautyRankCandidatePool(realm)].filter(name => !availableNames || availableNames.has(name));
  const normalizedCount = Math.max(1, Math.min(20, Math.floor(count)));
  if (pool.length < normalizedCount) throw new Error(`当前启用世界书中只有${pool.length}位${realm}绝色榜候选人物，至少需要${normalizedCount}位`);
  const recent = new Set(recentNames);
  const shuffle = (names: string[]): string[] => names.map((name, index) => ({ name, order: random(), index }))
    .sort((left, right) => left.order - right.order || left.index - right.index)
    .map(item => item.name);
  const preferred = shuffle(pool.filter(name => !recent.has(name)));
  const fallback = shuffle(pool.filter(name => recent.has(name)));
  return [...preferred, ...fallback].slice(0, normalizedCount);
}
