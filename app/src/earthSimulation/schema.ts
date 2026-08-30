import { z } from 'zod';

const id = z.string().trim().min(1);
const date = z.iso.date();
const RegionSchema = z.strictObject({ id, name: id, status: z.enum(['平稳', '异常迹象', '局部应对']), summary: z.string().max(1000), updatedAt: date });
const FactionSchema = z.strictObject({ id, name: id, category: z.enum(['国家与区域', '财团与跨国组织', '民间与地下组织', '玄天界势力']), contact: z.enum(['未接触', '已接触']), status: z.enum(['潜伏', '筹备', '活跃', '对抗', '合作']), objective: z.string().max(1000), activity: z.string().max(1000), influence: z.number().int().min(0).max(100), updatedAt: date });
const SchoolSchema = z.strictObject({ id, name: id, stage: z.enum(['筹备启动', '选址', '建设', '试运行', '正式运行']) });
const NpcSchema = z.strictObject({ id, name: id, openingIdentity: id, status: z.literal('开局身份'), sourceEntryName: id });
const CitySchema = z.strictObject({ id, name: id, kind: z.enum(['earth-city', 'intersection-zone']), stage: z.enum(['开局现状', '不存在']), sourceEntryName: id });
const EventSchema = z.strictObject({ id, kind: z.enum(['冲突', '建设', '调查']), stage: id, status: z.enum(['active', 'closed']), summary: z.string().max(500), worldDate: date });
const CheckpointSchema = z.strictObject({ id, sequence: z.number().int().nonnegative(), worldDate: date, fingerprint: id });
const DiagnosticSchema = z.strictObject({ id, level: z.enum(['info', 'warning', 'error']), code: id, message: z.string().max(1000), createdAt: z.iso.datetime({ offset: true }) });

export const EarthSimulationStateSchema = z.strictObject({
  schemaVersion: z.literal(1), chatId: id, sequence: z.number().int().nonnegative(), lastCommittedFingerprint: z.string(),
  openingDate: date, earthDate: date, xuantianDate: date, timeRatio: z.enum(['1:5','1:2','1:1','2:1','5:1','10:1']), earthDayRemainder: z.number().int().min(0).max(9), revivalYear: z.number().int().nonnegative(),
  revivalStage: z.enum(['复苏初现', '局部复苏', '全球公开', '全面超凡化']),
  contactStage: z.enum(['互不知情', '少数知情', '势力接触', '公开交流']),
  secretRealmStage: z.enum(['未激活', '信息联系', '人员携物通行', '制度化往来']),
  swarmEarthStage: z.enum(['零星迹象', '局部虫巢', '区域战争', '双界同时入侵', '界域危机']),
  swarmXuantianStage: z.enum(['零星迹象', '局部虫巢', '区域战争', '双界同时入侵', '界域危机']),
  swarmPassageOpen: z.boolean(), regions: z.record(id, RegionSchema), factions: z.record(id, FactionSchema), schools: z.record(id, SchoolSchema), npcs: z.record(id, NpcSchema), cities: z.record(id, CitySchema),
  events: z.array(EventSchema).max(70), checkpoints: z.array(CheckpointSchema).max(20), diagnostics: z.array(DiagnosticSchema).max(80), autoCounter: z.number().int().nonnegative(), processedMessageIds: z.array(id).max(200), processedAutoMessageFingerprints: z.array(id).max(200), processedMessageFingerprints: z.array(id).max(200),
}).superRefine((state, context) => {
  const denominator = Number(state.timeRatio.split(':')[1]);
  if (state.earthDayRemainder >= denominator) context.addIssue({ code: 'custom', path: ['earthDayRemainder'], message: '地球时间累计余数必须小于当前比例的玄天界份数' });
  if (state.events.filter((event) => event.status === 'active').length > 20) context.addIssue({ code: 'custom', path: ['events'], message: '活跃事件不得超过20项' });
  if (state.events.filter((event) => event.status === 'closed').length > 50) context.addIssue({ code: 'custom', path: ['events'], message: '已关闭事件不得超过50项' });
  if (state.secretRealmStage === '未激活' && Object.values(state.cities).some((city) => city.kind === 'intersection-zone' && city.stage !== '不存在')) context.addIssue({ code: 'custom', path: ['cities'], message: '秘境未激活时四个功能区不得建成' });
});

export type ParsedEarthSimulationState = z.infer<typeof EarthSimulationStateSchema>;
