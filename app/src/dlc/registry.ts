import type { DlcId } from './types.ts';

export interface DlcRegistryItem { id: DlcId; label: string; recommendedName: string; aliases: string[]; seedPath: string; activation: 'realm-progression' | 'baihua-location' | 'luoyang-location' | 'shushan-hybrid'; }

export const BAIHUA_LOCATION_ENTRIES = new Set([
  '百花谷设定', '百花谷设定补充【开始】', '百花谷设定补充【结束】', '设施-芳华集', '设施-流芳津', '设施-烟霞街', '设施-迎春馆',
  '设施-流觞苑', '设施-霓裳台', '设施-镜花园', '设施-流霞台', '设施-照影间', '设施-流香院', '设施-听雨居',
  '设施-玉露泉', '设施-锁心堂', '设施-摘星楼', '设施-欲湖', '身体改造', '设施-沉香窟', '基础改造', '进阶改造',
  '极乐改造', '合欢改造', '百花谷角色群体设定', '道具', '百花谷任务发布', '百花谷物价参考', '设施-绮梦阁', '位置信息', '特殊活动',
  '地点-百花坊',
]);

export const SHUSHAN_BASE_ENTRIES = new Set([
  '叙事基调', '入门登记', '日常课程与修炼', '年度大事', '部门总纲', '蜀山剑门', '各峰特化',
]);
export const SHUSHAN_PEAK_ENTRIES = new Set(['飞霜峰', '镇岳峰', '凌虚峰', '抱朴峰', '冲霄峰', '无我峰']);
export const SHUSHAN_LOCATION_MARKERS = ['蜀山', '飞霜峰', '镇岳峰', '凌虚峰', '抱朴峰', '冲霄峰', '无我峰', '青石坊', '锁妖塔'] as const;

export const WAN_NIAN_PROCESSES = ['进程一: 萌动', '进程二: 爆发', '进程三: 升华', '进程四: 灾劫', '进程五: 疯嚣'] as const;
export const WAN_NIAN_UNLOCK_STAGE: Readonly<Record<string, number>> = {
  '天华帝国历史': 0, '人物详情: 疯帝-瑕': 0, '血肉机关生成': 0, '血肉机关: 血傀': 0, '血肉机关: 血巢': 1,
  '血肉机关: 毕方': 2, '血肉机关: 相柳': 2, '血肉机关: 蠃鱼': 2, '血肉机关: 白泽': 2, '疯嚣之作: 梼杌': 2,
  '疯嚣之作: 穷奇': 3, '疯嚣之作: 饕餮': 3, '疯嚣之作: 混沌': 3, '血肉机关: 共工': 3, '血肉机关: 祝融': 3,
};

export const DLC_REGISTRY: readonly DlcRegistryItem[] = [
  { id: 'wan_nian_chou_yuan', label: '万年仇怨', recommendedName: '道渊DLC·万年仇怨', aliases: ['万年仇怨'], seedPath: './seeds/wanNianChouYuan.json', activation: 'realm-progression' },
  { id: 'he_huan_zong', label: '合欢宗·百花谷', recommendedName: '道渊DLC·合欢宗', aliases: ['合欢宗扩展', '合欢宗拓展'], seedPath: './seeds/heHuanZong.json', activation: 'baihua-location' },
  { id: 'luo_yang', label: '洛阳', recommendedName: '道渊DLC·洛阳', aliases: ['洛阳扩展', '洛阳拓展'], seedPath: './seeds/luoYang.json', activation: 'luoyang-location' },
  { id: 'shu_shan', label: '蜀山剑门', recommendedName: '道渊DLC·蜀山', aliases: ['蜀山扩展2.0', '蜀山扩展', '蜀山拓展'], seedPath: './seeds/shuShan.json', activation: 'shushan-hybrid' },
];

export function getDlcRegistryItem(id: DlcId): DlcRegistryItem { const item = DLC_REGISTRY.find((candidate) => candidate.id === id); if (!item) throw new Error(`Unknown DLC id: ${id}`); return item; }
