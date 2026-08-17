import { formatWorldLocation } from './locationFormat';

export type MapRealm = '玄天界' | '仙界';
export type FactionType = 'human' | 'demon' | 'monster' | 'neutral' | 'blood';

export interface MapFaction { name: string; type: FactionType; note?: string }
export interface MapNode {
  name: string;
  realm: string;
  type: string;
  desc: string;
  factions: MapFaction[];
  color: string;
  x: number;
  y: number;
}
export type MapData = Record<string, MapNode>;
export interface ResolvedMapLocation {
  realm: MapRealm;
  nodeKey: string;
  node: MapNode;
  matchedBy: 'node' | 'faction' | 'landmark';
}

export const xuantianLore: MapData = {
  center: { name: '中央神州', realm: '人族疆域', type: 'human', desc: '人族文明的核心，边长三千亿里正方形。宫阙浮空，金道横空，秩序森严。这里是舞台的中心，宗门林立，王朝更迭。', factions: [
    { name: '大周仙朝', type: 'human', note: '神都洛阳。皇族姬氏底蕴深厚，十万元婴神策军，掌控四成灵石矿。' },
    { name: '南梁古国', type: 'human', note: '中州东南部凡人王朝，受合欢宗与湮丹宗共控，种植紫灵米，表面繁华奢靡，暗藏斩仙盟反抗势力。' },
    { name: '蜀山剑门', type: 'human', note: '西部蜀山群峰。天下剑修朝圣地，万剑归宗大阵。' },
    { name: '昆仑道门', type: 'human', note: '极西昆仑神山。历史悠久的道门正宗，讲究清静无为。' },
    { name: '万法宗', type: 'human', note: '东南方半空万法天仪。海纳百川，解析万法本源。' },
    { name: '桃花宗', type: 'human', note: '中央神州东南落英山脉十里桃林。以情入道，结三生之缘；主峰结缘神木流转姻缘灵光，与合欢宗为绝对死敌。' },
    { name: '合欢宗', type: 'neutral', note: '明线百花谷，暗线极极宫。采补炉鼎的邪派。' },
    { name: '天机阁', type: 'neutral', note: '总阁蜃楼飞阁游移不定。贩卖情报，推演因果。' },
    { name: '星道宗', type: 'neutral', note: '极北三十亿里高空摘星悬岛。融合星道智道，推演天机。' },
    { name: '湮丹宗', type: 'neutral', note: '南部杏临谷。以天地灵物入药，丹道通神。' },
    { name: '灵墟宗', type: 'neutral', note: '东部无尽山脉边缘灵兽原。借妖兽气血反哺己身。' },
    { name: '青玉宗', type: 'neutral', note: '西南部青音湖湖心岛。以音入道，只收女弟子。' },
    { name: '符韵门', type: 'neutral', note: '北部云符山。虚空成符，斗法狂掷符箓。' },
    { name: '阵天宗', type: 'neutral', note: '中部千阵岭迷雾石林。借天地大势，困杀万物。' },
  ], color: '--accent-gold', x: 50, y: 50 },
  north: { name: '北冥雪原', realm: '北冥禁地', type: 'demon', desc: '终年被冰雪覆盖的北方冻土，东西跨度三千五百亿里。无日月星辰，唯见幽蓝磷光。阴冷死寂。', factions: [
    { name: '广寒宫', type: 'neutral', note: '深处广寒玉宫。修太阴之道，断绝凡尘情爱，只收女弟子。' },
    { name: '蛟龙一族', type: 'monster', note: '北冥之下黑渊。吞噬掠夺，提纯真龙血脉。' },
  ], color: '--accent-mana', x: 50, y: 15 },
  south: { name: '南离火洲', realm: '混乱魔域', type: 'demon', desc: '火山密布，东西跨度四千亿里。空气中满是硫磺气息，混乱与杀伐并存，弱肉强食。', factions: [
    { name: '太阳神宫', type: 'human', note: '万丈火山之巅太阳火殿。崇拜太阳之力，体修至尊。' },
    { name: '尸魔宗', type: 'demon', note: '与中央神州交界处葬仙坡。炼化尸身，腐朽中求永生。' },
    { name: '黑金阁', type: 'demon', note: '无固定驻地地下黑市，统辖暗杀走私与情报渗透，重弱肉强食执掌地下混乱。' },
    { name: '血神宫', type: 'demon', note: '南离火洲中央不枯血海，海眼血骨浮岛立十二通天血柱。抽魂炼血，吞噬众生精血反哺己身。' },
    { name: '万魂殿', type: 'demon', note: '阴风山脉万鬼窟。抽魂炼魄，炼化怨鬼壮大神识。' },
  ], color: '--accent-blood', x: 50, y: 85 },
  east: { name: '东极青木域', realm: '万妖森林', type: 'monster', desc: '古木参天，南北跨度四千五百亿里的妖族世居之地。多方势力维持着微妙的平衡。', factions: [
    { name: '神猿族', type: 'monster', note: '西部万妖山脉。力量至上，以力破法。' },
    { name: '九尾天狐族', type: 'monster', note: '东部沂云森林。修习幻术法则，操纵神魂欲念。' },
    { name: '五色孔雀族', type: 'monster', note: '南部落凤坡五色谷。提纯五行血脉，衍化五色神光。' },
    { name: '柳蛇族', type: 'monster', note: '北部碧玉温泉。雌尊雄卑，交配繁衍。' },
  ], color: '--accent-san', x: 85, y: 50 },
  west: { name: '西漠佛国', realm: '佛修净土', type: 'human', desc: '广袤的西部沙漠，南北跨度三千五百亿里。佛光普照，致力于普度众生与镇压妖魔。', factions: [
    { name: '大雷音寺', type: 'human', note: '须弥山须弥金顶。度化众生，镇压邪魔，修罗汉金身。' },
  ], color: '#eccc68', x: 15, y: 50 },
  special_east: { name: '蓬莱仙岛', realm: '上古秘境', type: 'neutral', desc: '【极东尽头归墟之眼深处】每六十年现世三十天的上古仙界碎片。核心物品：澪之果。', factions: [{ name: '冥煞玄蛇', type: 'monster', note: '守护者。' }], color: '--rare-text', x: 92, y: 50 },
  s_youlin: { name: '幽林血沼', realm: '低阶秘境', type: 'blood', desc: '【南离火洲十万大山古战场外围】炼气期修士试炼场与坟场。核心物品：蒲灵果、玉髓芝。', factions: [{ name: '嗜血鬼藤', type: 'monster', note: '守护者。' }], color: '--accent-blood', x: 35, y: 75 },
  s_gengjin: { name: '庚金剑冢', realm: '低阶秘境', type: 'human', desc: '【西漠佛国叹息沙海地下千丈】上古剑宗遗址，充满庚金剑气。进入限制：元婴以下。核心物品：金灵玉髓。', factions: [{ name: '残缺剑傀', type: 'monster', note: '守护者。' }], color: '#eccc68', x: 25, y: 35 },
  s_liuli: { name: '琉璃净月宫', realm: '高阶秘境', type: 'neutral', desc: '【北冥雪原北冥黑渊极境海眼】中古大能折叠行宫，极寒幻境。进入限制：化神以下。核心物品：九曲灵参、造化青莲莲子。', factions: [{ name: '霜骨冰蛟', type: 'monster', note: '守护者。' }], color: '--accent-mana', x: 35, y: 15 },
  s_wuxing: { name: '五行碎层', realm: '高阶绝地', type: 'neutral', desc: '【中央神州天陨坑上空万丈虚空夹缝】不稳定空间裂缝，存在法则碾压。进入限制：炼虚以下。核心物品：五行灵髓、虚空花。', factions: [{ name: '亚种虚空兽', type: 'monster', note: '守护者。' }], color: '--rare-text', x: 65, y: 35 },
  s_shahai: { name: '无垠沙海镜像', realm: '大能禁区', type: 'neutral', desc: '【依附西漠佛国叹息沙海背面】高维镜像空间，方向与因果皆反。进入限制：合体以下。核心物品：空灵晶液。', factions: [{ name: '蜃灵皇残魂', type: 'monster', note: '守护者。' }], color: '--rare-text', x: 10, y: 70 },
  s_yunsheng: { name: '陨圣乱墟', realm: '大能禁区', type: 'demon', desc: '【东极青木域极东九天罡风层深处】远古大能战场残块。进入限制：大乘以下。核心物品：三元归一果。', factions: [{ name: '怨念尸魔', type: 'demon', note: '守护者。' }], color: '--accent-blood', x: 85, y: 15 },
  s_huangquan: { name: '黄泉冥河引', realm: '大能禁区', type: 'demon', desc: '【南离火洲阴冥河死脉尽头】阴阳交汇处，生人禁区。核心物品：九转还魂草根须。', factions: [{ name: '渡魂诡灵', type: 'demon', note: '守护者。' }], color: '--accent-blood', x: 65, y: 90 },
  s_tianyuan: { name: '天渊起源地', realm: '世界本源', type: 'neutral', desc: '【玄天界界壁护罩最深层夹缝】天道直辖，大乘期伐天之地。核心物品：玄黄之气。', factions: [{ name: '天道灾兽化身', type: 'neutral', note: '守护者。' }], color: '--accent-gold', x: 50, y: 5 },
};

