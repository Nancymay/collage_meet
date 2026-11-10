// Обработчик уведомления Робокассы (Result URL). Подключается из collage.pb.js через require.

// Уведомление Робокассы об успешной оплате (Result URL). Робокасса может прислать его несколько раз —
// повторная обработка ничего не ломает.
module.exports = function collageResult(e) {
  const lib = require(`${__hooks}/collage_lib.js`);
  const pass2 = lib.env("ROBOKASSA_PASS2");

  // formValue читает и параметры адреса (GET), и тело формы (POST)
  const outSum = String(e.request.formValue("OutSum") || "");
  const invId = String(e.request.formValue("InvId") || "");
  const sig = String(e.request.formValue("SignatureValue") || "").toUpperCase();

  if (!pass2 || !outSum || !invId || !sig) return e.string(400, "bad request");

  const expected = $security.md5(outSum + ":" + invId + ":" + pass2).toUpperCase();
  if (!$security.equal(expected, sig)) return e.string(400, "bad sign");

  let order;
  try {
    order = e.app.findFirstRecordByFilter("collage_orders", "inv_id = {:inv}", { inv: parseInt(invId, 10) });
  } catch (err) {
    return e.string(404, "order not found");
  }

  if (Math.abs(parseFloat(outSum) - order.getFloat("sum")) > 0.01) {
    order.set("note", "Сумма в уведомлении (" + outSum + ") не совпала с заказом");
    e.app.save(order);
    return e.string(400, "bad sum");
  }

  if (order.getString("status") !== "paid") {
    order.set("status", "paid");
    order.set("paid_at", new Date().toISOString());
    e.app.save(order);
    lib.sendMails(e.app, order);
  }

  return e.string(200, "OK" + invId);
};
