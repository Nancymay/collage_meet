/// <reference path="../pb_data/types.d.ts" />

// Заказы билетов на коллажный вечер. Отдельная таблица: данные Pokarmanu не трогаются.
// Доступ к таблице есть только у администратора (все правила null) —
// сайт работает с ней через маршруты из pb_hooks/collage.pb.js.
migrate(
  (app) => {
    const orders = new Collection({
      type: "base",
      name: "collage_orders",
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: "inv_id", type: "number", required: true, onlyInt: true, min: 1 },
        { name: "name", type: "text", required: true, max: 200 },
        { name: "email", type: "email", required: true },
        { name: "phone", type: "text", max: 40 },
        { name: "qty", type: "number", required: true, onlyInt: true, min: 1, max: 10 },
        { name: "sum", type: "number", required: true, min: 0 },
        { name: "method", type: "text", max: 20 },
        { name: "status", type: "select", required: true, maxSelect: 1, values: ["pending", "paid", "cancelled"] },
        { name: "paid_at", type: "date" },
        { name: "note", type: "text", max: 500 },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_collage_orders_inv ON collage_orders (inv_id)",
        "CREATE INDEX idx_collage_orders_status ON collage_orders (status, created)"
      ]
    });
    app.save(orders);
  },
  (app) => {
    const orders = app.findCollectionByNameOrId("collage_orders");
    app.delete(orders);
  }
);
