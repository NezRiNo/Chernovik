/* Черновик: интерфейс. Вся работа с данными идёт через window.DB (см. data.js). */
(function () {
  'use strict';

  const FORMS = ['Проза', 'Стихи', 'Иллюстрация', 'Фото', 'Музыка', 'Рукоделие'];
  const UNIS = ['НГУ', 'НГТУ (НЭТИ)', 'НГПУ', 'НГМУ', 'НГАУ', 'НГАСУ (Сибстрин)', 'НГУЭУ (НИНХ)', 'НГУАДИ', 'СибГУТИ', 'СГУПС', 'СГУГиТ', 'СГУВТ', 'СГУИиБ', 'СибУПК', 'СИУ РАНХиГС', 'НГТИ', 'НГК им. Глинки', 'НТИ (филиал РГУ им. Косыгина)', 'НЮИ (филиал ТГУ)'];
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

  const $ = (s) => document.querySelector(s);
  const safeCount = (value) => { const n = Number(value); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0; };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const S = { me: null, form: '', homeForm: '', uni: '', tag: '', tab: 'queue', manageTab: 'queue', editId: null, seen: {}, tok: 0, reports: [], rp: null, teamQuery: '', teamRole: '' };
  const SITE_DEFAULTS = { site_name: 'Черновик', tagline: 'Веб-журнал студентов Новосибирска', home_label: 'Веб-журнал студентов Новосибирска', home_heading: 'Идеи заслуживают быть увиденными.', home_lead: '«Черновик» — место, где можно поделиться творчеством и найти первых читателей.', theme_title: 'Тема месяца', theme_description: 'Публикуйте то, что хочется показать читателям.', theme_deadline: '', announcement_title: '', announcement_body: '', about_text: '«Черновик» — веб-журнал студентов вузов Новосибирска.', accent_color: '#e5482d', site_theme: 'system' };
  const A = (window.A = {});
  const canReview = () => !!(S.me && ['reviewer', 'admin', 'editor'].includes(S.me.role));
  const isAdmin = () => !!(S.me && S.me.role === 'admin');
  const canDeleteWork = (w) => !!(S.me && w && (S.me.id === w.author_id || isAdmin()));
  const roleLabel = (role) => ({ author: 'Автор', reviewer: 'Редактор', editor: 'Редактор', admin: 'Администратор' }[role] || 'Автор');
  const isDemo = () => DB.mode === 'demo';

  const CFG = window.APP_CONFIG || {};
  const ph = (v, hint) => (v ? esc(v) : `<mark>[${hint}]</mark>`);

  const ICONS = {
    home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1-4 4-6 8-6s7 2 8 6"/>',
    shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
    spark: '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>',
    pen: '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
    back: '<path d="M15 6l-6 6 6 6"/>',
    eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.5"/>',
    message: '<path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.8 8.8 0 0 1-3.4-.7L4 20l1.5-3.6A7 7 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5z"/>',
    audio: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    play: '<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M7 5h4v14H7zM15 5h4v14h-4z" fill="currentColor" stroke="none"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
    moon: '<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>',
  };
  const ic = (n, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;
  const activeTheme = () => document.documentElement.getAttribute('data-theme') || ((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light');
  const updateThemeButton = () => {
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    const dark = activeTheme() === 'dark';
    button.innerHTML = ic(dark ? 'sun' : 'moon');
    button.setAttribute('aria-label', dark ? 'Включить светлую тему' : 'Включить тёмную тему');
    button.title = dark ? 'Светлая тема' : 'Тёмная тема';
  };

  // Готовые аватары вместо загрузки фотографий: фото человека это его персональные данные, а рисунок из набора нет.
  const AV = [
    ['#e5482d', '<circle cx="32" cy="32" r="11"/><g fill="none" stroke="#f6f3ec" stroke-width="3" stroke-linecap="round"><path d="M32 9v6M32 49v6M9 32h6M49 32h6M16 16l4 4M44 44l4 4M48 16l-4 4M20 44l-4 4"/></g>'],
    ['#7a8f6a', '<path d="M14 48C12 26 26 14 50 14c0 24-12 36-32 34 4-9 10-15 18-19-10 3-17 9-22 19z"/>'],
    ['#d9a441', '<path d="M40 12a21 21 0 1 0 12 34 17 17 0 0 1-12-34z"/><circle cx="48" cy="20" r="2.6"/>'],
    ['#5b7186', '<g fill="none" stroke="#f6f3ec" stroke-width="4"><circle cx="20" cy="34" r="9"/><circle cx="44" cy="34" r="9"/><path d="M29 33c2-2 4-2 6 0"/></g>'],
    ['#1d1c19', '<path d="M10 20c9-3 16-2 22 3v27c-6-5-13-6-22-3zM54 20c-9-3-16-2-22 3v27c6-5 13-6 22-3z"/>'],
    ['#b9856a', '<path d="M50 12C31 12 17 25 17 43l-5 9 9-5c18 0 29-15 29-35z"/><path d="M20 44l16-16" fill="none" stroke="#b9856a" stroke-width="2.6" stroke-linecap="round"/>'],
    ['#8a6f9e', '<path d="M14 50V18l11 8h14l11-8v32z"/><circle cx="25" cy="38" r="3" fill="#8a6f9e"/><circle cx="39" cy="38" r="3" fill="#8a6f9e"/>'],
    ['#3f7d73', '<path d="M32 10l6.5 13.5 14.5 2-10.5 10.3 2.6 14.7L32 43.6 18.9 50.5l2.6-14.7L11 25.5l14.5-2z"/>'],
  ];
  const AV_NAMES = ['Солнце', 'Лист', 'Луна', 'Очки', 'Книга', 'Перо', 'Кот', 'Звезда'];
  const defAv = (nick) => 'a' + ((String(nick || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length) + 1);
  const avIndex = (k) => { const n = parseInt(String(k || '').slice(1), 10); return n >= 1 && n <= AV.length ? n - 1 : 0; };
  function avatar(key, size = 40) {
    const [bg, art] = AV[avIndex(key)];
    return `<span class="avatar" style="width:${size}px;height:${size}px"><svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="${bg}"/><g fill="#f6f3ec">${art}</g></svg></span>`;
  }
  const avOf = (u) => (u && u.avatar) || defAv(u && u.nick);
  const avPicker = (cur) => `<div class="avpick" role="radiogroup" aria-label="Аватар">${AV.map((_, i) => `<label title="${AV_NAMES[i]}"><input type="radio" name="av" value="a${i + 1}"${avIndex(cur) === i ? ' checked' : ''}>${avatar('a' + (i + 1), 56)}</label>`).join('')}</div>`;
  const pickedAv = () => (document.querySelector('input[name=av]:checked') || {}).value || 'a1';

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
  const paragraphs = (t) => String(t || '').split(/\n{2,}/).map((part) => {
    const p = esc(part).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/_(.+?)_/g, '<em>$1</em>');
    if (/^## .+/.test(p)) return `<h2>${p.slice(3)}</h2>`;
    if (/^&gt; /.test(p)) return `<blockquote>${p.slice(5)}</blockquote>`;
    if (/^(?:[-*] .+(?:\n|$))+/.test(p)) return `<ul>${p.split('\n').filter(Boolean).map((line) => `<li>${line.slice(2)}</li>`).join('')}</ul>`;
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');
  const safeUrl = (u) => (typeof u === 'string' && (u.startsWith('https:') || u.startsWith('data:image/') || u.startsWith('data:audio/')) ? u : null);

  /* ---------- Иллюстрации-заглушки ---------- */
  function cover(w) {
    const u = safeUrl(w.cover_url);
    return u ? `<span class="cover"><img src="${esc(u)}" alt="" loading="lazy"></span>` : '';
  }

  const workMedia = (w) => {
    const items = Array.isArray(w.attachments) ? w.attachments : [];
    const images = items.filter((x) => x.type === 'image' && safeUrl(x.url));
    const audio = items.find((x) => x.type === 'audio' && safeUrl(x.url));
    if (!images.length && w.cover_url && safeUrl(w.cover_url)) images.push({ url: w.cover_url, name: 'Обложка' });
    const gallery = images.length ? `<div class="work-gallery" aria-label="Изображения работы">${images.map((x,i) => `<a class="gallery-image" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer"><img src="${esc(x.url)}" alt="${esc(x.name || ('Изображение ' + (i + 1)))}" loading="lazy"></a>`).join('')}</div>` : '';
    const player = audio ? `<div class="work-audio"><div class="audio-label">♫ ${esc(audio.name || 'Аудиозапись')}</div><audio controls preload="metadata" src="${esc(audio.url)}">Ваш браузер не поддерживает аудио.</audio></div>` : '';
    return gallery + player;
  };

  /* ---------- Общие куски разметки ---------- */
  const tagsOf = (tags = []) => (Array.isArray(tags) ? tags : []).slice(0, 5).map((t) => `<span class="chip tag">${esc(t)}</span>`).join('');
  const CARD_ICONS = { 'Проза': 'pen', 'Стихи': 'spark', 'Иллюстрация': 'grid', 'Фото': 'eye', 'Музыка': 'audio', 'Рукоделие': 'spark' };
  const card = (w) => {
    const hasCover = !!safeUrl(w.cover_url);
    const mark = `<span class="work-mark" aria-hidden="true">${ic(CARD_ICONS[w.form] || 'pen')}</span>`;
    return `<a class="b tight work s4${hasCover ? '' : ' no-cover'}" href="#work-${esc(w.id)}">${hasCover ? cover(w) : mark}<span class="txt">
      <span class="meta">${esc(w.form)}</span><h3>${esc(w.title)}</h3>
      ${w.tags && w.tags.length ? `<span class="tags">${tagsOf(w.tags)}</span>` : ''}
      <span class="meta">Автор: ${esc(w.author.nick || '')}, ${esc(w.uni || 'вуз не указан')}</span>
      <span class="rx"><span title="Просмотры">${ic('eye', 'sm')}${safeCount(w.views)}</span><span title="Комментарии">${ic('message', 'sm')}${safeCount(w.comment_count)}</span><span title="Реакции">${ic('heart', 'sm')}${safeCount(w.counts && w.counts.like)}</span></span></span></a>`;
  };
  const empty = (title, text, btn, span = 's12') => `<div class="b empty ${span}"><b>${title}</b><p>${text}</p>${btn ? `<div style="margin-top:18px">${btn}</div>` : ''}</div>`;
  const options = (list, cur, first) => (first ? `<option value="">${first}</option>` : '') + list.map((x) => `<option${x === cur ? ' selected' : ''}>${esc(x)}</option>`).join('');

  function footer() {
    return `<footer class="foot"><p>Все права на работы принадлежат авторам. Сайт бесплатный для авторов и читателей.</p>
      <nav aria-label="Документы"><a href="#terms">Пользовательское соглашение</a><a href="#privacy">Политика обработки данных</a><a href="#consent">Согласие на обработку данных</a><a href="#about">О проекте</a></nav></footer>`;
  }

  function shell(active, html) {
    const base = [['home', 'Главная', 'home'], ['catalog', 'Журнал', 'grid'], ['publish', 'Создать', 'plus']];
    const cur = ['work'].includes(active) ? 'catalog' : (['mod','admin','settings'].includes(active) ? 'manage' : active);
    const me = S.me
      ? `<a class="account-avatar" href="#profile" aria-label="Личный кабинет" title="Личный кабинет">${avatar(avOf(S.me), 38)}</a>`
      : '<a class="btn sm" href="#login">Войти</a>';
    const manage = (canReview() || isDemo()) ? '<a class="manage-link" href="#manage" aria-label="Управление проектом" title="Управление проектом">'+ic('shield')+'</a>' : '';
    return `<div class="shell reference-shell">
      <main class="main">
        <header class="topbar reference-topbar">
          <a class="brand reference-brand" href="#home"><img class="brand-mark" src="favicon.svg" alt="" width="26" height="26"><span>${esc((S.site || {}).site_name || "Черновик")}<small>✦</small></span></a>
          <nav class="reference-nav" aria-label="Основное меню">${base.map(([k,t]) => k === 'publish' ? '' : `<a href="#${k}"${k === cur ? ' class="on" aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
          <div class="topbar-actions">
            <a class="reference-create" href="#publish">${ic('pen')}<span>Создать</span></a>
            <button class="theme-toggle" id="theme-toggle" type="button" onclick="A.toggleTheme()" aria-label="Переключить тему" title="Переключить тему">${ic(activeTheme() === "dark" ? "sun" : "moon")}</button>
            ${manage}${me}
          </div>
        </header>
        <div class="page">${html}</div>
        ${footer()}
      </main>
      <nav class="tabbar" aria-label="Быстрая навигация">${base.map(([k,t,i]) => `<a href="#${k}" class="${k === cur ? 'on' : ''}${k === 'publish' ? ' plus' : ''}">${ic(i)}<span>${k === 'publish' ? 'Создать' : t}</span></a>`).join('')}<a href="${S.me ? '#profile' : '#login'}" class="${cur === 'profile' ? 'on' : ''}">${S.me ? avatar(avOf(S.me),24) : ic('user')}<span>Кабинет</span></a></nav>
    </div>`;
  }

  /* ---------- Страницы ---------- */
  const V = {};

  V.home = async () => {
    const all = await DB.listWorks({ status: 'published', limit: 14 });
    const ws = S.homeForm ? all.filter((w) => w.form === S.homeForm) : all;
    const featured = ws.find((w) => w.form !== 'Музыка' && safeUrl(w.cover_url)) || ws.find((w) => w.form !== 'Музыка') || ws[0];
    const items = ws.filter((w) => !featured || w.id !== featured.id).slice(0, 4);
    const authors = [...new Map(all.filter((w) => w.author && w.author.id !== (S.me && S.me.id)).map((w) => [w.author.id, w.author])).values()].slice(0, 3);
    const followStates = await Promise.all(authors.map((author) => DB.followInfo(author.id, S.me && S.me.id).catch(() => ({ following: false }))));
    const announcement = (S.site || {}).announcement_title || (S.site || {}).announcement_body
      ? `<section class="home-announcement"><span class="eyebrow">Объявление</span>${S.site.announcement_title ? `<h2>${esc(S.site.announcement_title)}</h2>` : ''}${S.site.announcement_body ? `<p>${esc(S.site.announcement_body)}</p>` : ''}</section>` : '';
    const cardAudio = (audio, title) => '<div class="discover-card-audio"><button class="discover-audio-play" type="button" onclick="A.toggleCardAudio(this)" aria-label="Воспроизвести ' + esc(title) + '">' + ic('play') + '</button><div class="discover-audio-track"><span class="discover-audio-title">' + esc(audio.name || 'Аудиозапись') + '</span><div class="discover-audio-wave" role="slider" tabindex="0" aria-label="Перемотка аудио" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" onclick="A.seekCardAudio(event)" onkeydown="A.seekCardAudioKey(event)" title="Нажмите или используйте стрелки для перемотки">' + Array.from({length:30}, (_, i) => '<i style="--bar:' + (18 + ((i * 17 + 11) % 27)) + '%"></i>').join('') + '</div></div><time class="discover-audio-time">0:00</time><audio class="discover-audio-element" preload="metadata" src="' + esc(audio.url) + '" ontimeupdate="A.updateCardAudio(this)" onloadedmetadata="A.updateCardAudio(this)" onended="A.updateCardAudio(this)" aria-label="Слушать ' + esc(title) + '"></audio></div>';
    const postCard = (w, featuredCard = false) => {
      const image = safeUrl(w.cover_url);
      const audio = Array.isArray(w.attachments) ? w.attachments.find((x) => x.type === 'audio' && safeUrl(x.url)) : null;
      const icon = CARD_ICONS[w.form] || 'pen';
      const excerpt = (w.description || w.body || '').replace(/<[^>]*>/g, '').trim().slice(0, 115);
      return `<article class="discover-work${featuredCard ? ' discover-featured' : ''}${audio ? ' has-audio' : ''}">
        <a class="discover-card-link" href="#work-${esc(w.id)}">
          <span class="discover-image">${image ? `<img src="${esc(image)}" alt="" loading="lazy">` : ic(icon)}</span>
          <span class="discover-work-copy"><span class="discover-kind">${esc(w.form)}</span><strong>${esc(w.title)}</strong><span class="discover-author">${esc(w.author.nick || 'Автор')}</span>${featuredCard && excerpt ? `<span class="discover-excerpt">${esc(excerpt)}${excerpt.length >= 115 ? '…' : ''}</span>` : ''}<span class="discover-metrics">${ic('heart','sm')}<span class="discover-count">${safeCount(w.counts && w.counts.like)}</span><span class="discover-metric-separator" aria-hidden="true">·</span>${ic('message','sm')}<span class="discover-count">${safeCount(w.comment_count)}</span></span></span>
        </a>
        ${audio ? cardAudio(audio, w.title) : ''}
      </article>`;
    };
    const authorList = authors.length ? authors.map((author, i) => `<div class="discover-author-row">
      <a class="discover-author-person" href="#author-${esc(author.id)}">${avatar(avOf(author), 38)}<span><strong>${esc(author.nick || 'Автор')}</strong><small>${esc(author.uni || 'Автор Черновика')}</small></span></a>
      ${S.me && S.me.id === author.id ? '' : `<button class="btn sm discover-follow" onclick="A.toggleFollow('${esc(author.id)}')">${followStates[i].following ? 'Вы подписаны' : 'Подписаться'}</button>`}
    </div>`).join('') : '<p class="meta">Новые авторы скоро появятся здесь.</p>';
    return `<div class="home-page home-discover">
      ${announcement}
      <section class="discover-heading">
        <div><h1>Творчество<br>начинается здесь</h1><p>Публикуй свои работы. Находи вдохновение. Делись идеями.</p></div>
      </section>
      <div class="discover-layout">
        <main class="discover-main">
          ${featured ? `<section class="discover-featured-wrap"><div class="discover-section-head"><h2>${S.homeForm ? esc(S.homeForm) : 'Последняя работа'}</h2><a class="text-link" href="#catalog">Весь журнал ↗</a></div>${postCard(featured, true)}</section>` : `<div class="home-list-empty"><b>Пока нет публикаций в этой категории</b><p>Попробуйте другой фильтр или загляните в журнал позже.</p><button class="btn" onclick="A.homeFilter('')">Показать все работы</button></div>`}
          ${items.length ? `<section class="discover-grid-wrap"><div class="discover-section-head"><h2>Ещё можно открыть</h2><a class="text-link" href="#catalog">Все работы ↗</a></div><div class="discover-grid">${items.map((w) => postCard(w)).join('')}</div></section>` : ''}
        </main>
        <aside class="discover-aside">
          <section class="discover-authors"><div class="discover-section-head"><h2>${ic('spark')} Авторы недели</h2></div>${authorList}<a class="discover-all-authors" href="#catalog">Все авторы →</a></section>
          <section class="discover-invite"><span class="discover-spark">${ic('spark')}</span><h3>Подписывайтесь,<br>чтобы не пропустить<br>новые работы!</h3><a class="btn p" href="#catalog">Подписаться</a></section>
        </aside>
      </div>
    </div>`;
  };

  V.catalog = async () => {
    const all = await DB.listWorks({ status: 'published' });
    const ws = all.filter((w) => (!S.form || w.form === S.form) && (!S.uni || w.uni === S.uni) && (!S.tag || (w.tags || []).includes(S.tag)));
    const tags = [...new Set(all.flatMap((w) => w.tags || []))].sort((a, b) => a.localeCompare(b, 'ru'));
    const audioPlayer = (audio, title) => `<div class="discover-card-audio journal-audio">
      <button class="discover-audio-play" type="button" onclick="A.toggleCardAudio(this)" aria-label="Воспроизвести ${esc(title)}">${ic('play')}</button>
      <div class="discover-audio-track"><span class="discover-audio-title">${esc(audio.name || 'Аудиозапись')}</span>
        <div class="discover-audio-wave" role="slider" tabindex="0" aria-label="Перемотка аудио" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" onclick="A.seekCardAudio(event)" onkeydown="A.seekCardAudioKey(event)" title="Нажмите или используйте стрелки для перемотки">${Array.from({length:30}, (_, i) => `<i style="--bar:${18 + ((i * 17 + 11) % 27)}%"></i>`).join('')}</div>
      </div><time class="discover-audio-time">0:00</time>
      <audio class="discover-audio-element" preload="metadata" src="${esc(audio.url)}" ontimeupdate="A.updateCardAudio(this)" onloadedmetadata="A.updateCardAudio(this)" onended="A.updateCardAudio(this)" aria-label="Слушать ${esc(title)}"></audio>
    </div>`;
    const journalCard = (w) => {
      const audio = Array.isArray(w.attachments) ? w.attachments.find((x) => x.type === 'audio' && safeUrl(x.url)) : null;
      if (!audio) return `<div class="journal-item">${card(w)}</div>`;
      return `<div class="journal-item">
        <a class="b tight work no-cover journal-music-card" href="#work-${esc(w.id)}">
          <span class="work-mark" aria-hidden="true">${ic('audio')}</span>
          <span class="txt"><span class="meta">${esc(w.form || 'Музыка')}</span><h3>${esc(w.title)}</h3>
          <span class="meta">Автор: ${esc(w.author?.nick || 'Автор')}, ${esc(w.uni || 'вуз не указан')}</span>
          <span class="rx"><span title="Просмотры">${ic('eye','sm')}${safeCount(w.views)}</span><span title="Комментарии">${ic('message','sm')}${safeCount(w.comment_count)}</span><span title="Реакции">${ic('heart','sm')}${safeCount(w.counts && w.counts.like)}</span></span></span>
        </a>${audioPlayer(audio, w.title)}
      </div>`;
    };
    return `<h1 class="page-title">Журнал</h1>
      <p class="journal-intro">Публикации студентов: тексты, фотографии, иллюстрации и музыка.</p>
      <div class="row journal-filters" style="margin-bottom:12px;flex-wrap:wrap">${['', ...FORMS].map((f) => `<button class="chip${S.form === f ? ' on' : ''}" onclick="A.setForm('${esc(f)}')">${f || 'Все работы'}</button>`).join('')}
      <select style="width:auto;margin-left:auto" aria-label="Вуз" onchange="A.setUni(this.value)">${options(UNIS, S.uni, 'Любой вуз')}</select></div>
      ${tags.length ? `<div class="row journal-tags" style="margin-bottom:22px;flex-wrap:wrap"><span class="meta">Теги:</span><button class="chip${!S.tag ? ' on' : ''}" onclick="A.setTag('')">Все</button>${tags.map((t) => `<button class="chip${S.tag === t ? ' on' : ''}" onclick="A.setTag('${esc(t)}')">${esc(t)}</button>`).join('')}</div>` : ''}
      <div class="journal-count meta">${ws.length} ${ws.length === 1 ? 'работа' : ws.length > 1 && ws.length < 5 ? 'работы' : 'работ'}</div>
      <div class="bento journal-grid">${ws.length ? ws.map(journalCard).join('') : empty('Ничего не найдено', 'Измените фильтры или опубликуйте работу в этой категории.', '<a class="btn p" href="#publish">Опубликовать работу</a>')}</div>`;
  };

  V.work = async (id) => {
    const w = await DB.getWork(id);
    const allowed = w && (w.status === 'published' || (S.me && (S.me.id === w.author_id || canReview())));
    if (!allowed) return `<div class="b empty"><b>Работа не найдена</b>Возможно, она ещё на проверке или была удалена.<div style="margin-top:16px"><a class="btn" href="#catalog">В каталог</a></div></div>`;
    if (w.status === 'published' && !S.seen[id]) { S.seen[id] = 1; DB.incViews(id); }
    const [rx, cm, follow] = await Promise.all([DB.reactions(id, S.me && S.me.id), DB.listComments(id, S.me && S.me.id), DB.followInfo(w.author_id, S.me && S.me.id)]);
    const pubd = w.status === 'published';
    const likeCount = safeCount(rx.counts && rx.counts.like);
    const rb = `<button class="rb rb-like${rx.mine.includes('like') ? ' on' : ''}" aria-label="Нравится" title="Нравится" onclick="A.react('${esc(id)}','like')">${ic('heart', 'sm')}<span>${likeCount}</span></button>`;
    const followButton = S.me && S.me.id !== w.author_id
      ? `<button class="btn ${follow.following ? '' : 'p'} sm" onclick="A.toggleFollow('${esc(w.author_id)}')">${follow.following ? 'Вы подписаны' : 'Подписаться'}</button>`
      : !S.me ? '<a class="btn p sm" href="#login">Подписаться</a>' : '';
    const renderComment = (c, isReply = false) => {
      const children = isReply ? [] : cm.filter((item) => item.parent_id === c.id);
      return `<div class="comment${isReply ? ' comment-reply' : ''}">
        ${avatar(avOf(c.author), 32)}
        <div class="comment-main">
          <b>${esc((c.author || {}).nick || 'автор')}</b>
          <p>${esc(c.body)}</p>
          <div class="comment-tools">
            <button class="comment-like${c.liked_by_me ? ' on' : ''}" aria-label="Нравится" title="Нравится" onclick="A.commentLike('${esc(c.id)}',${!!c.liked_by_me})">${ic('heart', 'sm')}<span>${Number(c.like_count) || 0}</span></button>
            ${!isReply ? `<button class="linkbtn" onclick="A.toggleReply('${esc(c.id)}')">Ответить</button>` : ''}
            <button class="linkbtn" onclick="A.report('comment','${esc(c.id)}')">Пожаловаться</button>
          </div>
          ${!isReply ? `<form class="reply-form" id="reply-form-${esc(c.id)}" hidden onsubmit="event.preventDefault();A.reply('${esc(id)}','${esc(c.id)}')"><textarea id="reply-input-${esc(c.id)}" rows="2" maxlength="2000" required placeholder="Ваш ответ…"></textarea><div class="reply-actions"><span class="hint">До 2 000 символов</span><button class="btn p" type="submit" ${S.me ? '' : 'disabled'}>Ответить</button></div></form>` : ''}
          ${children.map((child) => renderComment(child, true)).join('')}
        </div>
      </div>`;
    };
    return `<article class="article"><a class="back" href="#catalog">${ic('back', 'sm')}Назад в каталог</a>
      ${pubd ? '' : `<p class="badge ${STATUS[w.status][1]}" style="display:inline-block">${STATUS[w.status][0]}</p>`}
      <div class="meta">${esc(w.form)}</div><h1 class="page-title" style="margin:4px 0 8px">${esc(w.title)}</h1>
      ${w.tags && w.tags.length ? `<div class="tags" style="margin-bottom:12px">${w.tags.map((t) => `<button class="chip tag" onclick="A.setTag('${esc(t)}');go('catalog')">${esc(t)}</button>`).join('')}</div>` : ''}
      <div class="byline"><a href="#author-${esc(w.author_id)}" class="author-link" aria-label="Профиль автора">${avatar(avOf(w.author), 36)}</a><div class="meta"><a class="author-link" href="#author-${esc(w.author_id)}">${esc(w.author.nick || '')}</a>, ${esc(w.uni || 'вуз не указан')}<br>${fmtDate(w.created_at)}${pubd ? ` · <button class="linkbtn" onclick="A.report('work','${esc(id)}')">Пожаловаться на работу</button>` : ''}</div>${pubd ? followButton : ''}${canDeleteWork(w) ? `<button class="btn sm danger" onclick="A.deleteWork('${esc(id)}')">Удалить работу</button>` : ''}</div>
      ${pubd ? `<div class="article-stats"><span>${ic('eye','sm')}${safeCount(w.views)} просмотров</span><span>${ic('message','sm')}${cm.length} комментариев</span></div>` : ''}
      ${workMedia(w) || cover(w)}
      ${w.description ? `<p class="meta" style="font-style:italic">${esc(w.description)}</p>` : ''}
      <div class="prose${w.form === 'Стихи' ? ' poem' : ''}">${paragraphs(w.body)}</div>
      ${pubd ? `<div class="reactions">${rb}</div>
      <h2 style="font-size:26px;margin-bottom:12px">Комментарии</h2>
      <form class="comment-form" onsubmit="event.preventDefault();A.comment('${esc(id)}')"><label class="sr-only" for="ci">Ваш комментарий</label><textarea id="ci" rows="3" maxlength="2000" required ${S.me ? '' : 'disabled'} placeholder="${S.me ? 'Поделитесь впечатлением или задайте вопрос…' : 'Войдите, чтобы комментировать'}"></textarea><div class="row comment-actions"><button type="button" class="emoji-toggle" onclick="A.toggleEmoji()" ${S.me ? '' : 'disabled'}>☺ Смайлики</button><div class="emoji-picker" id="emoji-picker" hidden>${['😀','🙂','😊','😍','🥹','😂','🤍','❤️','✨','👏','🔥','🌿','🌸','☀️','🎨','📚','🫶'].map((e) => '<button type="button" onclick="A.insertEmoji(\'' + e + '\')">' + e + '</button>').join('')}</div><span class="hint">До 2 000 символов</span><button class="btn p" type="submit" ${S.me ? '' : 'disabled'}>Отправить</button></div></form>
      ${cm.filter((c) => !c.parent_id).map((c) => renderComment(c)).join('')}` : ''}
    </article>`;
  };

  V.register = async () => {
    if (S.me) { location.hash = 'profile'; return ''; }
    return `<div class="bento"><section class="b s5 hero"><div class="label">Регистрация</div><h1 style="font-size:clamp(30px,3.4vw,44px)">Ваша работа заслуживает читателей</h1>
      <p class="lead">Почту, телефон и настоящее имя мы не просим: хватит ника и пароля. Все права на работы остаются у вас.</p></section>
      <section class="b s7"><div class="field"><label for="nk">Ник</label><input id="nk" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="24" placeholder="например, mila_writes"><div class="hint">Латиница, цифры, точка, дефис, подчёркивание, 3–24 символа. Ник увидят все читатели, и по нему вы будете входить. Не используйте настоящие имя и фамилию.</div></div>
      <div class="field"><label for="pw">Пароль</label><input id="pw" type="password" autocomplete="new-password" placeholder="не меньше 8 символов"><div class="hint">Сохраните пароль: восстановить его по почте нельзя.</div></div>
      <div class="field"><label for="un">Вуз</label><select id="un">${options(UNIS)}</select></div>
      <div class="field"><label>Аватар</label>${avPicker('a1')}<div class="hint">Вместо фотографий готовые аватары: так проще сохранить анонимность.</div></div>
      <label class="check"><input id="ag" type="checkbox"><span>Я принимаю <a href="#terms" target="_blank" rel="noopener">Пользовательское соглашение</a> и ознакомился с <a href="#privacy" target="_blank" rel="noopener">Политикой обработки данных</a></span></label>
      <label class="check"><input id="cs" type="checkbox"><span>Даю <a href="#consent" target="_blank" rel="noopener">согласие на обработку данных</a>, включая показ моего ника, вуза и аватара всем посетителям сайта. Мне есть 18 лет, либо у меня есть согласие родителей</span></label>
      <div class="err" id="er"></div><button class="btn p big" id="go" onclick="A.reg()" style="width:100%">Создать аккаунт</button>
      <p class="hint" style="margin-top:14px">Уже есть аккаунт? <a href="#login">Войти</a></p></section></div>`;
  };

  V.login = async () => {
    if (S.me) { location.hash = 'profile'; return ''; }
    return `<div class="form-wrap"><h1 class="page-title">Вход</h1><div class="b">
      <div class="field"><label for="lm">Ник</label><input id="lm" autocomplete="username"></div>
      <div class="field"><label for="lp">Пароль</label><input id="lp" type="password" autocomplete="current-password"></div>
      <div class="err" id="er"></div><button class="btn p" onclick="A.login()">Войти</button>
      <p class="hint" style="margin-top:14px">Нет аккаунта? <a href="#register" style="text-decoration:underline">Зарегистрироваться</a></p>
      ${isDemo() ? '<p class="hint">Демо-аккаунты: mila_writes, redaktor или admin_demo; пароль demo1234</p>' : ''}</div></div>`;
  };

  V.profile = async () => {
    if (!S.me) { location.hash = 'login'; return ''; }
    const ws = await DB.listWorks({ authorId: S.me.id });
    const views = ws.reduce((a, w) => a + (w.views || 0), 0);
    const reacts = ws.reduce((a, w) => a + (safeCount(w.counts && w.counts.like)), 0);
    const soc = S.me.socials || {};
    const following = await DB.listFollowing(S.me.id);
    return `<div class="bento">
      <section class="b ink s4" style="align-self:start"><div class="row" style="margin-bottom:22px">${avatar(avOf(S.me), 64)}
        <div style="min-width:0"><div style="font:26px/1.2 Lora,serif;word-break:break-word">${esc(S.me.nick)}</div><div style="opacity:.7">${esc(S.me.uni || '')}</div></div></div>
        <div class="stats"><div><div class="stat">${views}</div><span>просмотров</span></div><div><div class="stat">${reacts}</div><span>реакций</span></div><div><div class="stat">${ws.length}</div><span>работ</span></div></div></section>
      <section class="b s8"><div class="label">О себе и ссылки</div>
        <div class="field"><label>Аватар</label>${avPicker(avOf(S.me))}</div>
        <div class="field"><label for="bio">О себе</label><textarea id="bio" rows="2" maxlength="300">${esc(S.me.bio || '')}</textarea></div>
        <div class="grid2 two">
          <div class="field"><label for="un">Вуз</label><select id="un">${options(UNIS, S.me.uni, 'Не выбран')}</select></div>
          <div class="field"><label for="vk">VK</label><input id="vk" value="${esc(soc.vk || '')}" placeholder="vk.com/..."></div>
          <div class="field"><label for="tg">Telegram</label><input id="tg" value="${esc(soc.telegram || '')}" placeholder="@ник"></div>
          <div class="field"><label for="bh">Behance</label><input id="bh" value="${esc(soc.behance || '')}" placeholder="behance.net/..."></div></div>
        <div class="row"><button class="btn p" onclick="A.saveProfile()">Сохранить профиль</button><button class="btn" onclick="A.logout()">Выйти из аккаунта</button></div>
        <p class="hint" style="margin-top:16px">Не указывайте в профиле настоящие имя, телефон и другие личные данные: всё, что вы напишете в «О себе» и ссылках, видно всем. <button class="linkbtn" onclick="A.delAccount()">Удалить аккаунт</button></p></section>
      <section class="b s12"><div class="label">Авторы, на которых вы подписаны</div>${following.length ? `<div class="following-list">${following.map((u) => `<a class="following-person" href="#author-${esc(u.id)}">${avatar(avOf(u),36)}<span><b>${esc(u.nick)}</b><small>${esc(u.uni || '')}</small></span></a>`).join('')}</div>` : '<p class="hint">Открывайте интересные профили и подписывайтесь — новые авторы появятся здесь.</p>'}</section>
      <section class="b s12"><div class="row" style="justify-content:space-between;margin-bottom:6px"><div class="label" style="margin:0">Мои работы</div><a class="btn p sm" href="#publish" onclick="S_edit(null)">Опубликовать новую</a></div>
        ${ws.length ? ws.map((w) => `<div class="list-row"><a class="t" href="#work-${esc(w.id)}">${esc(w.title)}</a>
          <div class="row"><span class="badge ${STATUS[w.status][1]}">${STATUS[w.status][0]}</span>${w.status === 'fix' ? `<button class="btn sm" onclick="A.edit('${esc(w.id)}')">Исправить</button>` : ''}<button class="btn sm danger" onclick="A.deleteWork('${esc(w.id)}')">Удалить</button></div>
          ${w.editor_note ? `<div class="note">Редактор: ${esc(w.editor_note)}</div>` : ''}</div>`).join('') : '<div class="empty" style="padding:20px 0"><b>Здесь появятся ваши работы</b>Отправьте первую, и редактор её прочитает.</div>'}</section></div>`;
  };

  V.author = async (id) => {
    const profile = await DB.getPublicProfile(id);
    if (!profile) return empty('Автор не найден', 'Профиль мог быть удалён.');
    const works = await DB.listWorks({ authorId: id, status: 'published' });
    const follow = await DB.followInfo(id, S.me && S.me.id);
    const followButton = S.me && S.me.id !== id
      ? `<button class="btn ${follow.following ? '' : 'p'} sm" onclick="A.toggleFollow('${esc(id)}')">${follow.following ? 'Вы подписаны · Отписаться' : 'Подписаться'}</button>`
      : !S.me ? '<a class="btn p sm" href="#login">Войти, чтобы подписаться</a>' : '';
    return `<div class="public-profile"><a class="back" href="#catalog">${ic('back','sm')}Назад в журнал</a><div class="profile-head">${avatar(avOf(profile),64)}<div><h1 class="page-title">${esc(profile.nick)}</h1><div class="meta">${esc(profile.uni || '')}</div></div></div><div class="author-follow-row"><div class="author-follow-stats"><span><b>${follow.followers}</b> подписчиков</span><span><b>${follow.followingCount}</b> подписок</span></div>${followButton}</div>${profile.bio ? `<p class="profile-bio">${esc(profile.bio)}</p>` : ''}<h2 class="section-heading">Публикации автора</h2><div class="bento">${works.length ? works.map(card).join('') : empty('Пока нет опубликованных работ','Новые публикации появятся здесь.')}</div></div>`;
  };

  V.publish = async () => {
    if (!S.me) { toast('Сначала войдите или зарегистрируйтесь'); location.hash = 'register'; return ''; }
    const w = S.editId ? await DB.getWork(S.editId) : null;
    const knownWorks = await DB.listWorks();
    const knownTags = [...new Set(knownWorks.flatMap((x) => x.tags || []))].sort((a,b) => a.localeCompare(b,'ru'));
    return `<h1 class="page-title">${w ? 'Правки к работе' : 'Новая работа'}</h1><div class="bento">
      <section class="b s7 publish-editor"><div class="editor-progress"><span class="eyebrow">Новая публикация</span><span class="hint">Поля со звёздочкой обязательны</span></div><div class="field"><label for="pt">Название *</label><input id="pt" maxlength="140" value="${esc(w ? w.title : '')}" placeholder="Придумайте название"></div>
        <div class="grid2"><div class="field"><label for="pf">Форма</label><select id="pf" onchange="A.updateFormHint()">${options(FORMS, w && w.form)}</select></div>
        <div class="field"><label for="pu">Вуз</label><select id="pu">${options(UNIS, (w && w.uni) || S.me.uni)}</select></div></div>
        <div class="field"><div class="editor-field-head"><label for="pb">Содержание *</label><span id="body-count" class="hint">0 / 50 000</span></div><div class="editor-toolbar" role="toolbar" aria-label="Форматирование текста"><button type="button" onclick="A.formatText('**','**')" title="Полужирный"><b>B</b></button><button type="button" onclick="A.formatText('_','_')" title="Курсив"><i>I</i></button><button type="button" onclick="A.formatText('## ','')" title="Заголовок">H</button><button type="button" onclick="A.formatText('> ','')" title="Цитата">“</button><button type="button" onclick="A.formatText('- ','')" title="Список">☷</button><span class="toolbar-spacer"></span><button type="button" class="toolbar-preview" onclick="A.previewWork()" title="Предпросмотр">Предпросмотр</button></div><textarea id="pb" class="editor-body" rows="12" maxlength="50000" oninput="A.updateBodyCount()" placeholder="Начните с главной мысли…\n\nРазделяйте абзацы пустой строкой. Можно использовать кнопки форматирования.">${esc(w ? w.body : '')}</textarea><div class="hint" id="form-hint">Текст, описание или подпись к вашей работе.</div></div>
        <div class="field"><label for="pd">Описание к работе</label><textarea id="pd" rows="3" maxlength="1000" placeholder="Пара слов о том, как она появилась">${esc(w ? w.description : '')}</textarea></div>
        <div class="field"><label for="ptags">Теги (до 5 на работу)</label><div class="tag-picker"><div class="tag-picker-input"><input id="ptags" maxlength="140" value="${esc((w && w.tags || []).join(', '))}" placeholder="Введите теги через запятую"><button type="button" class="tag-picker-toggle" onclick="A.toggleTagPicker()" aria-label="Показать существующие теги" aria-expanded="false">▾</button></div><div class="tag-picker-panel" id="tag-picker-panel" hidden>${knownTags.length ? knownTags.map((t) => `<button type="button" class="tag-picker-option" onclick="A.toggleKnownTag('${esc(t).replace(/\\/g,'\\\\').replace(/'/g,"\\'")}')">${esc(t)}</button>`).join('') : '<span class="hint">Пока нет существующих тегов — можно добавить свои.</span>'}</div></div><div class="hint">Не более 5 тегов на работу и 30 разных тегов во всём журнале.</div></div>
        <div class="field editor-upload"><label for="cv">Изображения</label><label class="upload-drop" for="cv"><span class="upload-icon">＋</span><b>Добавить изображения</b><small>JPG, PNG или WebP · до 8 файлов</small></label><input id="cv" class="visually-hidden-file" type="file" accept="image/jpeg,image/png,image/webp" multiple onchange="A.showSelectedFiles(this)"><div class="hint">До 8 изображений, JPG, PNG или WebP. Не более 50 МБ на файл.</div><div id="selected-file" class="attached-file"></div>
          ${w && (w.attachments || []).some((x) => x.type === 'image') ? `<div class="existing-media"><span>В работе уже есть изображения — они сохранятся.</span></div>` : w && w.cover_url ? '<div class="existing-media">Текущая обложка сохранится.</div>' : ''}
        </div>
        <div class="field editor-upload"><label for="af">Музыка или аудио</label><label class="upload-drop upload-audio" for="af"><span class="upload-icon">♫</span><b>Прикрепить аудио</b><small>MP3, M4A, AAC, OGG, WAV, WebM или FLAC</small></label><input id="af" class="visually-hidden-file" type="file" accept="audio/mpeg,audio/mp3,audio/mp4,audio/aac,audio/ogg,audio/wav,audio/webm,audio/flac" onchange="A.showSelectedAudio(this)"><div class="hint">Один аудиофайл до 50 МБ. Читатели смогут слушать его прямо на странице работы.</div><div id="selected-audio" class="attached-file"></div>
          ${w && (w.attachments || []).some((x) => x.type === 'audio') ? '<div class="existing-media">Текущая аудиозапись сохранится. Новая заменит её.</div>' : ''}
        </div>
        <label class="check"><input id="pa" type="checkbox"><span>Подтверждаю, что я автор этой работы и имею право её публиковать</span></label>
        <div class="err" id="er"></div><button class="btn p" id="go" onclick="A.submit()">Отправить на модерацию</button></section>
      <aside class="b ink s5"><div class="label">Что дальше</div><h2 style="font-size:26px;margin-bottom:12px">Редактор прочитает работу</h2>
        <p>Мы отвечаем в течение трёх рабочих дней. Работа будет опубликована, возвращена с комментарием или отклонена.</p>
        <p>Статус всегда виден в вашем кабинете. После публикации работу увидят читатели каталога.</p></aside></div>`;
  };

  V.mod = async () => {
    if (!canReview()) {
      return `<div class="form-wrap"><h1 class="page-title">Редакция</h1><div class="b"><p>Этот раздел доступен только проверщикам и администраторам.</p>
        ${isDemo() ? '<button class="btn p" onclick="A.demoEditor()">Войти проверщиком (демо)</button>' : '<p class="hint">Роль проверщика выдаёт администратор проекта.</p>'}</div></div>`;
    }
    const queue = await DB.listWorks({ status: 'review' });
    S.reports = await DB.listReports();
    const tabs = [['queue', `Работы на проверке: ${queue.length}`], ['reports', `Жалобы: ${S.reports.length}`]]
      .map(([k, t]) => `<button class="chip${S.tab === k ? ' on' : ''}" onclick="A.tab('${k}')">${t}</button>`).join('');
    let body;
    if (S.tab === 'queue') {
      body = queue.length ? queue.map((w) => `<section class="b review s12"><div class="meta">${esc(w.form)}, ${esc(w.uni || '')}</div>
        <div style="font:22px Lora,serif">${esc(w.title)}</div><div class="meta">Автор: <a class="author-link" href="#author-${esc(w.author_id)}">${esc(w.author.nick || '')}</a> · ${esc(w.uni || 'вуз не указан')}</div>
        <div class="body">${esc(w.body.slice(0, 1200))}</div>${w.description ? `<div class="meta">Описание автора: ${esc(w.description)}</div>` : ''}
        ${workMedia(w) ? `<div class="review-files"><div class="label">Вложения автора</div>${workMedia(w)}</div>` : w.cover_url ? `<div class="review-files">${cover(w)}</div>` : '<div class="hint">Вложения не прикреплены.</div>'}
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
    return S.inManage ? `<div class="bento">${body}</div>` : `<h1 class="page-title">Модерация</h1><div class="row" style="margin-bottom:20px">${tabs}</div><div class="bento">${body}</div>`;
  };

  V.admin = async () => {
    if (!isAdmin()) return `<div class="form-wrap"><h1 class="page-title">Команда</h1><div class="b"><p>Раздел доступен только администраторам.</p></div></div>`;
    const [people, queue, reports] = await Promise.all([
      DB.listProfiles(), DB.listWorks({ status: 'review' }), DB.listReports()
    ]);
    const counts = {
      authors: people.filter((p) => p.role === 'author').length,
      editors: people.filter((p) => ['reviewer', 'editor'].includes(p.role)).length,
      admins: people.filter((p) => p.role === 'admin').length,
    };
    const labels = { author: 'Автор', reviewer: 'Редактор', admin: 'Администратор', editor: 'Редактор' };
    const roles = ['author', 'reviewer', 'admin'];
    const rows = people.map((p) => {
      const own = p.id === S.me.id;
      const search = (p.nick + ' ' + (p.uni || '')).toLowerCase();
      return `<section class="team-row" data-team-search="${esc(search)}" data-team-role="${esc(p.role)}">
        <div class="team-person">${avatar(avOf(p), 42)}<div><b>${esc(p.nick)}</b><div class="meta">${esc(p.uni || 'Вуз не указан')} · ${labels[p.role] || esc(p.role)}</div>${own ? '<span class="team-self">Это ваш аккаунт</span>' : ''}</div></div>
        <div class="row team-controls"><select id="role-${esc(p.id)}" aria-label="Роль пользователя ${esc(p.nick)}" ${own ? 'disabled' : ''}>${roles.map((r) => `<option value="${r}"${r === p.role || (r === 'reviewer' && p.role === 'editor') ? ' selected' : ''}>${labels[r]}</option>`).join('')}</select>
        <button class="btn sm" onclick="A.setRole('${esc(p.id)}')" ${own ? 'disabled' : ''}>Сохранить</button></div>
      </section>`;
    }).join('');
    return `<div class="admin-page">
      <div class="admin-heading"><div><div class="label">Управление проектом</div><h1 class="page-title">Команда</h1><p class="lead">Роли, доступы и состояние редакции — в одном месте.</p></div></div>
      <div class="admin-stats">
        <a class="b admin-stat" href="#mod"><span class="meta">На проверке</span><strong>${queue.length}</strong><span class="hint">Открыть редакцию →</span></a>
        <a class="b admin-stat" href="#mod"><span class="meta">Новые жалобы</span><strong>${reports.length}</strong><span class="hint">Перейти к жалобам →</span></a>
        <div class="b admin-stat"><span class="meta">Участники</span><strong>${people.length}</strong><span class="hint">${counts.authors} авторов · ${counts.editors} редакторов · ${counts.admins} администраторов</span></div>
      </div>
      <section class="b admin-team">
        <div class="admin-section-head"><div><h2>Участники и доступы</h2><p class="meta">Назначайте роль отдельно для каждого аккаунта.</p></div><span class="badge mute">${people.length} всего</span></div>
        <div class="admin-filters">
          <input id="team-search" type="search" placeholder="Найти по нику или вузу" oninput="A.filterTeam()">
          <select id="team-filter" aria-label="Фильтр по роли" onchange="A.filterTeam()"><option value="">Все роли</option><option value="author">Авторы</option><option value="reviewer">Редакторы</option><option value="admin">Администраторы</option></select>
        </div>
        <div id="team-list">${rows || '<div class="hint">Пока нет участников.</div>'}</div>
        <p class="hint admin-footnote">Редактор может проверять публикации и жалобы. Администратор дополнительно управляет ролями. Выдавайте права администратора только тем, кому полностью доверяете.</p>
      </section>
    </div>`;
  };

  V.settings = async () => {
    if (!isAdmin()) return '<div class="form-wrap"><h1 class="page-title">Настройки сайта</h1><div class="b">Раздел доступен только администраторам.</div></div>';
    const s = S.site || {};
    const field = (id, label, value, area) => '<label class="site-field">' + label + (area ? '<textarea id="site-' + id + '" rows="3">' + esc(value || '') + '</textarea>' : '<input id="site-' + id + '" value="' + esc(value || '') + '">') + '</label>';
    const color = /^#[0-9a-fA-F]{6}$/.test(s.accent_color || '') ? s.accent_color : '#e5482d';
    return '<div class="admin-page site-settings"><div class="settings-intro"><span class="eyebrow">Редактирование без кода</span><h2>Настройки «Черновика»</h2><p class="meta">Один экран для содержания и внешнего вида журнала.</p></div><div class="settings-card">' +
      '<section><h2>Название и главная</h2>' + field('site_name','Название сайта',s.site_name || 'Черновик') + field('tagline','Короткая подпись',s.tagline || 'Веб-журнал студентов Новосибирска') + field('home_label','Надзаголовок',s.home_label) + field('home_heading','Главный заголовок',s.home_heading,true) + field('home_lead','Описание главной',s.home_lead,true) + '</section>' +
      '<section><h2>Тема месяца</h2>' + field('theme_title','Название темы',s.theme_title || 'Тема месяца') + field('theme_description','Описание темы',s.theme_description,true) + field('theme_deadline','Срок приёма работ',s.theme_deadline || '') + '</section>' +
      '<section><h2>Объявление</h2>' + field('announcement_title','Заголовок',s.announcement_title) + field('announcement_body','Текст',s.announcement_body,true) + '</section>' +
      '<section><h2>О проекте</h2>' + field('about_text','Описание проекта',s.about_text,true) + '</section>' +
      '<section><h2>Внешний вид</h2><div class="settings-appearance"><label class="site-field">Акцентный цвет<input id="site-accent_color" type="color" value="' + color + '"></label><label class="site-field">Цветовая тема<select id="site-site_theme"><option value="system"' + ((s.site_theme || 'system') === 'system' ? ' selected' : '') + '>Как в системе</option><option value="light"' + (s.site_theme === 'light' ? ' selected' : '') + '>Светлая</option><option value="dark"' + (s.site_theme === 'dark' ? ' selected' : '') + '>Тёмная</option></select></label></div><p class="hint">Настройки оформления применяются ко всему сайту после сохранения.</p></section>' +
      '<div class="settings-actions"><button class="btn p" onclick="A.saveSiteSettings()">Сохранить изменения</button></div></div></div>';
  };
  V.manage = async () => {
    if (!canReview() && !isDemo()) return '<div class="b empty">Раздел доступен редакторам и администраторам.</div>';
    const tabs = [['queue','Публикации'],['reports','Жалобы'],...(isAdmin() ? [['team','Команда'],['settings','Настройки сайта']] : [])];
    if (!tabs.some(([k]) => k === S.manageTab)) S.manageTab = 'queue';
    const nav = tabs.map(([k,t]) => `<button class="manage-tab${S.manageTab === k ? ' on' : ''}" onclick="A.manageTab('${k}')">${t}</button>`).join('');
    let body = '';
    if (S.manageTab === 'queue' || S.manageTab === 'reports') { S.tab = S.manageTab; S.inManage = true; body = await V.mod(); S.inManage = false; }
    else if (S.manageTab === 'team') body = await V.admin();
    else if (S.manageTab === 'settings') body = await V.settings();
    return `<div class="manage-page"><div class="manage-heading"><div><span class="eyebrow">Рабочее пространство</span><h1 class="page-title">Управление</h1><p class="lead">Всё необходимое для работы с журналом — в одном месте.</p></div></div><nav class="manage-tabs" aria-label="Разделы управления">${nav}</nav><div class="manage-content">${body}</div></div>`;
  };

  V.about = async () => `<div class="article legal"><h1 class="page-title">О проекте</h1>
    <p>${esc((S.site || {}).about_text || "«Черновик» — веб-журнал студентов вузов Новосибирска. Мы помогаем найти аудиторию тем, кто пишет, рисует, снимает и сочиняет, но не знает, где это показать.")}</p>
    <p>Каждую работу читает редактор, поэтому здесь нет шума и спама. Читать можно без регистрации, публиковаться и комментировать могут зарегистрированные участники.</p></div>`;

  const TERMS = [
    ['Общие положения', 'Настоящее Соглашение регулирует использование веб-журнала «Черновик» (далее — «Сайт»). Регистрируясь или публикуя работы, вы подтверждаете, что прочитали Соглашение и согласны с ним. Читать опубликованные работы можно без регистрации.'],
    ['Регистрация и аккаунт', 'Для регистрации нужны придуманные вами ник и пароль и вуз, в котором вы учитесь. Почту, телефон и настоящее имя мы не запрашиваем. Вы отвечаете за сохранность пароля и за действия под вашим аккаунтом. Восстановить пароль самостоятельно нельзя, при потере напишите в редакцию. Один человек — один аккаунт. Ник не должен нарушать права других людей и вводить в заблуждение.'],
    ['Права на работы', 'Все авторские права на опубликованные работы остаются у их авторов. Публикуя работу, вы даёте Сайту неисключительное право безвозмездно показывать её на платформе, в выпусках журнала и в анонсах Сайта на весь срок публикации. Вы вправе удалить работу в любой момент и публиковать её на других площадках. Сайт не продаёт и не передаёт работы третьим лицам.'],
    ['Требования к работам', 'Вы подтверждаете, что являетесь автором работы или имеете право на её публикацию. Нельзя публиковать плагиат, оскорбления, призывы к насилию и ненависти, материалы 18+, чужие персональные данные, рекламу и спам. Если в работе использованы чужие изображения, музыка или цитаты, нужно указать источник.'],
    ['Модерация', 'Каждая работа проходит проверку редакции до публикации. Редактор может опубликовать работу, вернуть её на доработку с комментарием или отклонить с объяснением причины. Мы стараемся отвечать в течение 3 рабочих дней. Статус работы виден в личном кабинете.'],
    ['Комментарии и реакции', 'Комментировать и оставлять реакции могут только зарегистрированные пользователи. Анонимные комментарии не допускаются. Комментарии проходят автоматическую проверку, а редакция вправе скрыть комментарий, нарушающий правила уважительного общения.'],
    ['Жалобы', 'Любую работу или комментарий можно отправить на проверку, выбрав причину жалобы. Редакция рассматривает жалобы и может скрыть материал, снять работу с публикации или отклонить жалобу. Заведомо ложные жалобы считаются нарушением Соглашения.'],
    ['Персональные данные', 'Какие данные мы обрабатываем, зачем и как долго, описано в Политике обработки данных. Мы не запрашиваем почту, телефон и настоящее имя. Всё, что вы опубликовали, увидят другие читатели. Удалить аккаунт и все свои данные можно самостоятельно в личном кабинете.'],
    ['Бесплатность', 'Сайт не взимает плату ни с авторов, ни с читателей и не размещает платную рекламу внутри работ.'],
    ['Ответственность и санкции', 'За нарушения редакция вправе предупредить автора, скрыть материал или заблокировать аккаунт. Редакция не отвечает за мнения авторов, но вправе удалить материалы, нарушающие Соглашение.'],
    ['Изменение Соглашения', 'Мы можем обновлять Соглашение. О существенных изменениях сообщим на почту и на Сайте. Продолжая пользоваться Сайтом, вы соглашаетесь с новой редакцией.'],
  ];
  const OPN = () => ph(CFG.OPERATOR_NAME, 'название или ФИО оператора');
  const CON = () => ph(CFG.CONTACT, 'почта или адрес для обращений');
  const legalPage = (title, intro, sections) => `<div class="legal"><div class="meta">Редакция от ноября 2026</div><h1 class="page-title">${title}</h1>
    ${CFG.OPERATOR_NAME && CFG.CONTACT ? '' : '<div class="tpl">Шаблон для ознакомления. Перед запуском впишите данные оператора в config.js (места выделены) и проверьте текст у юриста.</div>'}
    ${intro}${sections.map((x, i) => `<h2>${i + 1}. ${x[0]}</h2>${x[1]}`).join('')}</div>`;

  V.terms = async () => legalPage('Пользовательское соглашение', '', TERMS.map((t) => [t[0], `<p>${t[1]}</p>`]));

  V.privacy = async () => legalPage('Политика обработки данных',
    '<p>Здесь объясняется, какие данные обрабатывает веб-журнал «Черновик» (далее — «Сайт»), зачем и как вы можете ими управлять. Политика подготовлена с учётом Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных». Пользуясь Сайтом, вы подтверждаете, что ознакомились с ней.</p>',
    [
      ['Оператор', `<p>Оператор данных: ${OPN()}.<br>Контакты для обращений: ${CON()}.</p>`],
      ['Какие данные мы обрабатываем', `<ul><li>ник и вуз, которые вы указали;</li><li>пароль, он хранится только в виде необратимого хеша: мы не знаем ваш пароль и не можем его прочитать;</li><li>аватар, выбранный из готового набора;</li><li>«о себе» и ссылки на соцсети, если вы решили их указать;</li><li>ваши работы, описания, комментарии, реакции и жалобы;</li><li>технические данные: IP-адрес, дата и время запросов, сведения о браузере (их фиксируют сервисы хостинга и базы данных), а также служебный ключ входа в памяти браузера, чтобы вы оставались в аккаунте.</li></ul>
        <p>Мы не запрашиваем почту, телефон, настоящие имя и фамилию, фотографии и документы. Не указывайте их в профиле, описаниях и комментариях.</p>`],
      ['Зачем нужны данные', '<ul><li>регистрация и вход в аккаунт;</li><li>публикация работ и их проверка редактором;</li><li>комментарии, реакции и жалобы;</li><li>показ вам статистики по вашим работам;</li><li>защита Сайта от спама и злоупотреблений;</li><li>ответы на ваши обращения.</li></ul>'],
      ['Основание обработки', '<p>Ваше согласие, которое вы даёте отметкой при регистрации, и исполнение Пользовательского соглашения. Дата и версия согласия сохраняются.</p>'],
      ['Что видят другие', '<p>Опубликованные работы, ник, вуз, аватар, «о себе» и ссылки видны всем посетителям Сайта, их могут сохранить другие люди или найти поисковики. Публикуйте только то, что готовы показать открыто. Хеш пароля и технические данные другим пользователям не раскрываются.</p>'],
      ['Передача третьим лицам', `<p>Мы не продаём данные и не передаём их для рекламы. Для работы Сайта используются хостинг (GitHub Pages) и облачная база данных с авторизацией (Supabase), они обрабатывают данные по нашему поручению. Серверы базы данных расположены: ${ph(CFG.DB_REGION, 'страна и регион размещения')}. Шрифты и скрипты загружаются с самого Сайта, сервисы аналитики и рекламы не подключены.</p>`],
      ['Сроки хранения', '<p>Данные хранятся, пока существует ваш аккаунт. После удаления аккаунта профиль, работы, комментарии и реакции удаляются из базы. Копии могут сохраняться в резервных копиях поставщика не дольше <mark>[срок]</mark>. Технические журналы хранятся по правилам хостинга.</p>'],
      ['Ваши права', `<ul><li>узнать, какие данные о вас обрабатываются;</li><li>изменить данные профиля, аватар, «о себе» и ссылки в личном кабинете;</li><li>удалить аккаунт и все свои данные кнопкой «Удалить аккаунт» в личном кабинете;</li><li>отозвать согласие: это равно удалению аккаунта или письму по контактам оператора;</li><li>обратиться к оператору (${CON()}) и получить ответ в срок, установленный законом.</li></ul>`],
      ['Защита данных', '<p>Соединение с Сайтом защищено HTTPS. Доступ к данным ограничен правилами на уровне базы: читатель видит только опубликованное, автор свои материалы, редактор рабочие разделы. Роли редакторов выдаёт администратор.</p>'],
      ['Возраст', '<p>Если вам нет 18 лет, регистрируйтесь только с согласия родителей или иных законных представителей.</p>'],
      ['Изменения политики', '<p>Мы можем обновлять Политику. Актуальная версия всегда доступна по ссылке в подвале Сайта.</p>'],
    ]);

  V.consent = async () => legalPage('Согласие на обработку данных',
    `<p>Я, пользователь Сайта «Черновик», свободно, своей волей и в своём интересе даю ${OPN()} (далее — «Оператор») согласие на обработку моих персональных данных на условиях ниже.</p>`,
    [
      ['Какие данные', '<p>Ник, вуз, хеш пароля, выбранный аватар, «о себе» и ссылки на соцсети (если я их укажу), мои работы, описания, комментарии, реакции и жалобы, а также технические данные: IP-адрес, сведения о браузере, дата и время запросов.</p>'],
      ['Цели', '<p>Создание и ведение аккаунта, публикация и проверка работ, комментарии и реакции, показ статистики, защита Сайта от злоупотреблений, ответы на мои обращения.</p>'],
      ['Действия с данными', '<p>Сбор, запись, систематизация, накопление, хранение, уточнение, использование, передача поставщикам хостинга и базы данных для работы Сайта, блокирование, удаление и уничтожение. Обработка осуществляется с использованием средств автоматизации.</p>'],
      ['Публикация данных', '<p>Я согласен, что мой ник, вуз, аватар, а также опубликованные мной работы, описания, комментарии, «о себе» и ссылки будут доступны неограниченному кругу лиц на Сайте.</p>'],
      ['Срок и отзыв', `<p>Согласие действует до удаления моего аккаунта или его отзыва. Отозвать согласие можно кнопкой «Удалить аккаунт» в личном кабинете либо обращением к Оператору: ${CON()}.</p>`],
      ['Возраст', '<p>Подтверждаю, что мне исполнилось 18 лет либо у меня есть согласие родителей или иных законных представителей.</p>'],
      ['Как дано согласие', '<p>Согласие дано отметкой в форме регистрации. Дата и версия текста согласия сохраняются вместе с моим профилем.</p>'],
    ]);

  /* ---------- Действия ---------- */
  window.S_edit = (id) => { S.editId = id; };
  A.go = go;
  A.setForm = (f) => { S.form = f; render(); };
  A.homeFilter = (f) => { S.homeForm = f; render(); };
  A.setUni = (u) => { S.uni = u; render(); };
  A.setTag = (tag) => { S.tag = tag; render(); };
  A.toggleFollow = async (authorId) => { if(!S.me) return go('login'); try { await DB.toggleFollow(authorId,S.me.id); await render(); } catch(e) { fail(e); } };

  A.byUni = (u) => { S.uni = u; S.form = ''; S.tag = ''; go('catalog'); };
  A.tab = (t) => { S.tab = t; render(); };

  A.reg = async () => {
    const er = $('#er'), nick = val('nk'), pw = $('#pw').value, uni = val('un');
    const bad = !/^[A-Za-z0-9][A-Za-z0-9._-]{1,22}[A-Za-z0-9]$/.test(nick) ? 'Ник: 3–24 символа, латиница, цифры, точка, дефис или подчёркивание, без них по краям'
      : pw.length < 8 ? 'Пароль: минимум 8 символов'
      : !$('#ag').checked ? 'Нужно принять Пользовательское соглашение' : !$('#cs').checked ? 'Нужно дать согласие на обработку данных' : '';
    if (bad) { er.textContent = bad; return; }
    $('#go').disabled = true;
    try {
      const r = await DB.signUp({ nick, password: pw, uni, avatar: pickedAv() });
      S.me = r.user; toast('Добро пожаловать, @' + nick); go('profile');
    } catch (e) { er.textContent = e.message; $('#go').disabled = false; }
  };
  A.login = async () => {
    try { S.me = await DB.signIn({ nick: val('lm'), password: $('#lp').value }); toast('Вы вошли'); go('profile'); }
    catch (e) { $('#er').textContent = e.message; }
  };
  A.demoEditor = async () => { S.me = await DB.demoEditor(); toast('Вы вошли как редактор (демо)'); render(); };
  A.manageTab = (tab) => { S.manageTab = tab; render(); };
  A.toggleTheme = () => { const next = activeTheme() === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', next); try { localStorage.setItem('cher-visitor-theme', next); } catch (_) {} updateThemeButton(); };
  A.toggleCardAudio = (button) => {
    const card = button.closest('.discover-card-audio');
    const audio = card && card.querySelector('audio');
    if (!audio) return;
    if (audio.paused) {
      document.querySelectorAll('.discover-audio-element').forEach((other) => {
        if (other !== audio) { other.pause(); const otherButton = other.closest('.discover-card-audio')?.querySelector('.discover-audio-play'); if (otherButton) { otherButton.classList.remove('is-playing'); otherButton.innerHTML = ic('play'); } }
      });
      audio.play().then(() => { button.classList.add('is-playing'); button.innerHTML = ic('pause'); }).catch(() => {});
    } else { audio.pause(); button.classList.remove('is-playing'); button.innerHTML = ic('play'); }
  };
  A.seekCardAudio = (event) => {
    const wave = event.currentTarget;
    const audio = wave.closest('.discover-card-audio')?.querySelector('audio');
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const rect = wave.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    A.updateCardAudio(audio);
  };
  A.seekCardAudioKey = (event) => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const wave = event.currentTarget;
    const audio = wave.closest('.discover-card-audio')?.querySelector('audio');
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    if (event.key === 'Home') audio.currentTime = 0;
    else if (event.key === 'End') audio.currentTime = audio.duration;
    else audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + (event.key === 'ArrowRight' ? 5 : -5)));
    A.updateCardAudio(audio);
  };
  A.updateCardAudio = (audio) => {
    const card = audio.closest('.discover-card-audio');
    if (!card) return;
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const fmt = (v) => Math.floor(v / 60) + ':' + String(Math.floor(v % 60)).padStart(2, '0');
    const wave = card.querySelector('.discover-audio-wave');
    if (wave) {
      const ratio = duration ? current / duration : 0;
      wave.style.setProperty('--played', (ratio * 100) + '%');
      wave.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
      wave.setAttribute('aria-valuetext', fmt(current) + (duration ? ' из ' + fmt(duration) : ''));
    }
    const label = card.querySelector('.discover-audio-time');
    if (label) label.textContent = fmt(current) + (duration ? ' / ' + fmt(duration) : '');
    const play = card.querySelector('.discover-audio-play');
    if (play) { play.classList.toggle('is-playing', !audio.paused); play.innerHTML = ic(audio.paused ? 'play' : 'pause'); }
  };

  A.saveSiteSettings = async () => {
    const keys = ['site_name','tagline','home_label','home_heading','home_lead','theme_title','theme_description','theme_deadline','announcement_title','announcement_body','about_text','accent_color','site_theme'];
    const next = {};
    keys.forEach((key) => { const el = $('#site-' + key); next[key] = el ? el.value.trim() : (S.site || {})[key] || ''; });
    if (!next.site_name) return toast('Укажите название сайта');
    if (!/^#[0-9a-fA-F]{6}$/.test(next.accent_color)) next.accent_color = '#e5482d';
    if (!['system','light','dark'].includes(next.site_theme)) next.site_theme = 'system';
    try { await DB.saveSiteSettings(next); S.site = next; document.title = next.site_name; render(); toast('Настройки сохранены'); }
    catch (e) { fail(e); }
  };
  A.filterTeam = () => {
    const q = ($('#team-search')?.value || '').trim().toLowerCase();
    const role = $('#team-filter')?.value || '';
    document.querySelectorAll('.team-row').forEach((row) => {
      const matchesText = !q || row.dataset.teamSearch.includes(q);
      const matchesRole = !role || row.dataset.teamRole === role || (role === 'reviewer' && row.dataset.teamRole === 'editor');
      row.hidden = !(matchesText && matchesRole);
    });
  };
  A.setRole = async (id) => {
    const select = $('#role-' + id);
    if (!select || select.disabled) return;
    if (select.value === 'admin' && !confirm('Выдать этому участнику права администратора? Он сможет менять роли других пользователей.')) return;
    try { await DB.setProfileRole(id, select.value); toast('Роль обновлена'); render(); }
    catch (e) { fail(e); }
  };
  A.logout = async () => { await DB.signOut(); S.me = null; toast('Вы вышли'); go('home'); };
  A.saveProfile = async () => {
    const patch = { avatar: pickedAv(), bio: val('bio'), uni: val('un') || null, socials: { vk: val('vk'), telegram: val('tg'), behance: val('bh') } };
    try { await DB.updateProfile(S.me.id, patch); Object.assign(S.me, patch); toast('Профиль сохранён'); render(); } catch (e) { fail(e); }
  };
  A.delAccount = async () => {
    if (!confirm('Удалить аккаунт вместе со всеми вашими работами, комментариями и реакциями? Это нельзя отменить.')) return;
    try { await DB.deleteAccount(S.me.id); S.me = null; toast('Аккаунт удалён'); go('home'); } catch (e) { fail(e); }
  };
  A.edit = (id) => { S.editId = id; go('publish'); };
  A.deleteWork = async (id) => {
    const w = await DB.getWork(id);
    if (!w || !canDeleteWork(w)) return toast('Недостаточно прав для удаления этой работы');
    if (!confirm(`Удалить работу «${w.title}»? Это действие нельзя отменить.`)) return;
    try {
      await DB.deleteWork(id, S.me.id);
      toast('Работа удалена');
      if (location.hash === `#work-${id}`) go(S.me.id === w.author_id ? 'profile' : 'catalog');
      else render();
    } catch (e) { fail(e); }
  };
  A.submit = async () => {
    const er = $('#er'), title = val('pt'), body = val('pb');
    const fileInput = $('#cv');
    const files = Array.from(fileInput && (fileInput._selectedFiles || fileInput.files) || []);
    const audio = ($('#af') && $('#af').files[0]) || null;
    const allowedAudio = ['audio/mpeg','audio/mp3','audio/mp4','audio/aac','audio/ogg','audio/wav','audio/webm','audio/flac','audio/x-wav'];
    const bad = !title ? 'Добавьте название' : title.length > 140 ? 'Название должно быть не длиннее 140 символов'
      : !body ? 'Добавьте текст или подпись к работе' : body.length > 50000 ? 'Текст должен быть не длиннее 50 000 символов'
      : files.length > 8 ? 'Можно прикрепить не больше 8 изображений'
      : files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) ? 'Изображения должны быть в формате JPG, PNG или WebP'
      : files.some((file) => file.size > 50 * 1024 * 1024) ? 'Каждое изображение должно быть не больше 50 МБ'
      : audio && (!allowedAudio.includes(audio.type) || audio.size > 50 * 1024 * 1024) ? 'Аудио: MP3, M4A, AAC, OGG, WAV, WebM или FLAC до 50 МБ'
      : val('ptags').split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean).length > 5 ? 'Укажите не больше 5 тегов'
      : val('ptags').split(',').some((t) => t.trim().replace(/^#/, '').length > 24) ? 'Каждый тег должен быть не длиннее 24 символов'
      : !$('#pa').checked ? 'Подтвердите авторство' : '';
    if (bad) { er.textContent = bad; return; }
    const tags = [...new Set(val('ptags').split(',').map((t) => t.trim().replace(/^#/, '').toLowerCase()).filter(Boolean))];
    const knownTags = new Set((await DB.listWorks()).flatMap((w) => w.tags || []));
    if (knownTags.size + tags.filter((tag) => !knownTags.has(tag)).length > 30) { er.textContent = 'Достигнут лимит в 30 разных тегов. Выберите существующие.'; return; }
    $('#go').disabled = true;
    try {
      const form = val('pf');
      if (!form) { er.textContent = 'Выберите формат работы'; $('#go').disabled = false; return; }
            await DB.saveWork({ id: S.editId, title, form: val('pf'), uni: val('pu') || null, body, description: val('pd'), tags }, files, audio, S.me.id);
      S.editId = null; toast('Отправлено на модерацию'); go('profile');
    } catch (e) { er.textContent = e.message; $('#go').disabled = false; }
  };

  A.toggleEmoji = () => { const p = $('#emoji-picker'); if (p) p.hidden = !p.hidden; };
  A.insertEmoji = (emoji) => { const f = $('#ci'); if (!f || f.disabled) return; const a=f.selectionStart,b=f.selectionEnd,v=f.value; f.value=v.slice(0,a)+emoji+v.slice(b); f.focus(); f.selectionStart=f.selectionEnd=a+emoji.length; const p=$('#emoji-picker'); if(p)p.hidden=true; };

  A.showSelectedFiles = (input) => {
    const box = $('#selected-file');
    if (!box || !input) return;
    const previous = Array.from(input._selectedFiles || []);
    const added = Array.from(input.files || []);
    const merged = [...previous];
    added.forEach((file) => {
      const duplicate = merged.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified);
      if (!duplicate) merged.push(file);
    });
    input._selectedFiles = merged;
    input.value = '';
    box.innerHTML = merged.map((file, index) => '<span class="selected-attachment">▧ ' + esc(file.name) + ' · ' + (file.size / 1048576).toFixed(1) + ' МБ <button type="button" class="selected-attachment-remove" onclick="A.removeSelectedFile(' + index + ')" aria-label="Убрать ' + esc(file.name) + '">×</button></span>').join('');
  };
  A.removeSelectedFile = (index) => {
    const input = $('#cv');
    if (!input) return;
    const files = Array.from(input._selectedFiles || input.files || []);
    files.splice(index, 1);
    input._selectedFiles = files;
    A.showSelectedFiles({ _selectedFiles: files, files: [] });
  };
  A.toggleTagPicker = () => {
    const panel = $('#tag-picker-panel'), button = document.querySelector('.tag-picker-toggle');
    if (!panel) return;
    panel.hidden = !panel.hidden;
    if (button) button.setAttribute('aria-expanded', String(!panel.hidden));
  };
  A.toggleKnownTag = (tag) => {
    const input = $('#ptags');
    if (!input) return;
    const tags = input.value.split(',').map((item) => item.trim().replace(/^#/, '')).filter(Boolean);
    const index = tags.findIndex((item) => item.toLowerCase() === tag.toLowerCase());
    if (index >= 0) tags.splice(index, 1);
    else if (tags.length < 5) tags.push(tag);
    else return toast('Можно выбрать не больше 5 тегов');
    input.value = tags.join(', ');
    const panel = $('#tag-picker-panel');
    if (panel) panel.querySelectorAll('.tag-picker-option').forEach((option) => {
      const selected = tags.some((item) => item.toLowerCase() === option.textContent.trim().toLowerCase());
      option.classList.toggle('selected', selected);
      option.setAttribute('aria-pressed', String(selected));
    });
  };
  A.showSelectedAudio = (input) => { const box = $('#selected-audio'); if (!box) return; box.innerHTML = input.files && input.files[0] ? '<span class="selected-attachment">♫ ' + esc(input.files[0].name) + ' · ' + (input.files[0].size / 1048576).toFixed(1) + ' МБ</span>' : ''; };
  A.formatText = (before, after) => { const field=$('#pb'); if(!field)return; const a=field.selectionStart,b=field.selectionEnd, value=field.value; const selected=value.slice(a,b)||'текст'; field.value=value.slice(0,a)+before+selected+after+value.slice(b); field.focus(); field.setSelectionRange(a+before.length,a+before.length+selected.length); A.updateBodyCount(); };
  A.updateBodyCount = () => { const field=$('#pb'), count=$('#body-count'); if(field&&count) count.textContent=field.value.length.toLocaleString('ru-RU')+' / 50 000'; };
  A.updateFormHint = () => { const form=val('pf'), hint=$('#form-hint'), field=$('#pb'); if(!hint||!field)return; const map={'Проза':['Текст произведения','Вставьте текст, разделяя абзацы пустой строкой.'],'Стихи':['Текст стихотворения','Сохраняйте переносы строк — они останутся в публикации.'],'Иллюстрация':['Описание иллюстрации','Расскажите об идее, технике или истории создания. Изображения добавьте ниже.'],'Фото':['История фотоработы','Добавьте подпись или расскажите о серии снимков. Фотографии прикрепите ниже.'],'Музыка':['О музыке','Расскажите о композиции, а аудиофайл прикрепите ниже.'],'Рукоделие':['Описание изделия','Расскажите, что вы создали, какие материалы и техники использовали. Фотографии добавьте ниже.']}; const item=map[form]||['Содержание','Текст, описание или подпись к вашей работе.']; const label=document.querySelector('label[for="pb"]'); if(label)label.textContent=item[0]+' *'; field.placeholder=item[1]; hint.textContent=item[1]; };

  A.previewWork = () => { const title=val('pt')||'Без названия', body=val('pb'); const safe=esc(body).replace(/^## (.+)$/gm,'<h3>$1</h3>').replace(/^&gt; (.+)$/gm,'<blockquote>$1</blockquote>').replace(/^[-*] (.+)$/gm,'<li>$1</li>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/_(.+?)_/g,'<em>$1</em>').split(/\n{2,}/).map(p=>p.startsWith('<h3>')||p.startsWith('<blockquote>')||p.startsWith('<li>')?p:`<p>${p.replace(/\n/g,'<br>')}</p>`).join(''); $('#modal').innerHTML=`<div class="ov" onclick="if(event.target===this)A.close()"><div class="dialog preview-dialog"><div class="label">Предпросмотр публикации</div><h2>${esc(title)}</h2><div class="prose">${safe||'<p>Здесь появится ваш текст.</p>'}</div><button class="btn p" onclick="A.close()">Продолжить редактирование</button></div></div>`; };

  A.react = async (id, kind) => {
    if (!S.me) return toast('Войдите, чтобы оставить реакцию');
    try {
      const r = await DB.reactions(id, S.me.id);
      await DB.toggleReaction(id, kind, S.me.id, r.mine.includes(kind));
      render();
    } catch (e) { fail(e); }
  };
  A.comment = async (id) => {
    const t = val('ci').trim();
    if (!S.me) return toast('Войдите, чтобы комментировать');
    if (!t) return toast('Напишите комментарий');
    if (t.length > 2000) return toast('Комментарий должен быть не длиннее 2 000 символов');
    const button = document.querySelector('.comment-form button[type="submit"]');
    if (button) button.disabled = true;
    try { await DB.addComment(id, t, S.me.id); await render(); } catch (e) { fail(e); if (button) button.disabled = false; }
  };
  A.toggleReply = (commentId) => {
    if (!S.me) return toast('Войдите, чтобы отвечать');
    const form = document.getElementById('reply-form-' + commentId);
    if (form) { form.hidden = !form.hidden; if (!form.hidden) form.querySelector('textarea').focus(); }
  };
  A.reply = async (workId, parentId) => {
    if (!S.me) return toast('Войдите, чтобы отвечать');
    const field = document.getElementById('reply-input-' + parentId);
    const t = field ? field.value.trim() : '';
    if (!t) return toast('Напишите ответ');
    if (t.length > 2000) return toast('Ответ должен быть не длиннее 2 000 символов');
    const form = document.getElementById('reply-form-' + parentId);
    const button = form && form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    try { await DB.addComment(workId, t, S.me.id, parentId); await render(); } catch (e) { fail(e); if (button) button.disabled = false; }
  };
  A.commentLike = async (commentId, liked) => {
    if (!S.me) return toast('Войдите, чтобы поставить лайк');
    try { await DB.toggleCommentLike(commentId, S.me.id, liked); await render(); } catch (e) { fail(e); }
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
    if (h.startsWith('author-')) { name = 'author'; arg = h.slice(7); }
    if (['mod','admin','settings'].includes(h)) { S.manageTab = h === 'mod' ? S.tab : h === 'admin' ? 'team' : 'settings'; name = 'manage'; }
    if (!V[name]) name = 'home';
    if (name !== 'publish' && S.editId && name !== 'profile') S.editId = null;
    const t = ++S.tok;
    try {
      try { S.site = Object.assign({}, SITE_DEFAULTS, await DB.getSiteSettings()); } catch (settingsError) { S.site = Object.assign({}, SITE_DEFAULTS); }
      document.title = S.site.site_name || 'Черновик';
      const accent = /^#[0-9a-fA-F]{6}$/.test(S.site.accent_color || '') ? S.site.accent_color : '#e5482d';
      document.documentElement.style.setProperty('--acc', accent);
      let visitorTheme = ''; try { visitorTheme = localStorage.getItem('cher-visitor-theme') || ''; } catch (_) {}
      const selectedTheme = ['light','dark'].includes(visitorTheme) ? visitorTheme : S.site.site_theme;
      if (['light','dark'].includes(selectedTheme)) document.documentElement.setAttribute('data-theme', selectedTheme);
      else document.documentElement.removeAttribute('data-theme');
      const html = await V[name](arg);
      if (t !== S.tok) return;
      $('#app').innerHTML = shell(name, html);
      updateThemeButton();
      if (name === 'publish') { A.updateBodyCount(); A.updateFormHint(); }
    } catch (e) {
      if (t !== S.tok) return;
      $('#app').innerHTML = shell(name, `<div class="b empty"><b>Не получилось загрузить страницу</b>${esc(e.message)}</div>`);
    }
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', render);
  DB.init().then((me) => { S.me = me; render(); }).catch((e) => { $('#app').textContent = 'Ошибка запуска: ' + e.message; });
})();
