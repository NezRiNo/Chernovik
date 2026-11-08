/*
 * Слой данных. Один интерфейс, две реализации:
 *   Live: Supabase (когда в config.js заданы URL и ключ)
 *   Demo: localStorage (когда ключей нет, удобно для разработки и показа)
 * app.js работает только через window.DB и ничего не знает о том, что внутри.
 */
(function () {
  const cfg = window.APP_CONFIG || {};
  const isLive = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const sb = isLive ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

  const KINDS = ['like', 'hit', 'more'];
  const countKinds = (rows = []) => rows.reduce((a, r) => ((a[r.kind] = (a[r.kind] || 0) + 1), a), { like: 0, hit: 0, more: 0 });
  const RU = {
    'Invalid login credentials': 'Неверный ник или пароль',
    'User already registered': 'Этот ник уже занят',
    'Database error saving new user': 'Этот ник уже занят или не подходит',
    'Signup requires a valid password': 'Пароль слишком простой',
  };
  const check = (error) => {
    if (!error) return;
    const m = error.message || String(error);
    throw new Error(RU[m] || (/Password should be/i.test(m) ? 'Пароль слишком простой: минимум 8 символов' : m));
  };
  // Вход по нику без почты: ник превращается в служебный адрес, письма на него не уходят.
  const nickEmail = (nick) => nick.trim().toLowerCase() + '@' + (cfg.NICK_EMAIL_DOMAIN || 'users.chernovik.app');
  const WORK_SELECT = '*, author:profiles!works_author_id_fkey(id, nick, uni), reactions(kind)';

  /* ================= Live (Supabase) ================= */
  const Live = {
    mode: 'live',

    async init() {
      const { data } = await sb.auth.getSession();
      return this._me(data.session);
    },
    async _me(session) {
      if (!session) return null;
      const { data } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      return data || null;
    },
    async signUp({ nick, password, uni }) {
      const { data, error } = await sb.auth.signUp({ email: nickEmail(nick), password, options: { data: { nick, uni } } });
      check(error);
      if (!data.session) throw new Error('Не удалось войти сразу после регистрации. Сообщите редакции: в Supabase должно быть отключено подтверждение почты');
      return { user: await this._me(data.session) };
    },
    async signIn({ nick, password }) {
      const { data, error } = await sb.auth.signInWithPassword({ email: nickEmail(nick), password });
      check(error);
      return this._me(data.session);
    },
    async signOut() { await sb.auth.signOut(); },
    async updateProfile(id, patch) {
      const { error } = await sb.from('profiles').update(patch).eq('id', id);
      check(error);
    },

    _work(r) { return { ...r, author: r.author || {}, counts: countKinds(r.reactions) }; },
    async listWorks(o = {}) {
      let q = sb.from('works').select(WORK_SELECT).order('created_at', { ascending: false });
      if (o.status) q = q.eq('status', o.status);
      if (o.form) q = q.eq('form', o.form);
      if (o.uni) q = q.eq('uni', o.uni);
      if (o.authorId) q = q.eq('author_id', o.authorId);
      if (o.limit) q = q.limit(o.limit);
      const { data, error } = await q;
      check(error);
      return data.map((r) => this._work(r));
    },
    async getWork(id) {
      const { data, error } = await sb.from('works').select(WORK_SELECT).eq('id', id).maybeSingle();
      check(error);
      return data ? this._work(data) : null;
    },
    async _upload(file, uid) {
      const path = `${uid}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
      const { error } = await sb.storage.from('covers').upload(path, file);
      check(error);
      return sb.storage.from('covers').getPublicUrl(path).data.publicUrl;
    },
    async saveWork(w, file, uid) {
      const row = { title: w.title, form: w.form, uni: w.uni, body: w.body, description: w.description };
      if (file) row.cover_url = await this._upload(file, uid);
      if (w.id) {
        const { error } = await sb.from('works').update({ ...row, status: 'review', editor_note: null }).eq('id', w.id);
        check(error);
        return w.id;
      }
      const { data, error } = await sb.from('works').insert({ ...row, author_id: uid }).select('id').single();
      check(error);
      return data.id;
    },
    async setStatus(id, status, note) {
      const { error } = await sb.from('works').update({
        status, editor_note: note || null,
        published_at: status === 'published' ? new Date().toISOString() : null,
      }).eq('id', id);
      check(error);
    },
    async incViews(id) { await sb.rpc('increment_views', { work_id: id }); },

    async listComments(workId) {
      const { data, error } = await sb.from('comments').select('*, author:profiles(nick)')
        .eq('work_id', workId).eq('hidden', false).order('created_at');
      check(error);
      return data;
    },
    async addComment(workId, body, uid) {
      const { error } = await sb.from('comments').insert({ work_id: workId, author_id: uid, body });
      check(error);
    },
    async reactions(workId, uid) {
      const { data, error } = await sb.from('reactions').select('kind, user_id').eq('work_id', workId);
      check(error);
      return { counts: countKinds(data), mine: data.filter((r) => r.user_id === uid).map((r) => r.kind) };
    },
    async toggleReaction(workId, kind, uid, on) {
      const q = sb.from('reactions');
      const { error } = on
        ? await q.delete().match({ work_id: workId, user_id: uid, kind })
        : await q.insert({ work_id: workId, user_id: uid, kind });
      check(error);
    },

    async report({ type, id, reason, note }, uid) {
      const { error } = await sb.from('reports').insert({
        reporter_id: uid, target_type: type, target_id: id, reason, note: note || '',
      });
      check(error);
    },
    async listReports() {
      const { data, error } = await sb.from('reports')
        .select('*, reporter:profiles!reports_reporter_id_fkey(nick)').eq('status', 'new').order('created_at');
      check(error);
      return Promise.all(data.map(async (r) => {
        const table = r.target_type === 'work' ? 'works' : 'comments';
        const col = r.target_type === 'work' ? 'title' : 'body';
        const { data: t } = await sb.from(table).select(col).eq('id', r.target_id).maybeSingle();
        return { ...r, label: t ? t[col] : '(уже удалено)' };
      }));
    },
    async resolveReport(r, hide) {
      if (hide) {
        if (r.target_type === 'comment') {
          const { error } = await sb.from('comments').update({ hidden: true }).eq('id', r.target_id);
          check(error);
        } else {
          await this.setStatus(r.target_id, 'fix', 'Снято по жалобе: ' + r.reason);
        }
      }
      const { error } = await sb.from('reports').update({ status: 'done' }).eq('id', r.id);
      check(error);
    },
  };

  /* ================= Demo (localStorage) ================= */
  const KEY = 'chernovik_demo_v4';
  const day = 864e5;
  const seed = () => ({
    session: null,
    users: [
      { id: 'u1', nick: 'mila_writes', uni: 'НГУ', bio: 'Пишу короткую прозу о городе и людях.', socials: { telegram: '@mila_writes' }, role: 'author', password: 'demo1234' },
      { id: 'u2', nick: 'artem_l', uni: 'НГТУ (НЭТИ)', bio: '', socials: {}, role: 'author', password: 'demo1234' },
      { id: 'ed', nick: 'redaktor', uni: 'НГУ', bio: 'Редакция журнала', socials: {}, role: 'editor', password: 'demo1234' },
    ],
    works: [
      { id: 'w1', author_id: 'u1', title: 'Последняя маршрутка до Академа', form: 'Проза', uni: 'НГУ', status: 'published', views: 1240, base: { like: 24, hit: 12, more: 7 }, created_at: Date.now() - 2 * day, description: 'Рассказ о ночной дороге домой.',
        body: 'Последняя маршрутка до Академа уходила в 00:40, и я знала, что сегодня на ней поедут только свои: студенты с последней пары, девушка с виолончелью и человек, который читал одну и ту же страницу весь маршрут.\n\nЗа окном Новосибирск становился всё тише, а в салоне разговоры только начинались. Кто-то делился наушником, кто-то шёпотом пересказывал конспект. Мы проезжали мост, и город внизу казался чужим и очень добрым.' },
      { id: 'w2', author_id: 'u2', title: 'Письма из общежития', form: 'Стихи', uni: 'НГТУ (НЭТИ)', status: 'published', views: 410, base: { like: 18, hit: 9, more: 4 }, created_at: Date.now() - 3 * day, description: '',
        body: 'Чайник вскипел, а я не заметил,\nкак за окном догорел ноябрь.\nВ коридоре гудит соседский ветер,\nпахнет борщом и чужой тетрадью.' },
      { id: 'w3', author_id: 'u2', title: 'Город после дождя', form: 'Иллюстрация', uni: 'СГУПС', status: 'published', views: 305, base: { like: 31, hit: 14, more: 3 }, created_at: Date.now() - 4 * day, description: 'Цифровая иллюстрация, 2026.', body: 'Серия из трёх иллюстраций о мокром асфальте и жёлтых окнах.' },
      { id: 'w4', author_id: 'u1', title: 'Лестницы', form: 'Фото', uni: 'НГАСУ (Сибстрин)', status: 'published', views: 520, base: { like: 20, hit: 8, more: 6 }, created_at: Date.now() - 5 * day, description: '', body: 'Фотосерия о том, как студенты поднимаются на пары и спускаются с них. Двенадцать кадров, ни одного постановочного.' },
      { id: 'w5', author_id: 'u2', title: 'Как я полюбил сессию', form: 'Проза', uni: 'НГПУ', status: 'published', views: 260, base: { like: 11, hit: 5, more: 2 }, created_at: Date.now() - 6 * day, description: '', body: 'Сессия началась в понедельник, а закончилась, как мне кажется, в другой жизни.' },
      { id: 'w6', author_id: 'u1', title: 'Демо №3, гараж', form: 'Музыка', uni: 'СибГУТИ', status: 'published', views: 190, base: { like: 9, hit: 6, more: 5 }, created_at: Date.now() - 7 * day, description: 'Ссылка на трек в описании.', body: 'Три минуты гаражного звука, записанного ночью в общежитии.' },
      { id: 'w7', author_id: 'u2', title: 'Нулевая пара', form: 'Стихи', uni: 'НГТУ (НЭТИ)', status: 'review', views: 0, base: {}, created_at: Date.now() - day / 2, description: 'Написал по дороге на 8:30.', body: 'Нулевая пара, как нулевой километр: дальше только дорога…' },
    ],
    comments: [
      { id: 'c1', work_id: 'w1', author_id: 'u2', body: 'Очень точно про последний рейс. Хочу продолжения!', hidden: false, created_at: Date.now() - day },
      { id: 'c2', work_id: 'w1', author_id: 'ed', body: 'Зацепило. Особенно финал.', hidden: false, created_at: Date.now() - day / 2 },
    ],
    reactions: [],
    reports: [{ id: 'r1', reporter_id: 'u1', target_type: 'comment', target_id: 'c2', reason: 'Другое', note: 'Пример жалобы для демонстрации', status: 'new', created_at: Date.now() - 3600e3 }],
  });

  let DB;
  const load = () => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) return s; } catch (e) { /* пусто */ } return seed(); };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { /* хранилище недоступно */ } };
  const uid = () => 'x' + Math.random().toString(36).slice(2, 10);
  const user = (id) => DB.users.find((u) => u.id === id);
  const pub = ({ id, nick, uni }) => ({ id, nick, uni });
  const withMe = (u) => (u ? { ...u } : null);

  const Demo = {
    mode: 'demo',

    async init() { DB = load(); return withMe(user(DB.session)); },
    async signUp({ nick, password, uni }) {
      if (DB.users.some((u) => u.nick.toLowerCase() === nick.toLowerCase())) throw new Error('Этот ник уже занят');
      const u = { id: uid(), nick, uni, bio: '', socials: {}, role: 'author', password };
      DB.users.push(u); DB.session = u.id; save();
      return { user: withMe(u) };
    },
    async signIn({ nick, password }) {
      const u = DB.users.find((x) => x.nick.toLowerCase() === nick.trim().toLowerCase() && x.password === password);
      if (!u) throw new Error('Неверный ник или пароль');
      DB.session = u.id; save();
      return withMe(u);
    },
    async signOut() { DB.session = null; save(); },
    async updateProfile(id, patch) { Object.assign(user(id), patch); save(); },

    _work(w) {
      const mine = DB.reactions.filter((r) => r.work_id === w.id);
      const c = countKinds(mine);
      KINDS.forEach((k) => { c[k] += (w.base || {})[k] || 0; });
      return { ...w, created_at: new Date(w.created_at).toISOString(), author: pub(user(w.author_id)), counts: c };
    },
    async listWorks(o = {}) {
      return DB.works
        .filter((w) => (!o.status || w.status === o.status) && (!o.form || w.form === o.form) && (!o.uni || w.uni === o.uni) && (!o.authorId || w.author_id === o.authorId))
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, o.limit || 999)
        .map((w) => this._work(w));
    },
    async getWork(id) { const w = DB.works.find((x) => x.id === id); return w ? this._work(w) : null; },
    async saveWork(w, file, uidMe) {
      let cover = null;
      if (file && file.size < 600e3) cover = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); });
      const base = { title: w.title, form: w.form, uni: w.uni, body: w.body, description: w.description };
      if (w.id) {
        const x = DB.works.find((y) => y.id === w.id);
        Object.assign(x, base, { status: 'review', editor_note: null }, cover ? { cover_url: cover } : {});
        save(); return x.id;
      }
      const n = { id: uid(), author_id: uidMe, ...base, cover_url: cover, status: 'review', views: 0, base: {}, created_at: Date.now() };
      DB.works.push(n); save(); return n.id;
    },
    async setStatus(id, status, note) {
      const w = DB.works.find((x) => x.id === id);
      w.status = status; w.editor_note = note || null; save();
    },
    async incViews(id) { const w = DB.works.find((x) => x.id === id); if (w && w.status === 'published') { w.views++; save(); } },

    async listComments(workId) {
      return DB.comments.filter((c) => c.work_id === workId && !c.hidden)
        .map((c) => ({ ...c, created_at: new Date(c.created_at).toISOString(), author: { nick: user(c.author_id).nick } }));
    },
    async addComment(workId, body, uidMe) {
      DB.comments.push({ id: uid(), work_id: workId, author_id: uidMe, body, hidden: false, created_at: Date.now() }); save();
    },
    async reactions(workId, uidMe) {
      const rows = DB.reactions.filter((r) => r.work_id === workId);
      const w = DB.works.find((x) => x.id === workId);
      const counts = countKinds(rows);
      KINDS.forEach((k) => { counts[k] += ((w && w.base) || {})[k] || 0; });
      return { counts, mine: rows.filter((r) => r.user_id === uidMe).map((r) => r.kind) };
    },
    async toggleReaction(workId, kind, uidMe, on) {
      DB.reactions = DB.reactions.filter((r) => !(r.work_id === workId && r.user_id === uidMe && r.kind === kind));
      if (!on) DB.reactions.push({ work_id: workId, user_id: uidMe, kind });
      save();
    },

    async report({ type, id, reason, note }, uidMe) {
      DB.reports.push({ id: uid(), reporter_id: uidMe, target_type: type, target_id: id, reason, note: note || '', status: 'new', created_at: Date.now() }); save();
    },
    async listReports() {
      return DB.reports.filter((r) => r.status === 'new').map((r) => {
        const t = r.target_type === 'work' ? DB.works.find((w) => w.id === r.target_id) : DB.comments.find((c) => c.id === r.target_id);
        return { ...r, reporter: { nick: user(r.reporter_id).nick }, label: t ? (t.title || t.body) : '(уже удалено)' };
      });
    },
    async resolveReport(r, hide) {
      if (hide) {
        if (r.target_type === 'comment') DB.comments.find((c) => c.id === r.target_id).hidden = true;
        else await this.setStatus(r.target_id, 'fix', 'Снято по жалобе: ' + r.reason);
      }
      DB.reports.find((x) => x.id === r.id).status = 'done'; save();
    },
    // Только для демо: быстрый вход редактором без пароля.
    async demoEditor() { DB.session = 'ed'; save(); return withMe(user('ed')); },
  };

  window.DB = isLive ? Live : Demo;
})();
