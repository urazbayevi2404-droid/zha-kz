const app = document.querySelector('#app');
const stages = ['Начало', 'Развилка', 'Последствия'];
const maximumChoices = 4;
const noAnswerLabel = 'Ни один не подходит';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const route = [];

function shuffle(options) {
  for (let index = options.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [options[index], options[swap]] = [options[swap], options[index]];
  }
  return options;
}

function showScreen(markup, moveFocus = true) {
  app.innerHTML = markup;
  window.scrollTo(0, 0);
  if (moveFocus) app.querySelector('h1')?.focus({ preventScroll: true });
}

function paragraphs(content) {
  const list = Array.isArray(content) ? content : String(content ?? '').split(/\n\s*\n/);
  return list.map(text => `<p>${text}</p>`).join('');
}

function showIntro(moveFocus) {
  const cover = (EDITION.cover?.length ? EDITION.cover : [EDITION.title]).map(line => `<span>${line}</span>`).join('');
  showScreen(`
    <section class="intro" aria-labelledby="intro-title">
      <div class="panel intro-glass">
        <h1 id="intro-title" tabindex="-1">${cover}</h1>
        <p class="intro-subtitle">${EDITION.subtitle}</p>
        <button class="button button-primary" id="open-quiz" type="button">Начать</button>
      </div>
    </section>
  `, moveFocus);
  app.querySelector('#open-quiz').addEventListener('click', showWelcome);
}

function showWelcome() {
  showScreen(`
    <section class="panel welcome" aria-labelledby="welcome-title">
      <p class="label">${EDITION.title}</p>
      <h1 class="display-title" id="welcome-title" tabindex="-1">История решений</h1>
      <p class="welcome-lead">Прочитай сцену до конца и проверь свои ответы по её деталям. От моих решений зависит, что произойдёт с остановкой и людьми вокруг неё.</p>
      <ol class="rules">
        <li><span class="rule-number" aria-hidden="true">01</span> В обычной сцене найди четыре подходящих варианта из восьми.</li>
        <li><span class="rule-number" aria-hidden="true">02</span> Можно проверить часть ответов или выбрать ${noAnswerLabel}.</li>
        <li><span class="rule-number" aria-hidden="true">03</span> После трёх сцен ты увидишь свой маршрут и итог истории.</li>
      </ol>
      <button class="button button-primary" id="start-run" type="button">Начать тест</button>
    </section>
  `);
  app.querySelector('#start-run').addEventListener('click', () => {
    route.length = 0;
    showCase('vn');
  });
}

function stageList(current) {
  return stages.map((name, index) => `
    <li ${index === current ? 'aria-current="step"' : ''} class="${index < current ? 'completed' : ''}">
      <span class="step-number" aria-hidden="true">${index + 1}</span>
      <span>${name}</span>
    </li>
  `).join('');
}

function optionList(options) {
  return options.map(({ text }, index) => `
    <button class="option" type="button" role="checkbox" aria-checked="false" data-index="${index}">
      <span class="option-mark" aria-hidden="true"></span>
      <span>${text}<span class="option-status" hidden></span></span>
    </button>
  `).join('');
}