export const xianjieLore: MapData = {
  center: { name: '钧天仙域', realm: '仙界之心', type: 'human', desc: '此地仙气浓郁到凝为七彩祥云，宫阙浮空，金道横空，龙凤仙鹤往来其间。天地法则最为稳固清晰，甚至可显化为肉眼可见的符文锁链。核心基调：秩序、威严、天道至上。', factions: [{ name: '天庭', type: 'human', note: '明面上最高权力机构，执掌天规，统御万仙。重要地标：凌霄仙阙、天规神碑。' }, { name: '云上瑶池', type: 'neutral', note: '真正的顶层决策与至高战力所在之地。' }], color: '--accent-gold', x: 50, y: 50 },
  north: { name: '玄冥仙域', realm: '幽冥轮回', type: 'blood', desc: '无日月星辰，唯见幽蓝磷光与弱水河光。白骨山脉连绵，魂力、阴煞、死气弥漫。核心基调：死亡、轮回、无序。', factions: [{ name: '阴煞宗', type: 'demon', note: '明面上势力最强，驻地为灵冥渊。' }, { name: '散仙秘境', type: 'neutral', note: '大量散仙强者隐居的独立空间。' }, { name: '地府入口', type: 'neutral', note: '传说中掌管仙神魂灵轮回的神秘之地。' }], color: '--accent-mana', x: 50, y: 15 },
  south: { name: '炎极仙域', realm: '不灭火海', type: 'demon', desc: '天空悬有三轮烈日，大地之上仙火熔岩长流不息。空气中满是狂暴火元与硫磺气息。核心基调：混乱、力量、弱肉强食。', factions: [{ name: '太古王族', type: 'demon', note: '盘踞的核心浮空神都「太古神都」。' }, { name: '极乐宗', type: 'demon', note: '在火海幻境中开宗立派的顶级宗门，内有极乐玉溪。' }], color: '--accent-blood', x: 50, y: 85 },
  east: { name: '青华仙域', realm: '万木之乡', type: 'monster', desc: '域内尽是原始仙林与参天古木，更有建木、扶桑等开天神木，空气中充斥乙木灵气与生命气息。核心基调：原始、共存、血脉至上。', factions: [{ name: '玉灵宫', type: 'neutral', note: '顶级仙门之一，山门所在为玉灵仙山。' }, { name: '万妖古界', type: 'monster', note: '妖族的核心势力范围。' }, { name: '先天仙灵域', type: 'neutral', note: '先天仙灵的聚居地，传说中种植着无数仙药的万药仙圃亦在此。' }], color: '--accent-san', x: 85, y: 50 },
  west: { name: '太白仙域', realm: '万剑之墟', type: 'human', desc: '天地间充斥锋锐庚金之气。大地如铸，山峰如利剑倒插天穹。肃杀锐利，铁血不屈。核心基调：战斗、守护、以剑为尊。', factions: [{ name: '剑修联盟', type: 'human', note: '以剑为尊的主流联盟，强者当道。' }, { name: '真灵世家', type: 'monster', note: '真灵血脉世家，权势极重，祖地在真灵古穴。' }, { name: '天庭前线', type: 'human', note: '界碑古关由天庭重兵镇守，抵御时空乱流海。还有陨仙古战场，杀机与机缘并存。' }], color: '#eccc68', x: 15, y: 50 },
};

