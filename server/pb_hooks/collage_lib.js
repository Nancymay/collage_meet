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

// Письма гостю и организатору. Ошибка отправки не должна ломать подтверждение оплаты.
function sendMails(app, order) {
  const settings = app.settings();
  const from = { address: settings.meta.senderAddress, name: "Коллажный вечер" };
  const name = escapeHtml(order.getString("name"));
  const qty = order.getInt("qty");
  const sum = order.getFloat("sum");
  const site = env("COLLAGE_SITE_URL", "https://nancymay.github.io/collage_meet/");

  try {
    app.newMailClient().send(new MailerMessage({
      from: from,
      to: [{ address: order.getString("email") }],
      subject: "Ваш билет на коллажный вечер · 5 декабря",
      html:
        '<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.5;color:#141414">' +
        "<p>" + (name ? name + ", з" : "З") + "дравствуйте!</p>" +
        "<p>Оплата прошла — вы идёте на коллажный вечер. Ждём вас <b>5 декабря, в субботу, в 15:00</b>.</p>" +
        "<p>Билеты: " + qty + " " + seatsWord(qty) + " · " + sum + " ₽<br>Номер заказа: " + order.getInt("inv_id") + "</p>" +
        "<p>Адрес и подробности — на сайте: <a href=\"" + escapeHtml(site) + "\">" + escapeHtml(site) + "</a></p>" +
        "<p>Ничего брать не нужно: бумага, журналы, ножницы, клей и чай — на нас. Приходите за 10–15 минут до начала.</p>" +
        '<p style="color:#666">Если планы поменяются, просто ответьте на это письмо.</p></div>'
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
  sendMails: sendMails
};