function showCase(id) {
  const current = CASES[id];
  const level = route.length;
  const options = shuffle([
    ...current.correct.map(([text, why]) => ({ text, why, correct: true })),
    ...current.other.map(([text, why]) => ({ text, why, correct: false })),
  ]);
  const previous = route.at(-1);
  const trace = previous ? `
    <p class="scene-trace">В предыдущей сцене у тебя ${previous.score} из ${previous.max} верных.</p>
  ` : '';

  showScreen(`
    <ol class="progress" aria-label="Уровни квиза">${stageList(level)}</ol>
    <section class="panel story" aria-labelledby="case-title">
      <p class="label">${stages[level]}</p>
      <h1 class="display-title" id="case-title" tabindex="-1">${current.title}</h1>
      ${trace}
      <div class="story-copy">${paragraphs(current.story)}</div>
    </section>
    <section class="question" aria-labelledby="question-title">
      <div class="question-head">
        <h2 id="question-title">${current.question}</h2>
        <p class="question-hint" id="question-hint">${current.hint || 'Выбери до четырёх вариантов.'}</p>
        <span class="selection" aria-live="polite" aria-label="Выбрано 0 из 4">0 / 4</span>
      </div>
      <div class="options" role="group" aria-labelledby="question-title" aria-describedby="question-hint">${optionList(options)}</div>
      <div class="actions">
        <button class="button button-primary" id="check-answers" type="button" disabled>Проверить ответы</button>
        <button class="button button-secondary" id="no-answers" type="button" aria-pressed="false">${noAnswerLabel}</button>
      </div>
      <p class="choice-note" role="status"></p>
    </section>
    <section class="panel feedback" aria-labelledby="feedback-title" hidden></section>
  `);

  const choices = new Set();
  const cards = [...app.querySelectorAll('.option')];
  const counter = app.querySelector('.selection');
  const check = app.querySelector('#check-answers');
  const none = app.querySelector('#no-answers');
  const choiceNote = app.querySelector('.choice-note');
  let choseNone = false;

  function updateChoices() {
    for (const [index, card] of cards.entries()) {
      const active = choices.has(index);
      card.setAttribute('aria-checked', String(active));
      card.querySelector('.option-mark').textContent = active ? '✓' : '';
    }
    counter.textContent = `${choices.size} / ${maximumChoices}`;
    counter.setAttribute('aria-label', `Выбрано ${choices.size} из ${maximumChoices}`);
    counter.classList.toggle('full', choices.size === maximumChoices);
    none.setAttribute('aria-pressed', String(choseNone));
    check.disabled = choices.size === 0 && !choseNone;
    choiceNote.textContent = '';
  }

  for (const [index, card] of cards.entries()) {
    card.addEventListener('click', () => {
      if (choices.has(index)) choices.delete(index);
      else if (choices.size < maximumChoices) choices.add(index);
      else {
        choiceNote.textContent = 'Сними один ответ, чтобы выбрать другой.';
        return;
      }
      choseNone = false;
      updateChoices();
    });
  }

  none.addEventListener('click', () => {
    choseNone = !choseNone;
    choices.clear();
    updateChoices();
  });

  check.addEventListener('click', () => {
    check.disabled = true;
    app.querySelector('.actions').hidden = true;
    choiceNote.textContent = '';
    const selected = options.filter((_, index) => choices.has(index));
    const score = selected.filter(option => option.correct).length;
    const max = current.correct.length;
    const result = { id, score, max, trapSolved: max === 0 && choseNone };
    route.push(result);
    revealOptions(cards, options, choices);
    showFeedback(current, selected, level, result);
  }, { once: true });
}

const answerStates = {
  right: { mark: '✓', label: 'Верно' },
  missed: { mark: '○', label: 'Подходит, пропущено' },
  wrong: { mark: '×', label: 'Не подходит' },
  idle: { mark: '–', label: 'Не подходит' },
};

function revealOptions(cards, options, choices) {
  for (const [index, card] of cards.entries()) {
    const selected = choices.has(index);
    const outcome = options[index].correct ? (selected ? 'right' : 'missed') : (selected ? 'wrong' : 'idle');
    card.disabled = true;
    card.dataset.outcome = outcome;
    card.style.setProperty('--reveal-delay', `${index * 25}ms`);
    card.querySelector('.option-mark').textContent = answerStates[outcome].mark;
    const status = card.querySelector('.option-status');
    status.textContent = answerStates[outcome].label;
    status.hidden = false;
  }
}

