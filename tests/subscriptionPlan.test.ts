import assert from 'node:assert/strict';
import test from 'node:test';
import { FEATURE_CATALOG, buildPlanPayload, createPlanDraft, planToDraft, summarizePlan, validatePlanDraft } from '../src/lib/subscriptionPlan.ts';
import type { PlanDraft } from '../src/lib/subscriptionPlan.ts';

const COURSE = '1381b138-8036-4d53-90d9-565e8654d2fd';
function valid(): PlanDraft {
  return { ...createPlanDraft(), code: 'basic_monthly', title: 'Базова', price: '300' };
}
function enabled(draft: PlanDraft, key: keyof PlanDraft['features'], limit?: string) {
  draft.features[key] = { enabled: true, unlimited: limit === undefined, limit: limit ?? '' };
}

test('new plans start inactive with no granted feature or course and no invented price', () => {
  const draft = createPlanDraft();
  assert.equal(draft.is_active, false);
  assert.equal(draft.price, '');
  assert.equal(draft.courses.mode, 'none');
  assert.deepEqual(draft.courses.ids, []);
  assert.ok(Object.values(draft.features).every(rule => rule.enabled === false));
  assert.equal(draft.features.translation.unlimited, false);
  draft.features.translation.enabled = true;
  assert.ok(validatePlanDraft(draft)['features.translation.limit']);
  assert.ok(validatePlanDraft(draft).price);
  const second = createPlanDraft();
  draft.features.translation.enabled = true;
  draft.courses.ids.push(COURSE);
  assert.equal(second.features.translation.enabled, false);
  assert.deepEqual(second.courses.ids, []);
});

test('catalog separates ready and planned features and does not gate account/security/accessibility', () => {
  assert.equal(new Set(FEATURE_CATALOG.map(feature => feature.key)).size, 9);
  assert.deepEqual(FEATURE_CATALOG.filter(feature => feature.status === 'planned').map(feature => feature.key), ['ai_assistant']);
  assert.equal(FEATURE_CATALOG.find(feature => feature.key === 'personal_cards')?.period, 'total');
  assert.equal(FEATURE_CATALOG.find(feature => feature.key === 'translation')?.period, 'day');
  assert.ok(!FEATURE_CATALOG.some(feature => /account|security|accessibility|notification/.test(feature.key)));
});

test('builds exact translation/day and stock card limits without converting them to legacy AI limits', () => {
  const draft = valid();
  enabled(draft, 'translation', '50');
  enabled(draft, 'personal_cards', '200');
  draft.courses = { mode: 'selected', ids: [COURSE.toUpperCase()] };
  const payload = buildPlanPayload(draft);
  assert.deepEqual(payload.entitlements.features.translation, { enabled: true, limit: 50, period: 'day' });
  assert.deepEqual(payload.entitlements.features.personal_cards, { enabled: true, limit: 200, period: 'total' });
  assert.deepEqual(payload.entitlements.courses, { mode: 'selected', ids: [COURSE] });
  assert.equal(payload.ai_requests_limit, null);
  assert.equal(payload.price, 300);
});

test('explicit unlimited and nonnumeric features always serialize null quota and period', () => {
  const draft = valid();
  enabled(draft, 'translation');
  enabled(draft, 'course_dictionary', '900');
  draft.features.translation.limit = 'stale invalid input';
  const payload = buildPlanPayload(draft);
  assert.deepEqual(payload.entitlements.features.translation, { enabled: true, limit: null, period: null });
  assert.deepEqual(payload.entitlements.features.course_dictionary, { enabled: true, limit: null, period: null });
});

test('disabled features cannot retain a quota in the saved policy', () => {
  const draft = valid();
  draft.features.translation = { enabled: false, unlimited: false, limit: '50' };
  assert.deepEqual(buildPlanPayload(draft).entitlements.features.translation, { enabled: false, limit: null, period: null });
});

test('quota requires integer1..1000000; decimals/exponents/negatives/zero are not accepted', () => {
  for (const value of ['', '0', '-1', '1.5', '5e2', '1,5', '1000001', 'Infinity', '  ']) {
    const draft = valid(); enabled(draft, 'speaking_review', value);
    assert.ok(validatePlanDraft(draft)['features.speaking_review.limit'], value);
    assert.throws(() => buildPlanPayload(draft));
  }
  for (const value of ['1', '1000000', ' 50 ']) {
    const draft = valid(); enabled(draft, 'speaking_review', value);
    assert.deepEqual(validatePlanDraft(draft), {});
  }
});

test('money accepts exact two-decimal comma values and rejects unsafe numeric formats', () => {
  const draft = valid(); draft.price = ' 300,50 ';
  assert.equal(buildPlanPayload(draft).price, 300.5);
  draft.price = '99999999.99'; assert.equal(buildPlanPayload(draft).price, 99999999.99);
  draft.price = '0'; assert.equal(buildPlanPayload(draft).price, 0);
  for (const price of ['-1', '100000000', '300.001', '3e2', 'NaN', 'Infinity', '', '3 000', '.5']) {
    assert.ok(validatePlanDraft({ ...draft, price }).price, price);
  }
});

