/// <reference path="../pb_data/types.d.ts" />

// Маршруты коллажного вечера. Все под /api/, чтобы на них действовали общие ограничения частоты запросов.
//
//   GET  /api/collage/seats            → { total, taken, reserved, left }
//   POST /api/collage/create-payment   → { url } — ссылка на страницу оплаты Робокассы
//   POST /api/collage/robokassa-result ← уведомление Робокассы об оплате (Result URL)
//
// Пароли Робокассы берутся из /root/pb/.env (см. server/README.md) и в репозиторий не попадают.

// Сколько мест занято — для змейки на сайте
routerAdd("GET", "/api/collage/seats", (e) => {
  const lib = require(`${__hooks}/collage_lib.js`);
  const c = lib.counts(e.app);
  e.response.header().set("Cache-Control", "no-store");
  return e.json(200, { total: lib.TOTAL, taken: c.paid, reserved: c.held, left: c.left });
});

// Создать заказ и вернуть ссылку на оплату
routerAdd("POST", "/api/collage/create-payment", (e) => {
  const lib = require(`${__hooks}/collage_lib.js`);

  const login = lib.env("ROBOKASSA_LOGIN");
  const pass1 = lib.env("ROBOKASSA_PASS1");
  if (!login || !pass1) {
    return e.json(503, { error: "payments_not_configured" });
  }

  const b = e.requestInfo().body || {};
  const name = String(b.name || "").trim().slice(0, 200);
  const email = String(b.email || "").trim().slice(0, 200);
  const phone = String(b.phone || "").trim().slice(0, 40);
  const digits = phone.replace(/\D/g, "");
  const qty = parseInt(b.qty, 10);
  const method = ["card", "sbp", "tpay", "sberpay"].indexOf(b.method) >= 0 ? b.method : "card";

  if (name.length < 2) return e.json(400, { error: "bad_name" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return e.json(400, { error: "bad_email" });
  if (digits.length < 10 || digits.length > 11) return e.json(400, { error: "bad_phone" });
  if (!(qty >= 1 && qty <= lib.TOTAL)) return e.json(400, { error: "bad_qty" });

  let res = null;
  e.app.runInTransaction((tx) => {
    const c = lib.counts(tx);
    if (qty > c.left) {
      res = { error: "sold_out", left: c.left };
      return;
    }
    const last = tx.findRecordsByFilter("collage_orders", "inv_id > 0", "-inv_id", 1, 0);
    const invId = last.length ? last[0].getInt("inv_id") + 1 : 1001;
    const order = new Record(tx.findCollectionByNameOrId("collage_orders"));
    order.set("inv_id", invId);
    order.set("name", name);
    order.set("email", email);
    order.set("phone", phone);
    order.set("qty", qty);
    order.set("sum", lib.PRICE * qty);
    order.set("method", method);
    order.set("status", "pending");
    tx.save(order);
    res = { invId: invId, sum: lib.PRICE * qty };
  });

  if (res.error) return e.json(409, res);

  const outSum = res.sum.toFixed(2);
  const description = "Билет на коллажный вечер 5 декабря, " + qty + " шт.";
  const signature = $security.md5(login + ":" + outSum + ":" + res.invId + ":" + pass1);

  const params = {
    MerchantLogin: login,
    OutSum: outSum,
    InvId: String(res.invId),
    Description: description,
    SignatureValue: signature,
    Email: email,
    Culture: "ru",
    Encoding: "utf-8"
  };
  if (lib.env("ROBOKASSA_TEST") === "1") params.IsTest = "1";

  const query = Object.keys(params)
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(params[k]))
    .join("&");

  return e.json(200, { url: "https://auth.robokassa.ru/Merchant/Index.aspx?" + query, invId: res.invId });
});

// Уведомление Робокассы об успешной оплате (Result URL) — логика в collage_result.js.
routerAdd("POST", "/api/collage/robokassa-result", (e) => {
  const handler = require(`${__hooks}/collage_result.js`);
  return handler(e);
});
routerAdd("GET", "/api/collage/robokassa-result", (e) => {
  const handler = require(`${__hooks}/collage_result.js`);
  return handler(e);
});
