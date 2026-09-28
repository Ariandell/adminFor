// Refresh the Flutter offline catalogue from the same Supabase project as this admin.
import { writeFileSync } from 'node:fs';
import { readTable } from './supabase-local.mjs';

const target = 'C:/PStyledApp/assets/data/course_catalog_snapshot.json';
const [courses, lessons] = await Promise.all([readTable('courses'), readTable('lessons')]);
const sourceCourseId = '1381b138-8036-4d53-90d9-565e8654d2fd';
if (!courses.some(row => row.id === sourceCourseId)) throw new Error('Original A1 course is missing.');

const catalogue = {
  courses: courses
    .map(row => ({
      id: row.id,
      title: row.title,
      level: row.level,
      description: row.description,
      image_colored_url: row.image_colored_url,
      is_published: row.is_published,
      course_type: row.course_type,
      is_premium: row.is_premium,
      access_tier: row.access_tier,
      sort_order: row.sort_order,
    }))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.title).localeCompare(String(b.title))),
  lessons: lessons
    .map(row => ({
      id: row.id,
      course_id: row.course_id,
      title: row.title,
      description: row.description,
      order_index: row.order_index,
      is_published: row.is_published,
      is_unlocked: row.is_unlocked,
      access_tier: row.access_tier,
      introduction: row.content?.introduction ?? null,
    }))
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0) || a.id.localeCompare(b.id)),
};
writeFileSync(target, JSON.stringify(catalogue));
console.log(`Exported ${catalogue.courses.length} courses and ${catalogue.lessons.length} lessons`);