test('validates product fields independently from browser input restrictions', () => {
  const draft = valid();
  for (const code of ['a', 'Basic', 'has space', 'a'.repeat(65), 'bad/path']) assert.ok(validatePlanDraft({ ...draft, code }).code, code);
  assert.deepEqual(validatePlanDraft({ ...draft, code: 'premium_family-1' }), {});
  assert.ok(validatePlanDraft({ ...draft, title: ' ' }).title);
  assert.ok(validatePlanDraft({ ...draft, title: 'x'.repeat(121) }).title);
  assert.ok(validatePlanDraft({ ...draft, description: 'x'.repeat(2001) }).description);
  assert.ok(validatePlanDraft({ ...draft, billing_period: 'week' } as unknown as PlanDraft).billing_period);
  assert.ok(validatePlanDraft({ ...draft, tier: 'free' } as unknown as PlanDraft).tier);
  assert.ok(validatePlanDraft({ ...draft, currency: 'uah' }).currency);
  assert.ok(validatePlanDraft({ ...draft, reward_currency: '1.5' }).reward_currency);
});

test('image policy permits HTTPS without credentials and no embedded/data/local transport', () => {
  const draft = valid();
  for (const image_url of ['http://example.com/img.png', 'data:image/png;base64,AAA', 'file:///C:/img.png', 'https://user:password@example.com/img.png']) assert.ok(validatePlanDraft({ ...draft, image_url }).image_url);
  assert.equal(buildPlanPayload({ ...draft, image_url: ' https://example.com/img.png ' }).image_url, 'https://example.com/img.png');
  assert.equal(buildPlanPayload({ ...draft, image_url: ' ' }).image_url, null);
});

test('course scopes reject empty selected, malformed, duplicate/case-varied or stale ids', () => {
  const draft = valid();
  for (const courses of [
    { mode: 'selected', ids: [] }, { mode: 'selected', ids: ['not-uuid'] },
    { mode: 'selected', ids: [COURSE, COURSE.toUpperCase()] },
    { mode: 'all', ids: [COURSE] }, { mode: 'none', ids: [COURSE] },
    { mode: 'selected', ids: Array(1001).fill(COURSE) },
    { mode: 'other', ids: [] },
  ]) assert.ok(validatePlanDraft({ ...draft, courses } as PlanDraft)['courses.ids']);
  assert.deepEqual(validatePlanDraft({ ...draft, courses: { mode: 'all', ids: [] } }), {});
});

test('legacy rows remain visibly unconfigured and old AI/features data survives editing', () => {
  const row = { ...buildPlanPayload(valid()), entitlements: null, ai_requests_limit: 30, features: ['Старий опис', { old: 'value' }] };
  const draft = planToDraft(row);
  assert.equal(draft.needsConfiguration, true);
  assert.ok(Object.values(draft.features).every(rule => !rule.enabled));
  assert.match(summarizePlan(draft)[0], /ще не налаштовані/);
  draft.title = 'Нова назва';
  assert.match(validatePlanDraft(draft).entitlements, /Підтвердьте налаштування/);
  assert.throws(() => buildPlanPayload(draft), /Підтвердьте налаштування/);
  enabled(draft, 'translation', '50'); draft.needsConfiguration = false;
  const payload = buildPlanPayload(draft);
  assert.deepEqual(payload.features, row.features);
  assert.equal(payload.ai_requests_limit, 30);
  assert.equal(payload.entitlements.features.ai_assistant.enabled, false);
});

test('legacy plans require explicit configuration even when no feature is intended', () => {
  const draft = planToDraft({ ...buildPlanPayload(valid()), entitlements: null });
  assert.throws(() => buildPlanPayload(draft), /Підтвердьте налаштування/);
  draft.needsConfiguration = false;
  assert.ok(Object.values(buildPlanPayload(draft).entitlements.features).every(rule => !rule.enabled));
});

test('saved policies round-trip without losing individual quotas and course scopes', () => {
  const draft = valid();
  enabled(draft, 'translation', '50'); enabled(draft, 'personal_cards', '100'); enabled(draft, 'ai_assistant');
  draft.courses = { mode: 'selected', ids: [COURSE] };
  const payload = buildPlanPayload(draft);
  const loaded = planToDraft(payload);
  assert.equal(loaded.configIssue, null);
  assert.equal(loaded.needsConfiguration, false);
  assert.deepEqual(buildPlanPayload(loaded), payload);
  assert.ok(summarizePlan(loaded).some(item => item.includes('50 перекладів на день')));
  assert.ok(summarizePlan(loaded).some(item => item.includes('заплановано')));
});

