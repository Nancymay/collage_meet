(function () {
  'use strict';
  var C = window.SITE_CONFIG || {};
  var TOTAL = C.seatsTotal || 10;
  var LIVE = C.paymentMode === 'live' && !!C.apiBase;
  var TAKEN = Math.max(0, Math.min(TOTAL, Math.round(Number(C.seatsTaken) || 0)));
  var LEFT = TOTAL - TAKEN;
  var PRICE = C.price || 2000;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function money(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'; }
  function seatsWord(n) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return 'место';
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'места';
    return 'мест';
  }

  // ---------- места ----------
  function renderSeatLabels() {
    var label = LEFT === 0 ? 'Мест не осталось — напишите нам, запишем в лист ожидания'
      : 'Осталось ' + LEFT + ' ' + seatsWord(LEFT) + ' из ' + TOTAL;
    $$('[data-remaining]').forEach(function (el) { el.textContent = label; });
    $$('[data-remaining-short]').forEach(function (el) { el.textContent = LEFT === 0 ? 'мест нет' : 'осталось ' + LEFT; });
  }

  // ---------- карта ----------
  var mapUrl = 'https://yandex.ru/maps/?text=' + encodeURIComponent((C.event && C.event.address) || '');
  $$('[data-map-link]').forEach(function (a) { a.href = mapUrl; });

  // ---------- печатная машинка ----------
  (function () {
    var el = $('#typed'); if (!el) return;
    if (reduceMotion) { el.textContent = 'вырезать'; return; }
    var words = ['вырезать', 'клеить', 'фантазировать', 'говорить о себе'];
    var wi = 0, ci = words[0].length, del = false, hold = 16;
    setInterval(function () {
      var w = words[wi];
      if (hold > 0) { hold--; return; }
      if (!del) { if (ci < w.length) ci++; else { del = true; hold = 16; } }
      else { if (ci > 0) ci--; else { del = false; wi = (wi + 1) % words.length; hold = 3; } }
      el.textContent = words[wi].slice(0, ci);
    }, 95);
  })();

  // ---------- змейка мест ----------
  var snakeStarted = false;
  function startSnake() {
    if (snakeStarted) return; snakeStarted = true;
    var svg = $('#snake'); if (!svg) return;
    var d = 'M25 25 V165';
    for (var i = 1; i < 10; i++) {
      var x1 = 25 + 60 * i;
      d += (i % 2 === 1) ? ' A30 30 0 0 0 ' + x1 + ' 165 V55' : ' A30 30 0 0 1 ' + x1 + ' 55 V165';
    }
    d += ' V25';
    var bg = $('.snake-bg', svg), fg = $('.snake-fg', svg), num = $('#seats-filled');
    bg.setAttribute('d', d); fg.setAttribute('d', d);
    svg.setAttribute('aria-label', 'Занято ' + TAKEN + ' ' + seatsWord(TAKEN) + ' из ' + TOTAL);
    var t = TAKEN * 10 / TOTAL; // длина пути = 10 единиц
    function draw(p, shown) {
      fg.setAttribute('stroke-dasharray', p.toFixed(3) + ' 10');
      fg.setAttribute('stroke-opacity', p < 0.02 ? '0' : '1');
      num.textContent = shown;
    }
    if (reduceMotion) { draw(t, TAKEN); return; }
    // Пока никто не купил — змейка просто «дышит»: плавно заполняется до конца и уходит обратно.
    // Цифра при этом честная и остаётся 0.
    var idle = TAKEN === 0;
    var target = idle ? 10 : t;
    var FILL = idle ? 2.4 : 1.9, HOLD = idle ? 0.6 : 2.8, DRAIN = idle ? 2.4 : 0.8, REST = idle ? 0.5 : 0.35;
    var CYCLE = FILL + HOLD + DRAIN + REST, t0 = null;
    function ease(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }
    function loop(ts) {
      if (t0 === null) t0 = ts;
      var c = ((ts - t0) / 1000) % CYCLE, p, shown = TAKEN;
      if (idle) {
        if (c < FILL) p = target * ease(c / FILL);
        else if (c < FILL + HOLD) p = target;
        else if (c < FILL + HOLD + DRAIN) p = target * (1 - ease((c - FILL - HOLD) / DRAIN));
        else p = 0;
        draw(p, 0);
        requestAnimationFrame(loop);
        return;
      }
      if (c < FILL) { var k = c / FILL; p = t * (1 - Math.pow(1 - k, 3)); shown = Math.round(p * TOTAL / 10); }
      else if (c < FILL + HOLD) p = t;
      else if (c < FILL + HOLD + DRAIN) { var k2 = (c - FILL - HOLD) / DRAIN; p = t * (1 - k2 * k2 * (3 - 2 * k2)); }
      else p = 0;
      draw(p, shown);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  // Сколько мест занято: с сервера (в режиме 'live') или из config.js
  function applySeats(taken) {
    TAKEN = Math.max(0, Math.min(TOTAL, Math.round(taken)));
    LEFT = TOTAL - TAKEN;
    maxQty = Math.max(1, LEFT);
    if (state.qty > maxQty) state.qty = maxQty;
    renderSeatLabels(); renderQty(); startSnake();
  }
  function loadSeats() {
    if (!LIVE) { applySeats(TAKEN); return; }
    var done = false;
    var timer = setTimeout(function () { if (!done) { done = true; applySeats(TAKEN); } }, 3000);
    fetch(C.apiBase + '/seats', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (d) {
        if (done) return; done = true; clearTimeout(timer);
        // занятыми считаем оплаченные места и те, что сейчас держат на странице оплаты
        applySeats((Number(d.taken) || 0) + (Number(d.reserved) || 0));
      })
      .catch(function () { if (!done) { done = true; clearTimeout(timer); applySeats(TAKEN); } });
  }

  // ---------- слайды ----------
  var tick = 0;
  function showSlides() {
    $$('[data-rotator]').forEach(function (r) {
      var kids = Array.prototype.slice.call(r.children);
      var idx = tick % kids.length;
      kids.forEach(function (k, i) { k.classList.toggle('on', i === idx); });
    });
  }
  showSlides();
  if (!reduceMotion) setInterval(function () { tick++; showSlides(); }, 2800);

  // ---------- модалки ----------
  var current = null, lastFocus = null;
  function openModal(name) {
    var m = $('[data-modal="' + name + '"]'); if (!m) return;
    if (current && current !== m) current.hidden = true;
    else lastFocus = document.activeElement;
    m.hidden = false; current = m;
    document.body.classList.add('locked');
    var dlg = m.firstElementChild;
    dlg.classList.remove('pop-in'); void dlg.offsetWidth; dlg.classList.add('pop-in');
    var f = $('input, button, a[href]', m); if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 30);
  }
  function closeModal() {
    if (!current) return;
    current.hidden = true; current = null;
    document.body.classList.remove('locked');
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  document.addEventListener('click', function (e) {
    var open = e.target.closest('[data-open]');
    if (open) { e.preventDefault(); if (open.getAttribute('data-open') === 'buy') resetForm(); openModal(open.getAttribute('data-open')); return; }
    if (e.target.closest('[data-close]')) { closeModal(); return; }
    if (current && e.target === current && current.getAttribute('data-modal') !== 'paying') closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && current && current.getAttribute('data-modal') !== 'paying') closeModal();
    if (e.key === 'Tab' && current) { // фокус не уходит из окна
      var f = $$('input, button, a[href], [tabindex]:not([tabindex="-1"])', current).filter(function (x) { return !x.disabled && x.offsetParent !== null; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  // ---------- форма покупки ----------
  var form = $('#buy-form');
  var state = { qty: 1, method: 'card', methodTitle: 'Картой', tried: false };
  var maxQty = Math.max(1, LEFT);
  var methodTitles = { card: 'Картой', sbp: 'СБП', tpay: 'T-Pay', sberpay: 'SberPay' };

  function renderQty() {
    $('#qty').textContent = state.qty;
    $('[data-qty="-1"]').disabled = state.qty <= 1;
    $('[data-qty="1"]').disabled = state.qty >= maxQty;
    $$('[data-total]').forEach(function (el) { el.textContent = money(PRICE * state.qty); });
  }
  $$('[data-qty]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.qty = Math.min(maxQty, Math.max(1, state.qty + Number(b.getAttribute('data-qty'))));
      renderQty();
    });
  });
  $$('[data-method]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.method = b.getAttribute('data-method');
      state.methodTitle = methodTitles[state.method];
      $$('[data-method]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    });
  });

  function errors() {
    var name = $('#f-name').value.trim(), email = $('#f-email').value.trim();
    var digits = $('#f-phone').value.replace(/\D/g, '');
    return {
      name: name.length < 2,
      email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      phone: digits.length < 10 || digits.length > 11,
      consent: !$('#f-consent').checked
    };
  }
  function showErrors() {
    var er = errors();
    [['name', 'f-name'], ['email', 'f-email'], ['phone', 'f-phone']].forEach(function (p) {
      var bad = state.tried && er[p[0]];
      $('#' + p[1]).classList.toggle('err', bad);
      $('#' + p[1]).setAttribute('aria-invalid', bad ? 'true' : 'false');
      $('#e-' + p[0]).hidden = !bad;
    });
    $('#e-consent').hidden = !(state.tried && er.consent);
    return er;
  }
  ['f-name', 'f-email', 'f-phone', 'f-consent'].forEach(function (id) {
    $('#' + id).addEventListener('input', function () { if (state.tried) showErrors(); });
    $('#' + id).addEventListener('change', function () { if (state.tried) showErrors(); });
  });
  function resetForm() { state.tried = false; showErrors(); renderQty(); }

  function personalize(data) {
    var first = (data.name || '').trim().split(/\s+/)[0];
    var line = (first ? first + ', б' : 'Б') + 'илет и чек мы отправили на ' + (data.email || 'вашу почту') + '. Ждём вас — ножницы и клей уже на столе.';
    $('[data-ok-line]').textContent = line;
    if (data.qty) { $('[data-tickets]').textContent = data.qty + ' ' + seatsWord(data.qty) + ' · ' + money(PRICE * data.qty); $('[data-tickets-row]').hidden = false; }
    else $('[data-tickets-row]').hidden = true;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    state.tried = true;
    var er = showErrors();
    if (er.name || er.email || er.phone || er.consent) {
      var firstBad = $('.field.err') || $('#f-consent'); if (firstBad) firstBad.focus();
      return;
    }
    var data = {
      name: $('#f-name').value.trim(), email: $('#f-email').value.trim(), phone: $('#f-phone').value.trim(),
      qty: state.qty, method: state.method, sum: PRICE * state.qty
    };
    $('[data-method-title]').textContent = state.methodTitle;
    try { sessionStorage.setItem('collage-order', JSON.stringify({ name: data.name, email: data.email, qty: data.qty })); } catch (x) {}

    if (LIVE) {
      $('[data-demo-note]').hidden = true;
      openModal('paying');
      // Сервер создаёт заказ, держит места и возвращает { url } страницы оплаты Робокассы
      fetch(C.apiBase + '/create-payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, body: j }; }); })
        .then(function (res) {
          if (res.ok && res.body.url) { window.location.href = res.body.url; return; }
          openModal('buy');
          if (res.status === 409) {
            applySeats(TOTAL - (Number(res.body.left) || 0));
            toast(res.body.left > 0 ? 'Осталось только ' + res.body.left + ' ' + seatsWord(res.body.left) : 'Места закончились');
          } else toast('Не получилось открыть оплату. Попробуйте ещё раз через минуту.');
        })
        .catch(function () { openModal('buy'); toast('Не получилось открыть оплату. Проверьте интернет и попробуйте ещё раз.'); });
      return;
    }
    // Демо-режим
    $('[data-demo-note]').hidden = false;
    openModal('paying');
    setTimeout(function () { personalize(data); openModal('success'); }, 1800);
  });

  // Возврат из Робокассы: Success URL — ?paid=1, Fail URL — ?failed=1
  (function () {
    var q = new URLSearchParams(location.search);
    if (q.get('failed') === '1') {
      history.replaceState(null, '', location.pathname);
      setTimeout(function () { openModal('buy'); toast('Оплата не прошла — попробуйте ещё раз или выберите другой способ'); }, 300);
      return;
    }
    if (q.get('paid') === '1' || q.has('InvId')) {
      var saved = {}; try { saved = JSON.parse(sessionStorage.getItem('collage-order') || '{}'); } catch (x) {}
      personalize(saved);
      openModal('success');
      history.replaceState(null, '', location.pathname);
    }
  })();

  // ---------- календарь и «позвать подругу» ----------
  function toast(msg) {
    var t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600);
  }
  function icsDate(s) { return new Date(s).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  var calBtn = $('[data-calendar]');
  if (calBtn) calBtn.addEventListener('click', function () {
    var ev = C.event || {};
    var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//collage-meet//RU', 'BEGIN:VEVENT',
      'UID:collage-' + icsDate(ev.start) + '@collage-meet', 'DTSTAMP:' + icsDate(new Date().toISOString()),
      'DTSTART:' + icsDate(ev.start), 'DTEND:' + icsDate(ev.end), 'SUMMARY:' + (ev.title || 'Коллажный вечер'),
      'LOCATION:' + ((ev.place || '') + ', ' + (ev.address || '')).replace(/,/g, '\\,'),
      'DESCRIPTION:Мини-лекция\\, создание коллажа и арт-разбор. Приходите за 10–15 минут.',
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    a.download = 'kollazhnyj-vecher.ics'; document.body.appendChild(a); a.click(); a.remove();
  });
  var shareBtn = $('[data-share]');
  if (shareBtn) shareBtn.addEventListener('click', function () {
    var url = location.origin + location.pathname;
    var text = 'Пойдём на коллажный вечер 5 декабря? Лекция, коллажи и арт-разбор.';
    if (navigator.share) { navigator.share({ title: 'Коллажный вечер', text: text, url: url }).catch(function () {}); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(text + ' ' + url).then(function () { toast('Ссылка скопирована'); });
  });

  loadSeats();
})();
