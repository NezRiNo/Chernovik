# Черновик

Веб-журнал студенческого творчества Новосибирска: публикации после проверки редактором, реакции, комментарии, жалобы с выбором причины, личные кабинеты и панель модерации.

Вход и регистрация только по нику и паролю, почта не запрашивается. Фронтенд без сборки (HTML, CSS, JS), бэкенд на [Supabase](https://supabase.com).

## Структура

```
public/                 сайт целиком (его и публикуем)
  index.html
  css/style.css
  fonts/                шрифты Inter и Lora (лежат на сайте, без обращений к Google)
  css/fonts.css, css/style.css
  js/config.js          адрес и ключ Supabase, данные оператора для юридических страниц
  js/data.js            слой данных: Supabase или localStorage-демо
  js/app.js             интерфейс и страницы
  js/vendor/            библиотека Supabase (тоже локально, без CDN)
supabase/schema.sql     таблицы, права доступа (RLS), хранилище
.github/workflows/      автодеплой на GitHub Pages
```

## Быстрый просмотр на своём компьютере

```bash
cd public
python3 -m http.server 8080
```
Откройте http://localhost:8080. Если в `config.js` пусто, включится демо-режим (данные в браузере, аккаунты `mila_writes` и `redaktor`, пароль `demo1234`).

## Установка

### 1. Проект в Supabase
На supabase.com нажмите **New project**, задайте название и пароль базы, выберите регион и дождитесь создания.

### 2. Таблицы
**SQL Editor → New query**, вставьте весь файл `supabase/schema.sql`, нажмите **Run**. Должно появиться `Success`. Проверьте: в **Table Editor** есть `profiles`, `works`, `comments`, `reactions`, `reports`, а в **Storage** есть корзина `covers`.

Если вы уже запускали старую версию схемы (с почтой), выполните вместо повторного запуска:
```sql
create unique index if not exists profiles_nick_lower_idx on public.profiles (lower(nick));
alter table public.profiles add constraint profiles_nick_format
  check (nick ~ '^[A-Za-z0-9][A-Za-z0-9._-]{1,22}[A-Za-z0-9]$');
```
(если команда ругается на старые тестовые ники, удалите тестовых пользователей в Authentication → Users).

### 3. Ключи
**Project Settings → API**: скопируйте Project URL и publishable (anon) key в `public/js/config.js`. Секретный ключ (`secret` / `service_role`) в проект не добавляйте никогда.

### 4. Вход без почты: обязательная настройка
Откройте **Authentication → Providers → Email** и **выключите Confirm email**. Так как почты нет, подтверждать нечего: с включённым подтверждением регистрация работать не будет.

Внутри Supabase ник превращается в служебный адрес `ник@users.chernovik.app`. Письма на него не отправляются. Домен задаётся в `config.js` (`NICK_EMAIL_DOMAIN`), после запуска его менять нельзя.

### 5. GitHub
Создайте пустой репозиторий `chernovik` на github.com и выполните в папке проекта:
```bash
git init
git add .
git commit -m "Первая версия"
git branch -M main
git remote add origin https://github.com/ВАШ-НИК/chernovik.git
git push -u origin main
```

### 6. Публикация сайта
Supabase сайты не раздаёт, он служит бэкендом. В репозитории откройте **Settings → Pages → Source: GitHub Actions**. Во вкладке **Actions** дождитесь зелёной галочки (1–2 минуты). Сайт откроется на `https://ВАШ-НИК.github.io/chernovik/`.
Вместо GitHub Pages можно использовать Netlify, Vercel или Cloudflare Pages: папка публикации `public`, сборка не нужна.

### 7. Адрес сайта в Supabase
**Authentication → URL Configuration**: укажите свой адрес в Site URL и Redirect URLs.

### 8. Первый редактор
Зарегистрируйтесь на сайте как обычный автор, затем в SQL Editor:
```sql
update public.profiles set role = 'editor' where nick = 'ваш_ник';
```
Выйдите и войдите заново: появится раздел «Редакция». Несколько редакторов:
```sql
update public.profiles set role = 'editor' where nick in ('ник1', 'ник2', 'ник3');
```
Снять права: `update public.profiles set role = 'author' where nick = 'ник';`

### 9. Проверка
Зарегистрируйте тестового автора (режим инкогнито), отправьте работу, опубликуйте её редактором, поставьте реакцию, оставьте комментарий и пожалуйтесь на него: жалоба должна появиться у редактора.

## Юридические страницы и данные оператора

В подвале сайта есть ссылки на Пользовательское соглашение, Политику обработки данных и Согласие на обработку данных. Перед запуском заполните в `public/js/config.js` поля `OPERATOR_NAME`, `CONTACT` и `DB_REGION`. Пока они пусты, в текстах видны выделенные заглушки и пометка «Шаблон». Тексты должен проверить юрист.

При регистрации нужны две отметки: принятие соглашения вместе с политикой и отдельное согласие на обработку данных. Дата и версия согласия сохраняются в `profiles.consent_at` и `profiles.consent_version`. Пользователь может сам удалить аккаунт в личном кабинете.

Вместо загрузки фотографий есть 8 готовых аватаров (`a1`–`a8`), они рисуются в `app.js`.

## Обновление уже работающего проекта

Если база уже создана старой версией схемы, добавьте новые возможности (аватары, согласие, удаление аккаунта) одним запросом в SQL Editor:

```sql
alter table public.profiles add column if not exists avatar text not null default 'a1' check (avatar ~ '^a[1-8]$');
alter table public.profiles add column if not exists consent_at timestamptz not null default now();
alter table public.profiles add column if not exists consent_version text not null default '2026-11';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nick, uni, avatar)
  values (
    new.id, new.raw_user_meta_data->>'nick', new.raw_user_meta_data->>'uni',
    case when new.raw_user_meta_data->>'avatar' ~ '^a[1-8]$' then new.raw_user_meta_data->>'avatar' else 'a1' end
  );
  return new;
end;
$$;

create or replace function public.delete_my_account()
returns void language sql security definer set search_path = public, auth as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
```

## Как обновляется сайт

- **Файлы сайта** (`public/`): после каждого коммита в ветку `main` GitHub Actions сам выкладывает сайт заново, это занимает 1–2 минуты. Обновите страницу через Ctrl+Shift+R.
- **База данных**: SQL автоматически не применяется. Файл `supabase/schema.sql` в репозитории лишь хранится. Изменения базы нужно выполнить вручную в Supabase, SQL Editor.
- Данные пользователей (аккаунты, работы) при обновлении сайта не затрагиваются, они живут в Supabase.

## Потерянный пароль

Почты нет, поэтому пользователь сам пароль не восстановит. Администратор может задать новый пароль в SQL Editor:
```sql
update auth.users
set encrypted_password = extensions.crypt('новый_пароль', extensions.gen_salt('bf'))
where email = 'ник_строчными@users.chernovik.app';
```
Передайте новый пароль пользователю и попросите сменить его (смена пароля внутри сайта пока не сделана).

## Если что-то не работает

- **Внизу меню «Демо-режим».** Ключи не подхватились: проверьте `config.js`, сделайте `git push`, обновите страницу (Ctrl+Shift+R).
- **«Не удалось войти сразу после регистрации».** В Supabase включено Confirm email, выключите его (шаг 4).
- **«Этот ник уже занят или не подходит».** Ник занят (без учёта регистра) или не подходит под правила: 3–24 символа, латиница, цифры, точка, дефис, подчёркивание.
- **Ошибка `row-level security`.** `schema.sql` выполнился не до конца: запустите его снова на чистом проекте.
- **Обложка не загружается.** Проверьте корзину `covers` и размер файла (до 2 МБ).
- **Сайт не обновился.** `git add . && git commit -m "правки" && git push`, дождитесь зелёной галочки в Actions.

## Безопасность и перед запуском

- Права проверяются в базе (RLS), а не в браузере. Роль редактора выдаётся только SQL-запросом.
- Без почты проще создавать фейковые аккаунты. В Supabase включите **Authentication → Attack Protection** (CAPTCHA и ограничения), иначе возможен спам-аккаунтами.
- Серьёзную фильтрацию комментариев добавьте на сервере (сейчас простая проверка в браузере).
- Пользовательское соглашение должен проверить юрист.