test('each plan preserves its own course bundle when courses overlap and a bundle is edited', () => {
  const secondCourse = '73d7ec03-8075-4d79-a866-5685861ac165';
  const thirdCourse = '192747cc-8217-4560-a92d-62027def21d2';
  const first = valid();
  first.courses = { mode: 'selected', ids: [COURSE, secondCourse] };
  const second = { ...valid(), code: 'reading_bundle' };
  second.courses = { mode: 'selected', ids: [secondCourse, thirdCourse] };
  const storedFirst = buildPlanPayload(first);
  const storedSecond = buildPlanPayload(second);

  const editedFirst = planToDraft(storedFirst);
  editedFirst.courses.ids.splice(0, 1);
  assert.deepEqual(buildPlanPayload(editedFirst).entitlements.courses, { mode: 'selected', ids: [secondCourse] });
  assert.deepEqual(storedFirst.entitlements.courses, { mode: 'selected', ids: [COURSE, secondCourse] });
  assert.deepEqual(buildPlanPayload(planToDraft(storedSecond)).entitlements.courses, { mode: 'selected', ids: [secondCourse, thirdCourse] });

  editedFirst.courses = { mode: 'all', ids: [] };
  assert.deepEqual(buildPlanPayload(editedFirst).entitlements.courses, { mode: 'all', ids: [] });
  assert.deepEqual(storedSecond.entitlements.courses.ids, [secondCourse, thirdCourse]);
});

test('old plans with retired features remain editable without offering or resaving those features', () => {
  const draft = valid();
  enabled(draft, 'translation', '50');
  const payload = buildPlanPayload(draft);
  const oldFeatures = {
    ...payload.entitlements.features,
    ai_text_review: { enabled: true, limit: 10, period: 'day' },
    advanced_statistics: { enabled: true, limit: null, period: null },
    premium_cosmetics: { enabled: true, limit: null, period: null },
  };
  const loaded = planToDraft({ ...payload, entitlements: { ...payload.entitlements, features: oldFeatures } });
  assert.equal(loaded.configIssue, null);
  assert.deepEqual(validatePlanDraft(loaded), {});
  assert.deepEqual(summarizePlan(loaded), ['Переклад за натисканням · 50 перекладів на день']);
  assert.deepEqual(buildPlanPayload(loaded).entitlements.features, payload.entitlements.features);
  assert.equal(oldFeatures.ai_text_review.enabled, true);
});

test('unknown versions, feature keys and malformed saved rules block save instead of discarding data', () => {
  const payload = buildPlanPayload(valid());
  for (const entitlements of [
    { ...payload.entitlements, version: 2 },
    { ...payload.entitlements, extra: true },
    { ...payload.entitlements, features: { ...payload.entitlements.features, future_feature: { enabled: true, limit: null, period: null } } },
    { ...payload.entitlements, features: { translation: { enabled: true, limit: 5, period: 'month' } } },
    { ...payload.entitlements, features: { translation: { enabled: false, limit: 5, period: 'day' } } },
    { ...payload.entitlements, features: { course_dictionary: { enabled: true, limit: 5, period: 'day' } } },
    { ...payload.entitlements, features: { translation: { enabled: true, limit: 5.5, period: 'day' } } },
    { ...payload.entitlements, features: { translation: { enabled: true } } },
    { ...payload.entitlements, courses: { mode: 'all', ids: [COURSE] } },
  ]) {
    const loaded = planToDraft({ ...payload, entitlements });
    assert.ok(loaded.configIssue);
    assert.throws(() => buildPlanPayload(loaded));
  }
});

test('missing known keys in a supported saved policy remain disabled rather than receive defaults', () => {
  const payload = buildPlanPayload(valid());
  const loaded = planToDraft({ ...payload, entitlements: { version: 1, features: { translation: { enabled: true, limit: 50, period: 'day' } }, courses: { mode: 'none', ids: [] } } });
  assert.equal(loaded.configIssue, null);
  assert.equal(loaded.features.translation.enabled, true);
  assert.equal(loaded.features.ai_assistant.enabled, false);
  assert.deepEqual(buildPlanPayload(loaded).entitlements.features.pronunciation_review, { enabled: false, limit: null, period: null });
});

test('unknown feature drafts cannot be saved through typed or untyped callers', () => {
  const draft = valid();
  (draft.features as unknown as Record<string, unknown>).unrecognized = { enabled: true, unlimited: true, limit: '' };
  assert.ok(validatePlanDraft(draft).entitlements);
  assert.throws(() => buildPlanPayload(draft));
});

test('quota preview requests a limit instead of displaying a blank or invalid allowance', () => {
  const draft = valid();
  for (const limit of ['', '0', '1.5', '-2', '1000001']) {
    enabled(draft, 'translation', limit);
    assert.deepEqual(summarizePlan(draft), ['Переклад за натисканням · вкажіть ліміт']);
  }
  enabled(draft, 'translation', ' 50 ');
  assert.deepEqual(summarizePlan(draft), ['Переклад за натисканням · 50 перекладів на день']);
});
