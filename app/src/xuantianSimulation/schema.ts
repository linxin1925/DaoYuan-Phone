import { z } from 'zod';

const id = z.string().trim().min(1).max(180);
const regionId = z.enum(['center','east','south','north','west']);
const RegionSchema = z.strictObject({ id: regionId, name:id, alignment:z.string().max(100), status:z.string().trim().min(1).max(60), pressure:z.number().int().min(0).max(100), summary:z.string().max(1000), updatedAtDay:z.number().int().nonnegative() });
const FactionSchema = z.strictObject({ id, name:id, regionId:z.union([regionId,z.literal('cross')]), rank:z.enum(['跨域组织','顶尖势力','大型势力','凡人势力','地下组织']), status:z.string().trim().min(1).max(60), relation:z.string().trim().min(1).max(60), objective:z.string().max(1000), activity:z.string().max(1000), influence:z.number().int().min(0).max(100), updatedAtDay:z.number().int().nonnegative() });
const EventSchema = z.strictObject({ id, name:id, kind:z.string().trim().min(1).max(80), regionId:z.union([regionId,z.literal('cross')]), factionIds:z.array(id).max(12), phase:z.enum(['苗头','酝酿','发展','高潮','收束']), progress:z.number().int().min(0).max(100), status:z.enum(['active','closed']), startedAtDay:z.number().int().nonnegative(), updatedAtDay:z.number().int().nonnegative(), summary:z.string().max(1000), consequence:z.string().max(1000) });

export const XuantianSimulationStateSchema = z.strictObject({
  schemaVersion:z.literal(1), chatId:id, sequence:z.number().int().nonnegative(), worldDay:z.number().int().nonnegative(), calendarLabel:z.string().max(120), lastCommittedFingerprint:z.string(),
  regions:z.object({ center:RegionSchema, east:RegionSchema, south:RegionSchema, north:RegionSchema, west:RegionSchema }), factions:z.record(id,FactionSchema), events:z.array(EventSchema).max(80), autoCounter:z.number().int().nonnegative(), processedMessageIds:z.array(id).max(200), processedMessageFingerprints:z.array(id).max(200),
}).superRefine((state,context)=>{ if(state.events.filter(event=>event.status==='active').length>24) context.addIssue({code:'custom',path:['events'],message:'活跃事件线不得超过24条'}); });