export const MAPS: Record<MapRealm, MapData> = { 玄天界: xuantianLore, 仙界: xianjieLore };

export function getConnections(data: MapData): Array<[string, string]> {
  const connections: Array<[string, string]> = [['center', 'north'], ['center', 'south'], ['center', 'east'], ['center', 'west']];
  if (data.special_east) connections.push(['east', 'special_east']);
  if (data.s_youlin) connections.push(['south', 's_youlin'], ['west', 's_gengjin'], ['north', 's_liuli'], ['center', 's_wuxing'], ['west', 's_shahai'], ['east', 's_yunsheng'], ['south', 's_huangquan'], ['center', 's_tianyuan']);
  return connections.filter(([from, to]) => data[from] && data[to]);
}

export function mapNodeClass(key: string): string {
  if (['center', 'north', 'south', 'east', 'west'].includes(key)) return key;
  return key === 'special_east' ? 'special' : 'secret';
}

export function mapNodeColor(color: string): string {
  const tokens: Record<string, string> = {
    '--accent-gold': 'var(--c-primary)', '--accent-mana': '#72a8d4', '--accent-blood': 'var(--c-danger)',
    '--accent-san': '#83b691', '--rare-text': '#b99adb',
  };
  return tokens[color] ?? (color || 'var(--c-text)');
}

