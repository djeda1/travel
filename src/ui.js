import { AGENCY, LOCATIONS } from './data.js';
import { locationStart } from './timeline.js';

const $ = (s) => document.querySelector(s);

function formFields(idPrefix, withPackage) {
  const options = LOCATIONS.flatMap((l) =>
    l.packages.map((p) => `<option value="${l.id}:${p.name}">${l.name} — «${p.name}», ${p.nights} ночей</option>`));
  return `
    <label class="field"><span>Имя</span>
      <input name="name" id="${idPrefix}-name" autocomplete="name" required minlength="2" />
      <em class="field__error">Напишите, как к вам обращаться</em></label>
    <label class="field"><span>Телефон</span>
      <input name="phone" id="${idPrefix}-phone" type="tel" autocomplete="tel" required pattern="[0-9+()\\- ]{7,}" placeholder="+7 700 000 00 00" />
      <em class="field__error">Проверьте номер — нужно минимум 7 цифр</em></label>
    ${withPackage ? `<label class="field"><span>Тур</span><select name="package">${options.join('')}</select></label>` : `
    <label class="field"><span>Направление</span><select name="package">
      <option value="any">Пока не решил(а)</option>${LOCATIONS.map((l) => `<option value="${l.id}">${l.name}</option>`).join('')}
    </select></label>`}
    <label class="field"><span>Когда хотите поехать</span><input name="date" type="month" /></label>
    <button class="btn btn--accent" type="submit">Отправить заявку</button>
    <p class="form__success" role="status" hidden>Спасибо! Мы свяжемся с вами в течение 15 минут.</p>`;
}

function bindForm(form) {
  const validate = (input) => input.closest('.field')?.classList.toggle('field--invalid', !input.checkValidity());
  form.addEventListener('focusout', (e) => e.target.matches('input') && validate(e.target));
  form.addEventListener('input', (e) => {
    if (e.target.checkValidity()) e.target.closest('.field')?.classList.remove('field--invalid');
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const inputs = [...form.querySelectorAll('input[required]')];
    inputs.forEach(validate);
    const bad = inputs.find((i) => !i.checkValidity());
    if (bad) return bad.focus();
    // Сюда подключается отправка в CRM / Telegram-бот / почту.
    console.info('Заявка', Object.fromEntries(new FormData(form)));
    form.querySelector('.form__success').hidden = false;
    form.querySelector('button[type=submit]').disabled = true;
  });
}

export function scrollToVh(vh) {
  window.scrollTo({ top: (vh / 100) * window.innerHeight, behavior: 'smooth' });
}

export function initUI() {
  const stops = [
    { label: 'Старт', p: 0 },
    ...LOCATIONS.map((l, i) => ({ label: l.name, p: locationStart(i) })),
    { label: 'Заявка', p: 'contact' },
  ];
  const go = (p) => (p === 'contact' ? $('#contact').scrollIntoView({ behavior: 'smooth' }) : scrollToVh(p));

  $('#rail').innerHTML = stops.map((s, i) =>
    `<button class="rail__item" data-stop="${i}"><i></i><span>${s.label}</span></button>`).join('');
  $('#topnav').innerHTML = LOCATIONS.map((l, i) => `<a href="#${l.id}" data-stop="${i + 1}">${l.name}</a>`).join('')
    + '<a href="#contact" data-stop="4">Контакты</a>';
  document.addEventListener('click', (e) => {
    const stop = e.target.closest('[data-stop]');
    if (stop) {
      e.preventDefault();
      go(stops[+stop.dataset.stop].p);
    }
    if (e.target.closest('[data-goto]')) {
      e.preventDefault();
      go(0);
    }
  });

  $('#contactList').innerHTML = `
    <li><span>Телефон</span><a href="tel:${AGENCY.phone.replace(/[^\d+]/g, '')}">${AGENCY.phone}</a></li>
    <li><span>Почта</span><a href="mailto:${AGENCY.email}">${AGENCY.email}</a></li>
    <li><span>Работаем</span>${AGENCY.address}</li>`;
  $('#year').textContent = new Date().getFullYear();

  const contactForm = $('#contactForm');
  contactForm.innerHTML = formFields('c', false);
  bindForm(contactForm);

  const modal = $('#bookModal');
  const bookForm = $('#bookForm');
  bookForm.innerHTML = formFields('b', true);
  bindForm(bookForm);
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-book]');
    if (trigger) {
      const { book, package: pkg } = trigger.dataset;
      const select = bookForm.querySelector('select');
      if (book && pkg) select.value = `${book}:${pkg}`;
      bookForm.querySelector('.form__success').hidden = true;
      bookForm.querySelector('button[type=submit]').disabled = false;
      modal.showModal();
      bookForm.querySelector('input').focus();
    }
    if (e.target.closest('[data-close]') || e.target === modal) modal.close();
  });

  const rail = [...document.querySelectorAll('.rail__item')];
  const top = [...document.querySelectorAll('#topnav a')];
  const loc = $('#locTitle');
  let lastLoc = -1;

  return {
    // active: индекс пункта маршрута; title: { index, opacity } для большого заголовка локации.
    update({ active, title, heroOpacity, finaleOpacity, progress }) {
      $('#finale').style.opacity = finaleOpacity;
      $('#finale').style.pointerEvents = finaleOpacity > 0.5 ? 'auto' : 'none';
      rail.forEach((el, i) => el.classList.toggle('is-active', i === active));
      top.forEach((el) => el.classList.toggle('is-active', +el.dataset.stop === active));
      $('#hero').style.opacity = heroOpacity;
      $('#hero').style.transform = `translateY(${(1 - heroOpacity) * -40}px)`;
      $('#scrollHint').style.opacity = heroOpacity;
      $('#progressBar').style.transform = `scaleX(${progress})`;
      if (title.index !== lastLoc && title.index >= 0) {
        const l = LOCATIONS[title.index];
        loc.querySelector('.loc-title__index').textContent = `${l.index} / 03`;
        loc.querySelector('.loc-title__name').textContent = l.name;
        loc.querySelector('.loc-title__region').textContent = l.region;
        loc.querySelector('.loc-title__tagline').textContent = l.tagline;
        lastLoc = title.index;
      }
      loc.style.opacity = title.opacity;
      $('#scrim').style.opacity = title.opacity;
      loc.style.transform = `translateY(${(1 - title.opacity) * 30}px)`;
    },
  };
}
