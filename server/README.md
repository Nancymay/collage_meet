# Сервер коллажного вечера

Заказы и оплата работают внутри того же PocketBase, что и Pokarmanu (`api.pokarmanuapp.ru`).
Для коллажного вечера добавляется отдельная таблица `collage_orders` и три адреса:

| Адрес | Что делает |
|---|---|
| `GET /api/collage/seats` | сколько мест занято — сайт рисует по этому числу змейку |
| `POST /api/collage/create-payment` | создаёт заказ, держит места 15 минут и отдаёт ссылку на оплату Робокассы |
| `POST /api/collage/robokassa-result` | Робокасса сообщает сюда об оплате; заказ становится оплаченным, гостю и организатору уходят письма |

Данные Pokarmanu эти файлы не трогают. Гости хранятся на том же сервере в России.

## 1. Резервная копия

Открой `https://api.pokarmanuapp.ru/_/` → **Settings → Backups → Initialize new backup**.
Это на всякий случай: после установки PocketBase перезапустится, и Pokarmanu будет недоступен несколько секунд.

## 2. Скопировать файлы на сервер

Со своего компьютера, из папки репозитория `collage_meet`:

```bash
scp server/pb_migrations/1763000000_collage_orders.js root@SERVER_IP:/root/pb/pb_migrations/
ssh root@SERVER_IP "mkdir -p /root/pb/pb_hooks"
scp server/pb_hooks/collage.pb.js server/pb_hooks/collage_lib.js server/pb_hooks/collage_result.js root@SERVER_IP:/root/pb/pb_hooks/
```

## 3. Пароли Робокассы

В личном кабинете Робокассы: **Мои магазины → магазин → Технические настройки**. Там будут идентификатор магазина
и два пароля. Для начала возьми **тестовые** пароли (там же, вкладка тестовых платежей).

На сервере добавь их в конец `/root/pb/.env` (этот файл уже есть, в нём ключ шифрования — его не трогай):

```bash
ssh root@SERVER_IP
nano /root/pb/.env
```

```
ROBOKASSA_LOGIN=идентификатор_магазина
ROBOKASSA_PASS1=пароль_1
ROBOKASSA_PASS2=пароль_2
ROBOKASSA_TEST=1
COLLAGE_ORGANIZER_EMAIL=твоя_почта_для_уведомлений
COLLAGE_SITE_URL=https://nancymay.github.io/collage_meet/
```

`ROBOKASSA_TEST=1` — тестовый режим: деньги не списываются. Когда всё проверишь, поставь боевые пароли и `ROBOKASSA_TEST=0`.

## 4. Перезапустить PocketBase

```bash
systemctl restart pocketbase
systemctl status pocketbase          # должно быть active (running)
curl https://api.pokarmanuapp.ru/api/collage/seats
# → {"left":10,"reserved":0,"taken":0,"total":10}
```

При запуске PocketBase сам создаст таблицу `collage_orders`. Если что-то не так — смотри `/root/pb/std.log`.

## 5. Настройки в кабинете Робокассы

**Технические настройки** магазина:

| Поле | Значение |
|---|---|
| Алгоритм расчёта хеша | MD5 |
| Result URL | `https://api.pokarmanuapp.ru/api/collage/robokassa-result`, метод **POST** |
| Success URL | `https://nancymay.github.io/collage_meet/?paid=1`, метод **GET** |
| Fail URL | `https://nancymay.github.io/collage_meet/?failed=1`, метод **GET** |

Подключи **Робочеки СМЗ**, чтобы чеки самозанятого формировались и уходили гостю автоматически.
Название услуги в чеке берётся из описания платежа: «Билет на коллажный вечер 5 декабря, N шт.» —
уточни в поддержке Робокассы, хватает ли этого для твоего тарифа или нужно передавать состав заказа (параметр `Receipt`).

## 6. Включить на сайте

В `js/config.js` поменяй `paymentMode: 'demo'` на `paymentMode: 'live'` и запушь.
Сайт начнёт брать число мест с сервера и отправлять гостей на оплату.

Проверь тестовую покупку: заполни форму → оплати тестовой картой из кабинета Робокассы →
вернёшься на сайт с окном «Ура…», придут два письма, в `https://api.pokarmanuapp.ru/_/` → **collage_orders**
появится заказ со статусом `paid`, а на сайте станет на одно место меньше.

## Когда появится свой домен

1. В `/lib/systemd/system/pocketbase.service` допиши домен в `--origins=...` через запятую
   (например, `https://kollazh.ru,https://www.kollazh.ru`), затем `systemctl daemon-reload && systemctl restart pocketbase`.
2. В кабинете Робокассы поменяй Success URL и Fail URL на новый домен.
3. В `.env` обнови `COLLAGE_SITE_URL`.

## Где смотреть гостей

`https://api.pokarmanuapp.ru/_/` → **Collections → collage_orders**. Оплаченные — со статусом `paid`.
Заказы со статусом `pending` старше 15 минут — это те, кто не дошёл до оплаты; места за ними уже освобождены.
Если нужно вручную отменить заказ (например, вернули деньги) — поставь статус `cancelled`.
