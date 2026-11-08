/* Черновик: интерфейс. Вся работа с данными идёт через window.DB (см. data.js). */
(function () {
  'use strict';

  const FORMS = ['Проза', 'Стихи', 'Иллюстрация', 'Фото', 'Музыка'];
  const UNIS = ['НГУ', 'НГТУ (НЭТИ)', 'НГПУ', 'СибГУТИ', 'СГУПС', 'НГАСУ (Сибстрин)', 'НГАУ', 'НГМУ', 'НГК им. Глинки'];
  const REASONS = [
    ['Оскорбления и травля', 'Грубость, унижение, личные нападки'],
    ['Спам и реклама', 'Ссылки, рассылки, продвижение'],
    ['Плагиат или чужая работа', 'Автор не тот, кто указан'],
    ['Неприемлемый контент', 'Насилие, 18+, призывы к ненависти'],
    ['Персональные данные или нарушение закона', 'Чужие данные, незаконные материалы'],
    ['Другое', 'Опишите в комментарии'],
  ];
  const STATUS = {
    review: ['На проверке', 'mute'],
    published: ['Опубликовано', 'ink'],
    fix: ['Нужны правки', 'acc'],
    rejected: ['Отклонено', 'acc'],
  };
  const BAD_WORDS = /(дурак|идиот|тупо|ненавижу)/i; // клиентская автопроверка; серьёзную фильтрацию делайте на сервере

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const S = { me: null, form: '', uni: '', tab: 'queue', editId: null, seen: {}, tok: 0, reports: [], rp: null };
  const A = (window.A = {});
  const isEditor = () => !!(S.me && S.me.role === 'editor');
  const isDemo = () => DB.mode === 'demo';

  function toast(t) {
    const e = $('#toast');
    e.textContent = t; e.className = 'toast show';
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { e.className = 'toast'; }, 2600);
  }
  function go(h) { if (location.hash.slice(1) === h) render(); else location.hash = h; }
  const val = (id) => ($('#' + id) ? $('#' + id).value.trim() : '');
  const fail = (e) => toast(e.message || 'Что-то пошло не так. Попробуйте ещё раз');
  const fmtDate = (d) => new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  const paragraphs = (t) => String(t || '').split(/\n{2,}/).map((p) => `<p>${esc(p)}</p>`).join('');
  const safeUrl = (u) => (/^(https:|data:image\/)/.test(u || '') ? u : null);

  /* ---------- Иллюстрации-заглушки ---------- */
  const SCENES = [
    '<circle cx="170" cy="45" r="24" opacity=".7"/><path d="M0 160L60 90L110 135L170 75L240 160Z" opacity=".5"/><rect x="40" y="105" width="80" height="28"/><circle cx="58" cy="136" r="8"/><circle cx="104" cy="136" r="8"/>',
    '<path d="M20 160V40h40v30h40v30h40v30h40v30z" opacity=".8"/><circle cx="200" cy="40" r="18" opacity=".5"/>',
    '<g opacity=".7"><rect x="30" y="20" width="30" height="140"/><rect x="80" y="50" width="30" height="110"/><rect x="130" y="35" width="30" height="125"/><rect x="180" y="70" width="30" height="90"/></g>',
    '<circle cx="120" cy="80" r="46" opacity=".55"/><circle cx="150" cy="80" r="46" opacity=".35"/>',
    '<path d="M0 120Q60 60 120 110T240 90V160H0Z" opacity=".6"/><path d="M0 140Q80 100 140 135T240 120V160H0Z" opacity=".8"/>',
  ];
  const TINTS = ['#cfc5ac', '#bfb292', '#d8cfb8', '#c8bba0', '#d3c9b2'];
  function cover(w) {
    const u = safeUrl(w.cover_url);
    if (u) return `<span class="cover"><img src="${esc(u)}" alt="" loading="lazy"></span>`;
    const i = Math.max(0, FORMS.indexOf(w.form)) % SCENES.length;
    return `<span class="cover"><svg viewBox="0 0 240 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="240" height="160" fill="${TINTS[i]}"/><g fill="#1b1a17">${SCENES[i]}</g></svg></span>`;
  }

  /* ---------- Общие куски разметки ---------- */
  const card = (w) => `<a class="b tight work s4" href="#work-${esc(w.id)}">${cover(w)}<span class="txt">
      <span class="meta">${esc(w.form)}</span><h3>${esc(w.title)}</h3>
      <span class="meta">${esc(w.author.nick || '')}, ${esc(w.uni || 'вуз не указан')}</span>
      <span class="meta">♥ ${w.counts.like}&nbsp;&nbsp; ✦ ${w.counts.hit}&nbsp;&nbsp; ✎ ${w.counts.more}</span></span></a>`;
  const empty = (title, text, btn) => `<div class="b empty s12"><b>${title}</b>${text}${btn ? `<div style="margin-top:16px">${btn}</div>` : ''}</div>`;
  const options = (list, cur, first) => (first ? `<option value="">${first}</option>` : '') + list.map((x) => `<option${x === cur ? ' selected' : ''}>${esc(x)}</option>`).join('');

  function shell(active, html) {
    const nav = [['home', 'Главная'], ['catalog', 'Каталог'], ['publish', 'Опубликовать'], ['profile', 'Мой кабинет']];
    if (isEditor() || isDemo()) nav.push(['mod', 'Редакция']);
    nav.push(['about', 'О проекте']);
    const cur = active === 'work' ? 'catalog' : active;
    const me = S.me
      ? `<div class="who"><span class="avatar">${esc(S.me.nick[0].toUpperCase())}</span><div><b>${esc(S.me.nick)}</b><span>${isEditor() ? 'Редактор' : esc(S.me.uni || 'Автор')}</span></div></div><button class="btn sm" onclick="A.logout()">Выйти</button>`
      : '<a class="btn p" href="#register">Регистрация</a><a class="btn" href="#login">Войти</a>';
    return `<div class="shell"><aside class="side"><a class="brand" href="#home">Черновик<small>Веб-журнал студентов Новосибирска</small></a>
      <nav class="nav" aria-label="Основное меню">${nav.map(([k, t]) => `<a href="#${k}"${k === cur ? ' class="on" aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
      <div class="side-foot">${me}${isDemo() ? '<div class="demo-note">Демо-режим: данные хранятся только в этом браузере</div>' : ''}</div></aside>
      <main class="main">${html}</main></div>`;
  }

  /* ---------- Страницы ---------- */
  const V = {};

  V.home = async () => {
    const ws = await DB.listWorks({ status: 'published' });
    const authors = new Set(ws.map((w) => w.author.id)).size;
    const unis = new Set(ws.map((w) => w.uni).filter(Boolean)).size;
    const f = ws[0];
    const feat = f
      ? `<a class="b tight s8 big-work" href="#work-${esc(f.id)}">${cover(f)}<span class="txt"><span class="meta">Новое в журнале, ${esc(f.form.toLowerCase())}</span><h3>${esc(f.title)}</h3><span class="meta">${esc(f.author.nick || '')}, ${esc(f.uni || '')}</span><span class="excerpt">${esc(f.body)}</span></span></a>`
      : empty('Пока нет опубликованных работ', 'Станьте первым автором: отправьте работу, и редактор опубликует её после проверки.', '<a class="btn p" href="#publish">Опубликовать работу</a>');
    return `<div class="bento">
      <section class="b hero s8"><div class="label">Веб-журнал студентов Новосибирска</div>
        <h1>Здесь студенты публикуют то, что пишут, рисуют и снимают</h1>
        <p class="lead">Редактор читает каждую работу. Авторы получают читателей, а не лайки.</p>
        <div class="row"><a class="btn p big" href="#publish">Опубликовать работу</a><a class="btn big" href="#catalog">Читать журнал</a></div></section>
      <section class="b acc s4"><div class="label">Тема месяца, ноябрь</div><div class="theme-title">«Первый снег»</div>
        <p>Тема необязательная: можно участвовать, а можно публиковать своё. Работы принимаем до 30 ноября.</p>
        <a class="btn light" href="#publish">Участвовать</a></section>
      ${feat}
      <section class="b ink s4"><div class="label">Журнал сейчас</div><div class="stats">
        <div><div class="stat">${ws.length}</div><span>работ</span></div><div><div class="stat">${authors}</div><span>авторов</span></div><div><div class="stat">${unis}</div><span>вузов</span></div></div></section>
      ${ws.length > 1 ? `<div class="section-title"><h2>Свежие работы</h2><a href="#catalog">Весь каталог</a></div>${ws.slice(1, 7).map(card).join('')}` : ''}
      <div class="section-title"><h2>Как это работает</h2></div>
      <div class="b step s4"><b>Отправьте работу</b><p>Зарегистрируйтесь, загрузите текст или обложку и коротко напишите о работе.</p></div>
      <div class="b step s4"><b>Редактор читает</b><p>Мы публикуем или возвращаем с комментарием. Статус виден в вашем кабинете.</p></div>
      <div class="b step s4"><b>Вас находят</b><p>Читатели ставят реакции и пишут комментарии, а вы видите статистику.</p></div>
      <section class="b s6"><div class="label">Вузы Новосибирска</div><div class="chips">${UNIS.map((u) => `<button class="chip" onclick="A.byUni('${esc(u)}')">${esc(u)}</button>`).join('')}</div></section>
      <section class="b plain s6"><div class="label">Права и условия</div><p>Все права на работы остаются у авторов. Сайт бесплатный для авторов и читателей.</p><a class="btn sm" href="#terms">Пользовательское соглашение</a></section>
    </div>`;
  };

  V.catalog = async () => {
    const ws = await DB.listWorks({ status: 'published', form: S.form || undefined, uni: S.uni || undefined });
    return `<h1 class="page-title">Каталог</h1>
      <div class="row" style="margin-bottom:22px">${['', ...FORMS].map((f) => `<button class="chip${S.form === f ? ' on' : ''}" onclick="A.setForm('${f}')">${f || 'Все'}</button>`).join('')}
      <select style="width:auto;margin-left:auto" aria-label="Вуз" onchange="A.setUni(this.value)">${options(UNIS, S.uni, 'Любой вуз')}</select></div>
      <div class="bento">${ws.length ? ws.map(card).join('') : empty('Ничего не найдено', 'Попробуйте другой фильтр или опубликуйте свою работу в этой категории.', '<a class="btn p" href="#publish">Опубликовать работу</a>')}</div>`;
  };

  V.work = async (id) => {
    const w = await DB.getWork(id);
    const allowed = w && (w.status === 'published' || (S.me && (S.me.id === w.author_id || isEditor())));
    if (!allowed) return `<div class="b empty"><b>Работа не найдена</b>Возможно, она ещё на проверке или была удалена.<div style="margin-top:16px"><a class="btn" href="#catalog">В каталог</a></div></div>`;
    if (w.status === 'published' && !S.seen[id]) { S.seen[id] = 1; DB.incViews(id); }
    const [rx, cm] = await Promise.all([DB.reactions(id, S.me && S.me.id), DB.listComments(id)]);
    const pubd = w.status === 'published';
    const rb = [['like', '♥ Понравилось'], ['hit', '✦ Зацепило'], ['more', '✎ Хочу ещё']]
      .map(([k, t]) => `<button class="rb${rx.mine.includes(k) ? ' on' : ''}" onclick="A.react('${esc(id)}','${k}')">${t} ${rx.counts[k]}</button>`).join('');
    return `<article class="article"><a class="back" href="#catalog">Назад в каталог</a>
      ${pubd ? '' : `<p class="badge ${STATUS[w.status][1]}" style="display:inline-block">${STATUS[w.status][0]}</p>`}
      <div class="meta">${esc(w.form)}</div><h1 class="page-title" style="margin:4px 0 8px">${esc(w.title)}</h1>
      <div class="meta">${esc(w.author.nick || '')}, ${esc(w.uni || '')}, ${fmtDate(w.created_at)}
        ${pubd ? ` &nbsp;<button class="linkbtn" onclick="A.report('work','${esc(id)}')">Пожаловаться на работу</button>` : ''}</div>
      ${cover(w)}
      ${w.description ? `<p class="meta" style="font-style:italic">${esc(w.description)}</p>` : ''}
      <div class="prose${w.form === 'Стихи' ? ' poem' : ''}">${paragraphs(w.body)}</div>
      ${pubd ? `<div class="reactions">${rb}</div>
      <h2 style="font-size:26px;margin-bottom:12px">Комментарии</h2>
      <div class="row" style="flex-wrap:nowrap"><input id="ci" aria-label="Комментарий" placeholder="${S.me ? 'Написать комментарий' : 'Войдите, чтобы комментировать'}"><button class="btn p" onclick="A.comment('${esc(id)}')">Отправить</button></div>
      <p class="hint">Комментарии проходят автопроверку. Анонимных комментариев нет.</p>
      ${cm.map((c) => `<div class="comment"><b>${esc((c.author || {}).nick || 'автор')}</b><br>${esc(c.body)}<br><button class="linkbtn" onclick="A.report('comment','${esc(c.id)}')">Пожаловаться</button></div>`).join('')}` : ''}
    </article>`;
  };

  V.register = async () => {
    if (S.me) { location.hash = 'profile'; return ''; }
    return `<div class="bento"><section class="b s6 hero"><div class="label">Регистрация</div><h1 style="font-size:clamp(30px,3.6vw,44px)">Ваша работа заслуживает читателей</h1>
      <p class="lead">Почта не нужна: хватит ника и пароля. Все права на работы остаются у вас.</p></section>
      <section class="b s6"><div class="field"><label for="nk">Ник</label><input id="nk" autocomplete="username" maxlength="24" placeholder="например, mila_writes"><div class="hint">Латиница, цифры, точка, дефис, подчёркивание, 3–24 символа. Ник увидят все читатели, и по нему вы будете входить.</div></div>
      <div class="field"><label for="pw">Пароль</label><input id="pw" type="password" autocomplete="new-password" placeholder="не меньше 8 символов"><div class="hint">Запомните или сохраните пароль: восстановить его по почте нельзя.</div></div>
      <div class="field"><label for="un">Вуз</label><select id="un">${options(UNIS)}</select></div>
      <label class="check"><input id="ag" type="checkbox"><span>Я принимаю <a href="#terms" style="text-decoration:underline">Пользовательское соглашение</a>: права на работы остаются у авторов, плата не взимается</span></label>
      <div class="err" id="er"></div><button class="btn p" id="go" onclick="A.reg()">Создать аккаунт</button>
      <p class="hint" style="margin-top:14px">Уже есть аккаунт? <a href="#login" style="text-decoration:underline">Войти</a></p></section></div>`;
  };

  V.login = async () => {
    if (S.me) { location.hash = 'profile'; return ''; }
    return `<div class="form-wrap"><h1 class="page-title">Вход</h1><div class="b">
      <div class="field"><label for="lm">Ник</label><input id="lm" autocomplete="username"></div>
      <div class="field"><label for="lp">Пароль</label><input id="lp" type="password" autocomplete="current-password"></div>
      <div class="err" id="er"></div><button class="btn p" onclick="A.login()">Войти</button>
      <p class="hint" style="margin-top:14px">Нет аккаунта? <a href="#register" style="text-decoration:underline">Зарегистрироваться</a></p>
      ${isDemo() ? '<p class="hint">Демо-аккаунты: mila_writes или redaktor, пароль demo1234</p>' : ''}</div></div>`;
  };

  V.profile = async () => {
    if (!S.me) { location.hash = 'login'; return ''; }
    const ws = await DB.listWorks({ authorId: S.me.id });
    const views = ws.reduce((a, w) => a + (w.views || 0), 0);
    const reacts = ws.reduce((a, w) => a + w.counts.like + w.counts.hit + w.counts.more, 0);
    const soc = S.me.socials || {};
    return `<div class="bento">
      <section class="b ink s4"><div class="row" style="margin-bottom:22px"><span class="avatar" style="width:64px;height:64px;font-size:30px;background:var(--paper);color:var(--ink)">${esc(S.me.nick[0].toUpperCase())}</span>
        <div><div style="font:26px Lora,serif">${esc(S.me.nick)}</div><div style="opacity:.7">${esc(S.me.uni || '')}</div></div></div>
        <div class="stats"><div><div class="stat">${views}</div><span>просмотров</span></div><div><div class="stat">${reacts}</div><span>реакций</span></div><div><div class="stat">${ws.length}</div><span>работ</span></div></div></section>
      <section class="b s8"><div class="label">О себе и ссылки</div>
        <div class="field"><label for="bio">О себе</label><textarea id="bio" rows="2" maxlength="300">${esc(S.me.bio || '')}</textarea></div>
        <div class="row" style="align-items:flex-start;margin-bottom:16px">
          <div style="flex:1;min-width:140px"><label for="un">Вуз</label><select id="un">${options(UNIS, S.me.uni, 'Не выбран')}</select></div>
          <div style="flex:1;min-width:140px"><label for="vk">VK</label><input id="vk" value="${esc(soc.vk || '')}" placeholder="vk.com/..."></div>
          <div style="flex:1;min-width:140px"><label for="tg">Telegram</label><input id="tg" value="${esc(soc.telegram || '')}" placeholder="@ник"></div>
          <div style="flex:1;min-width:140px"><label for="bh">Behance</label><input id="bh" value="${esc(soc.behance || '')}" placeholder="behance.net/..."></div></div>
        <button class="btn" onclick="A.saveProfile()">Сохранить профиль</button></section>
      <section class="b s12"><div class="row" style="justify-content:space-between;margin-bottom:6px"><div class="label" style="margin:0">Мои работы</div><a class="btn p sm" href="#publish" onclick="S_edit(null)">Опубликовать новую</a></div>
        ${ws.length ? ws.map((w) => `<div class="list-row"><a class="t" href="#work-${esc(w.id)}">${esc(w.title)}</a>
          <div class="row"><span class="badge ${STATUS[w.status][1]}">${STATUS[w.status][0]}</span>${w.status === 'fix' ? `<button class="btn sm" onclick="A.edit('${esc(w.id)}')">Исправить</button>` : ''}</div>
          ${w.editor_note ? `<div class="note">Редактор: ${esc(w.editor_note)}</div>` : ''}</div>`).join('') : '<div class="empty" style="padding:20px 0"><b>Здесь появятся ваши работы</b>Отправьте первую, и редактор её прочитает.</div>'}</section></div>`;
  };

  V.publish = async () => {
    if (!S.me) { toast('Сначала войдите или зарегистрируйтесь'); location.hash = 'register'; return ''; }
    const w = S.editId ? await DB.getWork(S.editId) : null;
    return `<h1 class="page-title">${w ? 'Правки к работе' : 'Новая работа'}</h1><div class="bento">
      <section class="b s7"><div class="field"><label for="pt">Название</label><input id="pt" maxlength="140" value="${esc(w ? w.title : '')}" placeholder="Как называется работа"></div>
        <div class="row" style="align-items:flex-start;margin-bottom:16px"><div style="flex:1;min-width:150px"><label for="pf">Форма</label><select id="pf">${options(FORMS, w && w.form)}</select></div>
        <div style="flex:1;min-width:150px"><label for="pu">Вуз</label><select id="pu">${options(UNIS, (w && w.uni) || S.me.uni)}</select></div></div>
        <div class="field"><label for="pb">Текст работы</label><textarea id="pb" rows="10" placeholder="Вставьте текст. Для иллюстрации, фото или музыки напишите подпись или ссылку.">${esc(w ? w.body : '')}</textarea></div>
        <div class="field"><label for="pd">Описание к работе</label><textarea id="pd" rows="3" maxlength="1000" placeholder="Пара слов о том, как она появилась">${esc(w ? w.description : '')}</textarea></div>
        <div class="field"><label for="cv">Обложка</label><input id="cv" type="file" accept="image/jpeg,image/png,image/webp"><div class="hint">JPG, PNG или WebP до 2 МБ. Без обложки подставим рисунок по умолчанию.</div></div>
        <label class="check"><input id="pa" type="checkbox"><span>Подтверждаю, что я автор этой работы и имею право её публиковать</span></label>
        <div class="err" id="er"></div><button class="btn p" id="go" onclick="A.submit()">Отправить на модерацию</button></section>
      <aside class="b ink s5"><div class="label">Что дальше</div><h2 style="font-size:26px;margin-bottom:12px">Редактор прочитает работу</h2>
        <p>Мы отвечаем в течение трёх рабочих дней. Работа будет опубликована, возвращена с комментарием или отклонена.</p>
        <p>Статус всегда виден в вашем кабинете. После публикации работу увидят читатели каталога.</p></aside></div>`;
  };

  V.mod = async () => {
    if (!isEditor()) {
      return `<div class="form-wrap"><h1 class="page-title">Редакция</h1><div class="b"><p>Этот раздел доступен только редакторам журнала.</p>
        ${isDemo() ? '<button class="btn p" onclick="A.demoEditor()">Войти редактором (демо)</button>' : '<p class="hint">Роль редактора выдаёт администратор проекта.</p>'}</div></div>`;
    }
    const queue = await DB.listWorks({ status: 'review' });
    S.reports = await DB.listReports();
    const tabs = [['queue', `Работы на проверке: ${queue.length}`], ['reports', `Жалобы: ${S.reports.length}`]]
      .map(([k, t]) => `<button class="chip${S.tab === k ? ' on' : ''}" onclick="A.tab('${k}')">${t}</button>`).join('');
    let body;
    if (S.tab === 'queue') {
      body = queue.length ? queue.map((w) => `<section class="b review s12"><div class="meta">${esc(w.form)}, ${esc(w.uni || '')}</div>
        <div style="font:26px Lora,serif">${esc(w.title)}</div><div class="meta">${esc(w.author.nick || '')}</div>
        <div class="body">${esc(w.body.slice(0, 1200))}</div>${w.description ? `<div class="meta">Описание автора: ${esc(w.description)}</div>` : ''}
        <div style="margin:14px 0"><label class="radio"><input type="checkbox">Соответствует правилам</label><label class="radio"><input type="checkbox">Нет плагиата</label><label class="radio"><input type="checkbox">Нет оскорблений и запрещённого контента</label></div>
        <textarea id="nt-${esc(w.id)}" rows="2" placeholder="Комментарий автору (обязателен при возврате и отклонении)"></textarea>
        <div class="row" style="margin-top:12px"><button class="btn p" onclick="A.modAct('${esc(w.id)}','published')">Опубликовать</button><button class="btn" onclick="A.modAct('${esc(w.id)}','fix')">Вернуть на доработку</button><button class="btn" onclick="A.modAct('${esc(w.id)}','rejected')">Отклонить</button></div></section>`).join('')
        : empty('Очередь пуста', 'Все присланные работы проверены.');
    } else {
      body = S.reports.length ? S.reports.map((r, i) => `<section class="b review s12"><div class="badge acc" style="display:inline-block">${esc(r.reason)}</div>
        <div style="font:20px Lora,serif;margin-top:8px">${r.target_type === 'work' ? 'Работа' : 'Комментарий'}: ${esc(r.label)}</div>
        <div class="meta">Жалоба от ${esc((r.reporter || {}).nick || '')}${r.note ? `, «${esc(r.note)}»` : ''}</div>
        <div class="row" style="margin-top:14px"><button class="btn p" onclick="A.repAct(${i},true)">${r.target_type === 'work' ? 'Снять с публикации' : 'Скрыть комментарий'}</button><button class="btn" onclick="A.repAct(${i},false)">Отклонить жалобу</button></div></section>`).join('')
        : empty('Новых жалоб нет', 'Когда читатели пожалуются на работу или комментарий, они появятся здесь.');
    }
    return `<h1 class="page-title">Модерация</h1><div class="row" style="margin-bottom:20px">${tabs}</div><div class="bento">${body}</div>`;
  };

  V.about = async () => `<div class="article legal"><h1 class="page-title">О проекте</h1>
    <p>«Черновик» — веб-журнал студентов вузов Новосибирска. Мы помогаем найти аудиторию тем, кто пишет, рисует, снимает и сочиняет, но не знает, где это показать.</p>
    <p>Каждую работу читает редактор, поэтому здесь нет шума и спама. Читать можно без регистрации, публиковаться и комментировать могут зарегистрированные участники.</p></div>`;

  const TERMS = [
    ['Общие положения', 'Настоящее Соглашение регулирует использование веб-журнала «Черновик» (далее — «Сайт»). Регистрируясь или публикуя работы, вы подтверждаете, что прочитали Соглашение и согласны с ним. Читать опубликованные работы можно без регистрации.'],
    ['Регистрация и аккаунт', 'Для регистрации нужны придуманные вами ник и пароль и вуз, в котором вы учитесь. Почту, телефон и настоящее имя мы не запрашиваем. Вы отвечаете за сохранность пароля и за действия под вашим аккаунтом. Восстановить пароль самостоятельно нельзя, при потере напишите в редакцию. Один человек — один аккаунт. Ник не должен нарушать права других людей и вводить в заблуждение.'],
    ['Права на работы', 'Все авторские права на опубликованные работы остаются у их авторов. Публикуя работу, вы даёте Сайту неисключительное право безвозмездно показывать её на платформе, в выпусках журнала и в анонсах Сайта на весь срок публикации. Вы вправе удалить работу в любой момент и публиковать её на других площадках. Сайт не продаёт и не передаёт работы третьим лицам.'],
    ['Требования к работам', 'Вы подтверждаете, что являетесь автором работы или имеете право на её публикацию. Нельзя публиковать плагиат, оскорбления, призывы к насилию и ненависти, материалы 18+, чужие персональные данные, рекламу и спам. Если в работе использованы чужие изображения, музыка или цитаты, нужно указать источник.'],
    ['Модерация', 'Каждая работа проходит проверку редакции до публикации. Редактор может опубликовать работу, вернуть её на доработку с комментарием или отклонить с объяснением причины. Мы стараемся отвечать в течение 3 рабочих дней. Статус работы виден в личном кабинете.'],
    ['Комментарии и реакции', 'Комментировать и оставлять реакции могут только зарегистрированные пользователи. Анонимные комментарии не допускаются. Комментарии проходят автоматическую проверку, а редакция вправе скрыть комментарий, нарушающий правила уважительного общения.'],
    ['Жалобы', 'Любую работу или комментарий можно отправить на проверку, выбрав причину жалобы. Редакция рассматривает жалобы и может скрыть материал, снять работу с публикации или отклонить жалобу. Заведомо ложные жалобы считаются нарушением Соглашения.'],
    ['Персональные данные', 'Мы храним только данные, необходимые для работы Сайта: ник, пароль (в зашифрованном виде), вуз, добавленные вами ссылки и ваши работы. Не указывайте в профиле и в работах лишние сведения о себе: всё, что вы опубликовали, увидят другие читатели. Вы можете запросить удаление аккаунта и всех данных, написав в редакцию.'],
    ['Бесплатность', 'Сайт не взимает плату ни с авторов, ни с читателей и не размещает платную рекламу внутри работ.'],
    ['Ответственность и санкции', 'За нарушения редакция вправе предупредить автора, скрыть материал или заблокировать аккаунт. Редакция не отвечает за мнения авторов, но вправе удалить материалы, нарушающие Соглашение.'],
    ['Изменение Соглашения', 'Мы можем обновлять Соглашение. О существенных изменениях сообщим на почту и на Сайте. Продолжая пользоваться Сайтом, вы соглашаетесь с новой редакцией.'],
  ];
  V.terms = async () => `<div class="article legal"><div class="meta">Редакция от ноября 2026</div><h1 class="page-title">Пользовательское соглашение</h1>
    ${TERMS.map((t, i) => `<h2>${i + 1}. ${t[0]}</h2><p>${t[1]}</p>`).join('')}
    <p class="meta">Текст ознакомительный. Перед запуском его должен проверить юрист.</p></div>`;

  /* ---------- Действия ---------- */
  window.S_edit = (id) => { S.editId = id; };
  A.go = go;
  A.setForm = (f) => { S.form = f; render(); };
  A.setUni = (u) => { S.uni = u; render(); };
  A.byUni = (u) => { S.uni = u; S.form = ''; go('catalog'); };
  A.tab = (t) => { S.tab = t; render(); };

  A.reg = async () => {
    const er = $('#er'), nick = val('nk'), pw = $('#pw').value, uni = val('un');
    const bad = !/^[A-Za-z0-9][A-Za-z0-9._-]{1,22}[A-Za-z0-9]$/.test(nick) ? 'Ник: 3–24 символа, латиница, цифры, точка, дефис или подчёркивание, без них по краям'
      : pw.length < 8 ? 'Пароль: минимум 8 символов'
      : !$('#ag').checked ? 'Нужно принять Пользовательское соглашение' : '';
    if (bad) { er.textContent = bad; return; }
    $('#go').disabled = true;
    try {
      const r = await DB.signUp({ nick, password: pw, uni });
      S.me = r.user; toast('Добро пожаловать, @' + nick); go('profile');
    } catch (e) { er.textContent = e.message; $('#go').disabled = false; }
  };
  A.login = async () => {
    try { S.me = await DB.signIn({ nick: val('lm'), password: $('#lp').value }); toast('Вы вошли'); go('profile'); }
    catch (e) { $('#er').textContent = e.message; }
  };
  A.demoEditor = async () => { S.me = await DB.demoEditor(); toast('Вы вошли как редактор'); render(); };
  A.logout = async () => { await DB.signOut(); S.me = null; toast('Вы вышли'); go('home'); };
  A.saveProfile = async () => {
    const patch = { bio: val('bio'), uni: val('un') || null, socials: { vk: val('vk'), telegram: val('tg'), behance: val('bh') } };
    try { await DB.updateProfile(S.me.id, patch); Object.assign(S.me, patch); toast('Профиль сохранён'); render(); } catch (e) { fail(e); }
  };
  A.edit = (id) => { S.editId = id; go('publish'); };
  A.submit = async () => {
    const er = $('#er'), title = val('pt'), body = val('pb');
    const file = $('#cv').files[0];
    const bad = !title ? 'Добавьте название' : !body ? 'Добавьте текст или подпись к работе'
      : file && file.size > 2 * 1024 * 1024 ? 'Обложка больше 2 МБ'
      : !$('#pa').checked ? 'Подтвердите авторство' : '';
    if (bad) { er.textContent = bad; return; }
    $('#go').disabled = true;
    try {
      await DB.saveWork({ id: S.editId, title, form: val('pf'), uni: val('pu') || null, body, description: val('pd') }, file, S.me.id);
      S.editId = null; toast('Отправлено на модерацию'); go('profile');
    } catch (e) { er.textContent = e.message; $('#go').disabled = false; }
  };

  A.react = async (id, kind) => {
    if (!S.me) return toast('Войдите, чтобы оставить реакцию');
    try {
      const r = await DB.reactions(id, S.me.id);
      await DB.toggleReaction(id, kind, S.me.id, r.mine.includes(kind));
      render();
    } catch (e) { fail(e); }
  };
  A.comment = async (id) => {
    const t = val('ci');
    if (!S.me) return toast('Войдите, чтобы комментировать');
    if (!t) return;
    if (BAD_WORDS.test(t)) return toast('Комментарий не прошёл автопроверку. Переформулируйте, пожалуйста');
    try { await DB.addComment(id, t, S.me.id); render(); } catch (e) { fail(e); }
  };

  A.report = (type, id) => {
    if (!S.me) return toast('Войдите, чтобы пожаловаться');
    S.rp = { type, id };
    $('#modal').innerHTML = `<div class="ov" onclick="if(event.target===this)A.close()"><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="rt"><h2 id="rt">Причина жалобы</h2>
      ${REASONS.map((r, i) => `<label class="radio"><input type="radio" name="rs" value="${esc(r[0])}"${i ? '' : ' checked'}><span><b>${esc(r[0])}</b><small>${esc(r[1])}</small></span></label>`).join('')}
      <div class="field"><label for="rn">Комментарий (необязательно)</label><textarea id="rn" rows="2"></textarea></div>
      <div class="row"><button class="btn p" onclick="A.sendReport()">Отправить редактору</button><button class="btn" onclick="A.close()">Отмена</button></div></div></div>`;
  };
  A.close = () => { $('#modal').innerHTML = ''; };
  A.sendReport = async () => {
    const reason = document.querySelector('input[name=rs]:checked').value;
    try { await DB.report({ ...S.rp, reason, note: val('rn') }, S.me.id); A.close(); toast('Жалоба отправлена редактору'); } catch (e) { fail(e); }
  };

  A.modAct = async (id, status) => {
    const note = val('nt-' + id);
    if (status !== 'published' && !note) return toast('Напишите комментарий автору');
    try { await DB.setStatus(id, status, note); toast({ published: 'Опубликовано', fix: 'Возвращено на доработку', rejected: 'Отклонено' }[status]); render(); } catch (e) { fail(e); }
  };
  A.repAct = async (i, hide) => {
    try { await DB.resolveReport(S.reports[i], hide); toast(hide ? 'Материал скрыт' : 'Жалоба отклонена'); render(); } catch (e) { fail(e); }
  };

  /* ---------- Роутер ---------- */
  async function render() {
    const h = location.hash.slice(1) || 'home';
    let name = h, arg = null;
    if (h.startsWith('work-')) { name = 'work'; arg = h.slice(5); }
    if (!V[name]) name = 'home';
    if (name !== 'publish' && S.editId && name !== 'profile') S.editId = null;
    const t = ++S.tok;
    try {
      const html = await V[name](arg);
      if (t !== S.tok) return;
      $('#app').innerHTML = shell(name, html);
    } catch (e) {
      if (t !== S.tok) return;
      $('#app').innerHTML = shell(name, `<div class="b empty"><b>Не получилось загрузить страницу</b>${esc(e.message)}</div>`);
    }
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', render);
  DB.init().then((me) => { S.me = me; render(); }).catch((e) => { $('#app').textContent = 'Ошибка запуска: ' + e.message; });
})();
