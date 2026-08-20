import assert from 'node:assert/strict';
import {
  applyPromptInjection,
  buildPromptInjectionContent,
  DAOYUAN_PROMPT_INJECTION_ID,
} from '../src/services/promptInjectionRuntime.ts';

const source = {
  yujianMessages: [],
  trends: [{ id:'trend-1', type:'异闻', title:'风闻标题', description:'风闻正文', source:'测试', credibility:60, storyTime:'今日', createdAt:'2026-08-20T00:00:00.000Z', heat:1 }],
  forum: [{ id:'forum-1', tag:'讨论', title:'论坛标题', content:'论坛正文', author:'测试修士', storyTime:'今日', createdAt:'2026-08-20T00:00:00.000Z', likes:0, comments:[] }],
  news: [{ id:'news-1', title:'天机日报', issue:'第一期', editor:'测试', editorNote:'编者按', storyTime:'今日', createdAt:'2026-08-20T00:00:00.000Z', likes:0, articles:[{ id:'article-1', tag:'要闻', title:'日报标题', content:'日报正文', source:'测试' }], letters:[] }],
  merchantTransactions: [],
};

const allOff = { yujian:false, trends:false, forum:false, news:false };
assert.equal(buildPromptInjectionContent(allOff, source), '');

const trendsOnly = buildPromptInjectionContent({ ...allOff, trends:true }, source);
assert.match(trendsOnly, /风闻标题/);
assert.doesNotMatch(trendsOnly, /论坛标题|日报标题/);

const forumOnly = buildPromptInjectionContent({ ...allOff, forum:true }, source);
assert.match(forumOnly, /论坛标题/);
assert.doesNotMatch(forumOnly, /风闻标题|日报标题/);

const newsOnly = buildPromptInjectionContent({ ...allOff, news:true }, source);
assert.match(newsOnly, /日报标题/);
assert.doesNotMatch(newsOnly, /风闻标题|论坛标题/);

const calls = [];
const cleanup = applyPromptInjection({
  uninjectPrompts(ids) { calls.push(['explicit-uninject', ...ids]); },
  injectPrompts(prompts) {
    calls.push(['inject', prompts[0].id]);
    return { uninject() { calls.push(['returned-uninject']); } };
  },
}, trendsOnly);
assert.deepEqual(calls.slice(0, 2), [
  ['explicit-uninject', DAOYUAN_PROMPT_INJECTION_ID],
  ['inject', DAOYUAN_PROMPT_INJECTION_ID],
]);
cleanup?.();
assert.deepEqual(calls.slice(-2), [
  ['returned-uninject'],
  ['explicit-uninject', DAOYUAN_PROMPT_INJECTION_ID],
]);

console.log('prompt injection behavior passed: independent source toggles and deterministic fixed-id cleanup');
