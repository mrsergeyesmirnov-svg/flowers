# Она — персональный флорист

Мобильное демо сервиса, который подбирает три букета по описанию человека, поводу и бюджету, а затем предлагает релевантные дополнения к заказу.

## Запуск

```bash
npm run dev
```

Откройте `http://localhost:4173`. Зависимости устанавливать не нужно.

## Проверка логики подбора

```bash
npm test
```

Это демонстрационный MVP: каталог хранится в `recommender.js`, заявка и оплата пока не отправляются.

## Super Admin

Админка открывается только из Telegram-бота. Сервер проверяет подпись Telegram `initData`, затем назначает роль по ID из Railway Variables:

```env
SUPERADMIN_TELEGRAM_ID=ваш_telegram_id
SHOP_ADMIN_TELEGRAM_IDS=id_владельца,id_менеджера
SHOP_ID=romashka
PRIVACY_OPERATOR=ИП Иванова Анна Сергеевна
PRIVACY_EMAIL=privacy@example.ru
```

Обычные пользователи не видят кнопку админки. Super Admin видит все настроенные магазины; владелец и менеджеры — только свой магазин. Прямой запрос к API без действительной подписи Telegram получает отказ.

Для нескольких тестовых магазинов можно передать конфигурацию JSON:

```env
ADMIN_SHOPS_JSON=[{"id":"romashka","name":"Ромашка","bot":"@romashka_bot","plan":"Start","subscription":"active","monthly":4900,"paidUntil":"2026-10-21","botStatus":"online","orders":12}]
```

Допустимые статусы подписки: `trial`, `active`, `overdue`, `paused`; бота: `online`, `setup`, `error`.

Не добавляйте в `ADMIN_SHOPS_JSON` токены ботов, платёжные ключи или Telegram ID. Требования к хранению секретов, согласиям и будущим рассылкам описаны в [`SECURITY.md`](./SECURITY.md).
