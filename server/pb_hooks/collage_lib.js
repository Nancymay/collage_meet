// Общий код для маршрутов коллажного вечера (pb_hooks/collage.pb.js).
// В PocketBase каждый обработчик изолирован, поэтому он подключает этот файл через require.

const TOTAL = 10;          // всего мест
const PRICE = 2000;        // ₽ за место
const HOLD_MINUTES = 15;   // сколько держим место за тем, кто ушёл на страницу оплаты

function env(name, def) {
  const v = $os.getenv(name);
  return v === "" || v === undefined || v === null ? (def === undefined ? "" : def) : v;
}

// Время в формате, в котором PocketBase хранит даты: "2026-11-11 10:00:00.000Z"
function dbTime(msAgo) {
  return new Date(Date.now() - (msAgo || 0)).toISOString().replace("T", " ");
}

// Сколько мест оплачено и сколько сейчас «держат» те, кто на странице оплаты
function counts(app) {
  const since = dbTime(HOLD_MINUTES * 60 * 1000);
  const recs = app.findRecordsByFilter(
    "collage_orders",
    "status = 'paid' || (status = 'pending' && created > {:since})",
    "",
    0,
    0,
    { since: since }
  );
  let paid = 0, held = 0;
  for (let i = 0; i < recs.length; i++) {
    const q = recs[i].getInt("qty");
    if (recs[i].getString("status") === "paid") paid += q; else held += q;
  }
  return { paid: paid, held: held, left: Math.max(0, TOTAL - paid - held) };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function seatsWord(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "место";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "места";
  return "мест";
}

// Письмо гостю: всё то же, что в окне «Ура, вы идёте» на сайте.
// Вёрстка таблицами и стилями прямо в тегах — так письмо одинаково выглядит в Яндексе, Mail.ru, Gmail и на телефоне.
const MAP_URL = "https://yandex.ru/maps/?text=" + encodeURIComponent("Москва, Настасьинский переулок, 1");
const CAL_URL = "https://calendar.google.com/calendar/render?action=TEMPLATE" +
  "&text=" + encodeURIComponent("Коллажный вечер") +
  "&dates=20261205T120000Z/20261205T150000Z" +
  "&details=" + encodeURIComponent("Мини-лекция, коллажи и арт-разбор. Вход: главный, подъезд «Бизнес Центр», лифт до 4 этажа, охране назвать кабинет № 406. Телефон Стаси: +7 999 852-68-21") +
  "&location=" + encodeURIComponent("Зал 406, студии H4U, Москва, Настасьинский пер., 1");

function buyerHtml(name, qty, sum, inv, site) {
  const F = "font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;";
  const A = "color:#ff5a1f;text-decoration:underline;";
  function row(k, v, last) {
    return '<tr><td style="' + F + 'padding:12px 14px;font-size:14px;color:#8a8a8a;vertical-align:top;width:96px;' + (last ? "" : "border-bottom:1px solid #2c2c2c;") + '">' + k + "</td>" +
      '<td style="' + F + 'padding:12px 14px;font-size:15px;line-height:1.45;color:#f6f2ec;vertical-align:top;' + (last ? "" : "border-bottom:1px solid #2c2c2c;") + '">' + v + "</td></tr>";
  }
  function block(title, text) {
    return '<p style="' + F + 'margin:26px 0 8px;font-size:17px;font-weight:600;color:#f6f2ec">' + title + "</p>" +
      '<p style="' + F + 'margin:0;font-size:15px;line-height:1.55;color:#c9c9c9">' + text + "</p>";
  }
  function step(n, text) {
    return '<tr><td style="' + F + 'padding:6px 12px 6px 0;font-size:15px;font-weight:700;color:#ff5a1f;vertical-align:top;width:28px">' + n + "</td>" +
      '<td style="' + F + 'padding:6px 0;font-size:15px;line-height:1.5;color:#c9c9c9">' + text + "</td></tr>";
  }
  function btn(href, text) {
    return '<a href="' + href + '" style="' + F + 'display:inline-block;margin:0 8px 8px 0;padding:11px 18px;border:1px solid #3a3a3a;border-radius:999px;font-size:14px;color:#f6f2ec;text-decoration:none">' + text + "</a>";
  }
  return '<div style="margin:0;padding:24px 12px;background:#0a0a0a">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#141414;border-radius:18px"><tr><td style="padding:32px 28px">' +
    '<span style="' + F + 'display:inline-block;padding:7px 14px;border-radius:999px;background:#ff5a1f;color:#0a0a0a;font-size:13px;font-weight:600">✓ Оплата прошла</span>' +
    '<h1 style="' + F + 'margin:20px 0 10px;font-size:28px;line-height:1.15;font-weight:700;color:#f6f2ec">' + (name ? name + ", ура" : "Ура") + ", вы идёте на коллажный вечер!</h1>" +
    '<p style="' + F + 'margin:0 0 22px;font-size:15px;line-height:1.5;color:#b0b0b0">Ждём вас — ножницы и клей уже на столе. Чек от Робокассы придёт отдельным письмом.</p>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #2c2c2c;border-radius:12px;border-collapse:separate">' +
    row("Когда", "<b>5 декабря, суббота</b> · начало в 15:00") +
    row("Где", '<a href="' + MAP_URL + '" style="' + A + '">Зал 406 · студии H4U, Москва, Настасьинский пер., 1</a><br><span style="color:#8a8a8a">м. Пушкинская, Тверская, Чеховская</span>') +
    row("Вход", "главный, подъезд «Бизнес Центр», на лифте до 4 этажа; охране назовите кабинет <b>№ 406</b>") +
    row("Не нашли?", 'звоните Стасе: <a href="tel:+79998526821" style="' + A + 'white-space:nowrap">+7 999 852-68-21</a>') +
    row("Билеты", qty + " " + seatsWord(qty) + " · " + String(sum).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0") + "\u00a0₽ · заказ № " + inv, true) +
    "</table>" +
    '<div style="margin-top:18px">' + btn(CAL_URL, "Добавить в календарь") + btn(MAP_URL, "Открыть в Яндекс Картах") + btn(site, "Позвать подругу") + "</div>" +
    '<p style="' + F + 'margin:26px 0 8px;font-size:17px;font-weight:600;color:#f6f2ec">Как пройдёт вечер</p>' +
    '<table role="presentation" cellpadding="0" cellspacing="0">' +
    step("01", "Знакомимся и слушаем мини-лекцию Стаси: что такое коллаж и почему он так много говорит о нас") +
    step("02", "Режем, рвём, клеим — каждый собирает свой коллаж. Подскажем, если застрянете") +
    step("03", "Полина бережно разбирает работы: что за образами, цветами и формами — без оценок «красиво/некрасиво»") +
    "</table>" +
    block("Что взять с собой", "Ничего обязательного: журналы, бумага, ножницы, клей и чай — на нас. Если хочется, возьмите свои картинки, открытки, билеты или фото, которые просятся в коллаж.") +
    block("Когда приходить", "Лучше за 10–15 минут до начала, чтобы спокойно раздеться, налить чай и выбрать место за столом.") +
    block("Остались вопросы?", 'Пишите в Telegram <a href="https://t.me/stasya_dsgn" style="' + A + '">@stasya_dsgn</a> — ответим в течение дня.') +
    '<p style="' + F + 'margin:30px 0 0;padding-top:18px;border-top:1px solid #2c2c2c;font-size:13px;color:#777">До встречи!<br>Стася и Полина · <a href="' + site + '" style="color:#777">междунами.site</a></p>' +
    "</td></tr></table></div>";
}

// Письма гостю и организатору. Ошибка отправки не должна ломать подтверждение оплаты.
function sendMails(app, order) {
  const settings = app.settings();
  const from = { address: settings.meta.senderAddress, name: "Коллажный вечер" };
  const name = escapeHtml(order.getString("name"));
  const qty = order.getInt("qty");
  const sum = order.getFloat("sum");
  const site = escapeHtml(env("COLLAGE_SITE_URL", "https://междунами.site/"));

  try {
    app.newMailClient().send(new MailerMessage({
      from: from,
      to: [{ address: order.getString("email") }],
      subject: "Ваш билет на коллажный вечер · 5 декабря, 15:00",
      html: buyerHtml(name, qty, sum, order.getInt("inv_id"), site)
    }));
  } catch (err) {
    console.log("collage: buyer mail failed", err);
  }

  const organizer = env("COLLAGE_ORGANIZER_EMAIL");
  if (organizer) {
    try {
      const c = counts(app);
      app.newMailClient().send(new MailerMessage({
        from: from,
        to: [{ address: organizer }],
        subject: "Новая оплата: " + order.getString("name") + " · " + qty + " " + seatsWord(qty),
        html:
          "<p><b>" + name + "</b> оплатил(а) " + qty + " " + seatsWord(qty) + " на " + sum + " ₽.</p>" +
          "<p>Почта: " + escapeHtml(order.getString("email")) + "<br>Телефон: " + escapeHtml(order.getString("phone")) +
          "<br>Заказ №" + order.getInt("inv_id") + "</p>" +
          "<p>Оплачено мест: " + c.paid + " из " + TOTAL + ".</p>"
      }));
    } catch (err) {
      console.log("collage: organizer mail failed", err);
    }
  }
}

module.exports = {
  TOTAL: TOTAL,
  PRICE: PRICE,
  HOLD_MINUTES: HOLD_MINUTES,
  env: env,
  counts: counts,
  sendMails: sendMails,
  buyerHtml: buyerHtml
};
