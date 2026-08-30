import { XuantianSimulationStateSchema } from './schema.ts';
import type { XuantianFactionRank, XuantianFactionState, XuantianRegionId, XuantianSimulationState } from './types.ts';

const FACTIONS: Array<[string, XuantianRegionId|'cross', XuantianFactionRank, string]> = [
  ['天机阁','cross','跨域组织','探查天机、贩卖情报并维持绝对中立'],['万宝楼','cross','跨域组织','掌控天下商道并维持银货两讫'],['黑金阁','cross','地下组织','统辖暗杀、走私与地下交易'],
  ['大周仙朝','center','顶尖势力','强化皇权并收编天下宗门'],['蜀山剑门','center','顶尖势力','斩妖除魔并守护人族'],['昆仑道门','center','顶尖势力','顺应天道并封山清修'],['万法宗','center','顶尖势力','有教无类并解析万法本源'],['合欢宗','center','顶尖势力','以阴阳交合与采补追求大道'],['星道宗','center','顶尖势力','推演因果并以星道干预局势'],['桃花宗','center','顶尖势力','以情入道并保护真情因缘'],
  ['湮丹宗','center','大型势力','掌控丹药与灵植资源'],['灵墟宗','center','大型势力','御使妖兽并扩张灵兽资源'],['青玉宗','center','大型势力','以音入道并维持女修传承'],['符韵门','center','大型势力','摄取法则并发展符道'],['阵天宗','center','大型势力','借天地大势发展阵道'],['南梁古国','center','凡人势力','依附宗门维持凡俗统治'],['斩仙盟','center','地下组织','以武入道并反抗仙门控制'],
  ['太阳神宫','south','顶尖势力','汲取太阳火精淬炼肉身'],['尸魔宗','south','顶尖势力','炼化尸身并于腐朽中求永生'],['血神宫','south','顶尖势力','吞噬精血壮大宗门'],['万魂殿','south','顶尖势力','炼化怨魂以壮大神识'],
  ['九尾天狐族','east','顶尖势力','维护青丘血脉与幻术传承'],['神猿族','east','顶尖势力','信奉力量并以力破万法'],['五色孔雀族','east','顶尖势力','提纯五行血脉与五色神光'],['柳蛇族','east','大型势力','维持族群繁衍并依附天狐族'],
  ['广寒宫','north','顶尖势力','修太阴之道并守护雪原资源'],['蛟龙一族','north','顶尖势力','吞噬掠夺并追求真龙大道'],
  ['大雷音寺','west','顶尖势力','镇压邪魔并统御西漠佛国'],
];

const factionId = (name:string):string => `f_${name}`;
export function createDefaultXuantianSimulationState(chatId:string):XuantianSimulationState {
  const regions = {
    center:{id:'center',name:'中央神州',alignment:'人族宗门与仙朝共治',status:'暗流',pressure:30,summary:'繁荣而尊卑森严，各宗门与仙朝长期竞合。',updatedAtDay:0},
    east:{id:'east',name:'东极青木域',alignment:'妖族部落割据',status:'暗流',pressure:28,summary:'血脉与领地决定秩序，妖族势力彼此制衡。',updatedAtDay:0},
    south:{id:'south',name:'南离火洲',alignment:'魔道与体修并立',status:'紧张',pressure:46,summary:'魔宗争夺血肉、神魂与尸骸资源，冲突频繁。',updatedAtDay:0},
    north:{id:'north',name:'北冥雪原',alignment:'冰道宗门与妖族',status:'暗流',pressure:34,summary:'广寒宫与蛟龙一族围绕矿脉和寒域资源对峙。',updatedAtDay:0},
    west:{id:'west',name:'西漠佛国',alignment:'佛门神权',status:'平稳',pressure:22,summary:'大雷音寺以戒律统御佛国并持续镇压邪魔。',updatedAtDay:0},
  } as XuantianSimulationState['regions'];
  const factions:Record<string,XuantianFactionState> = Object.fromEntries(FACTIONS.map(([name,regionId,rank,objective])=>{const id=factionId(name);return [id,{id,name,regionId,rank,status:'平静',relation:'未知',objective,activity:'尚无已确认的新行动。',influence:rank==='顶尖势力'?70:rank==='跨域组织'?65:rank==='大型势力'?48:25,updatedAtDay:0}];}));
  return XuantianSimulationStateSchema.parse({schemaVersion:1,chatId,sequence:0,worldDay:0,calendarLabel:'元会历·未校准',lastCommittedFingerprint:'',regions,factions,events:[],autoCounter:0,processedMessageIds:[],processedMessageFingerprints:[]}) as XuantianSimulationState;
}

export function initializeXuantianSimulationState(existing:unknown,chatId:string):XuantianSimulationState {
  const migrated=existing&&typeof existing==='object'&&!Array.isArray(existing)&&!('processedMessageFingerprints' in existing)?{...existing,processedMessageFingerprints:[]}:existing;
  const parsed=XuantianSimulationStateSchema.safeParse(migrated);
  if(!parsed.success||parsed.data.chatId!==chatId)return createDefaultXuantianSimulationState(chatId);
  const baseline=createDefaultXuantianSimulationState(chatId);
  return XuantianSimulationStateSchema.parse({...parsed.data,factions:{...baseline.factions,...parsed.data.factions}}) as XuantianSimulationState;
}