function showFeedback(current, selected, level, { score, max, trapSolved }) {
  const feedback = app.querySelector('.feedback');
  const isFinal = level === stages.length - 1;
  const title = max ? 'Разбор ситуации' : 'Здесь не подошёл ни один план';
  const scoreMarkup = max ? `<div class="case-score"><strong>${score} / ${max}</strong><span>верных</span></div>` : '';
  const explanationTitle = trapSolved
    ? 'Почему этот ответ верный'
    : score === maximumChoices ? 'Разобрать выбранные варианты' : 'Работа над ошибками';
  const explained = selected.length ? selected : [{
    text: noAnswerLabel,
    correct: trapSolved,
    why: trapSolved
      ? current.noneWhy
      : 'У этой сцены четыре подходящих ответа. Обрати внимание на детали места, времени и действия.',
  }];
  feedback.innerHTML = `
    <div class="feedback-top">
      <div>${trapSolved ? '<p class="label">Особая задача решена</p>' : ''}<h2 id="feedback-title" tabindex="-1">${title}</h2></div>
      ${scoreMarkup}
    </div>
    <p class="takeaway">${current.takeaway}</p>
    <details class="explanations">
      <summary>${explanationTitle}</summary>
      <ul>${explained.map(({ text, why, correct }) => `
        <li>
          <span class="explanation-status" data-correct="${correct}">${correct ? 'Верно' : 'Не подходит'}</span>
          <strong>${text}</strong>
          <p>${why}</p>
        </li>`).join('')}</ul>
    </details>
    <button class="button button-primary" id="continue-run" type="button">${isFinal ? 'Узнать результат' : 'Продолжить'}</button>
  `;
  feedback.hidden = false;
  feedback.querySelector('h2').focus({ preventScroll: true });
  feedback.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'nearest' });
  feedback.querySelector('#continue-run').addEventListener('click', advance);
}

function advance() {
  const { id, score } = route.at(-1);
  if (route.length === stages.length) {
    showResult(id);
    return;
  }
  const branch = score === 4 ? 3 : score >= 2 ? 2 : 1;
  showCase(id === 'vn' ? `v${branch}` : `${id}_${branch}`);
}

function scoreSummary() {
  const total = route.reduce((points, item) => points + item.score, 0);
  const max = route.reduce((points, item) => points + item.max, 0);
  const rows = route.map((item, index) => item.max
    ? `<li><strong>${item.score} / ${item.max}</strong><span>${stages[index]}</span></li>`
    : `<li><strong class="score-trap">${item.trapSolved ? 'Решена' : 'Не решена'}</strong><span>Особая задача</span></li>`);
  return `${rows.join('')}<li><strong>${total} / ${max}</strong><span>Всего</span></li>`;
}

function showResult(id) {
  const profile = PROFILES[id];
  const recap = EDITION.recap.map(({ title, text }) => `
    <article><h3>${title}</h3><p>${text}</p></article>
  `).join('');
  showScreen(`
    <section class="result" aria-labelledby="result-title">
      <ol class="route" aria-label="Маршрут прохождения">
        ${route.map(({ id: step }) => `<li>${CASES[step].title}</li>`).join('')}
      </ol>
      <div class="panel result-card">
        <p class="label">${EDITION.title}</p>
        <h1 class="display-title" id="result-title" tabindex="-1">${profile.title}</h1>
        <div class="result-stars">
          <span class="stars" aria-hidden="true">${'★'.repeat(profile.stars)}${'☆'.repeat(5 - profile.stars)}</span>
          <span class="star-caption">Сложность маршрута ${profile.stars} из 5</span>
        </div>
        <p class="profile-description">${profile.description}</p>
        <div class="advice"><h2>Что попробовать</h2><p>${profile.advice}</p></div>
      </div>
      <ul class="score-summary" aria-label="Баллы по уровням">${scoreSummary()}</ul>
      <section class="recap" aria-labelledby="recap-title">
        <h2 id="recap-title">Что можно применить в своём деле</h2>
        <div class="recap-grid">${recap}</div>
        <p class="recap-example">${EDITION.finalPrompt}</p>
      </section>
      <button class="button button-secondary" id="restart-run" type="button">
        Начать заново
      </button>
    </section>
  `);
  app.querySelector('#restart-run').addEventListener('click', () => showIntro(true));
}

document.title = `${EDITION.title} | Жаңа адамдар`;
const description = document.querySelector('meta[name="description"]');
if (description) description.content = EDITION.subtitle;
showIntro(false);

