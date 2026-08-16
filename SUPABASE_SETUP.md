# Налаштування Supabase

Адмінка використовує чинні таблиці `courses`, `lessons`, `cards`, `tags`, `card_tags` і розширює їх новими полями та сутностями з ТЗ.

1. Відкрийте Supabase Dashboard → SQL Editor.
2. Виконайте файл `supabase/migrations/202608160001_content_admin.sql`.
3. У Table Editor перевірте, що з’явилися таблиці `homework`, `achievements`, `cosmetics`, `subscription_plans`, `promo_codes`, `marketing_sources`.
4. Перед production-запуском замініть тимчасові permissive RLS-політики `admin_all` на політики для авторизованої ролі адміністратора.

Після міграції в адмінці працюватимуть рівні карток, неправильні дієслова, основні/додаткові курси, premium-замки, домашні завдання, досягнення, косметика, тарифи, промокоди та джерела реклами.
