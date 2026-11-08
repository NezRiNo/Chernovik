// Публичные настройки. Publishable (anon) key безопасно хранить в клиенте: доступ защищают политики RLS (см. supabase/schema.sql).
// НИКОГДА не вставляйте сюда secret / service_role key.
// Если поля пустые, сайт работает в демо-режиме: данные хранятся в браузере.
window.APP_CONFIG = {
  SUPABASE_URL: "https://qsqeqlxahmypznqafkak.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_c-sSCWMgxWb9-cRUCvHU0A_JRpHVunu",
  // Вход по нику: внутри Supabase ник превращается в служебный адрес ник@этот-домен.
  // Письма на него не отправляются. После запуска домен менять нельзя: аккаунты перестанут находиться.
  NICK_EMAIL_DOMAIN: "users.chernovik.app"
};