export function normalizeMapNode(realm: MapRealm, raw: string): string {
  const data = MAPS[realm];
  if (data[raw]) return raw;
  const byName = Object.entries(data).find(([, node]) => node.name === raw);
  if (byName) return byName[0];
  if (raw === '天机阁' && realm === '玄天界') return 'center';
  return 'center';
}

function locationText(value: string): string {
  return value.normalize('NFKC').replace(/[\s·•—_－/\\，,。.【】\[\]（）()]+/g, '');
}

const MAP_LANDMARKS: Partial<Record<`${MapRealm}:${string}`, string[]>> = {
  '玄天界:center': ['神都洛阳', '杏临谷', '蜀山群峰', '昆仑神山', '万法天仪', '落英山脉', '十里桃林', '结缘神木', '百花谷', '极极宫', '蜃楼飞阁', '摘星悬岛', '灵兽原', '青音湖', '云符山', '千阵岭'],
  '玄天界:north': ['广寒玉宫', '北冥黑渊'],
  '玄天界:south': ['太阳火殿', '葬仙坡', '地下黑市', '不枯血海', '血骨浮岛', '十二通天血柱', '阴风山脉', '万鬼窟'],
  '玄天界:east': ['万妖山脉', '沂云森林', '落凤坡', '五色谷', '碧玉温泉'],
  '玄天界:west': ['须弥山', '须弥金顶', '叹息沙海'],
  '玄天界:special_east': ['归墟之眼'],
  '仙界:center': ['凌霄仙阙', '天规神碑', '云上瑶池'],
  '仙界:north': ['灵冥渊', '散仙秘境', '地府入口'],
  '仙界:south': ['太古神都', '极乐玉溪'],
  '仙界:east': ['玉灵仙山', '万妖古界', '先天仙灵域', '万药仙圃'],
  '仙界:west': ['真灵古穴', '界碑古关', '陨仙古战场'],
};

/** Resolve a read-only stat_data.世界.当前地点 string to one original map node. */
export function resolveWorldMapLocation(rawLocation: string): ResolvedMapLocation | null {
  const location = locationText(formatWorldLocation(rawLocation));
  if (!location || location === '未接入' || location === '未知') return null;
  const matches: Array<ResolvedMapLocation & { score: number }> = [];
  for (const [realm, data] of Object.entries(MAPS) as Array<[MapRealm, MapData]>) {
    for (const [nodeKey, node] of Object.entries(data)) {
      const nodeName = locationText(node.name);
      if (nodeName && location.includes(nodeName)) {
        matches.push({ realm, nodeKey, node, matchedBy: 'node', score: 300 + nodeName.length });
        continue;
      }
      const factions = node.factions.map(faction => locationText(faction.name)).filter(name => name && location.includes(name));
      if (factions.length) {
        matches.push({ realm, nodeKey, node, matchedBy: 'faction', score: 200 + Math.max(...factions.map(name => name.length)) });
        continue;
      }
      const landmarks = (MAP_LANDMARKS[`${realm}:${nodeKey}`] ?? []).map(locationText).filter(name => location.includes(name));
      if (landmarks.length) matches.push({ realm, nodeKey, node, matchedBy: 'landmark', score: 100 + Math.max(...landmarks.map(name => name.length)) });
    }
  }
  matches.sort((left, right) => right.score - left.score);
  if (!matches.length || (matches[1] && matches[1].score === matches[0].score)) return null;
  const { score: _score, ...resolved } = matches[0];
  return resolved;
}
