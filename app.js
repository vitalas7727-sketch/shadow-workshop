'use strict';

const STORAGE_KEY = 'shadowWorkshop.mvp.v01';

const DEFAULT_STATE = {
  materials: [],
  tasks: [],
  answers: [],
  comparisons: [],
  decisions: [],
  settings: {
    noxChatUrl: '',
    ravenChatUrl: '',
    projectContext: 'Главный герой — взрослый узнаваемый сиамский кот с голубыми глазами. Мир: мистическое фэнтези. Оригинальные черты Семёна и утверждённые элементы нельзя менять без решения Виталия.'
  }
};

let state = loadState();
let currentPrompt = { text: '', chatUrl: '', helper: '' };
let toastTimer;
let currentView = 'home';
let viewHistory = [];

function $(selector, parent = document) {
  return parent.querySelector(selector);
}

function $all(selector, parent = document) {
  return [...parent.querySelectorAll(selector)];
}

function on(selector, eventName, handler) {
  const element = $(selector);
  if (element) element.addEventListener(eventName, handler);
  return element;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');

    if (!saved || typeof saved !== 'object') {
      return structuredClone(DEFAULT_STATE);
    }

    return {
      materials: Array.isArray(saved.materials) ? saved.materials : [],
      tasks: Array.isArray(saved.tasks) ? saved.tasks : [],
      answers: Array.isArray(saved.answers) ? saved.answers : [],
      comparisons: Array.isArray(saved.comparisons) ? saved.comparisons : [],
      decisions: Array.isArray(saved.decisions) ? saved.decisions : [],
      settings: {
        ...DEFAULT_STATE.settings,
        ...(saved.settings || {})
      }
    };
  } catch (error) {
    console.warn('Не удалось прочитать журнал:', error);
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updateCounters();
    return true;
  } catch (error) {
    console.error(error);
    showToast('Не удалось сохранить данные. Возможно, закончилось место в браузере. Экспортируй журнал в JSON.');
    return false;
  }
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function niceDate(value) {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(value));
  } catch {
    return '';
  }
}

function fileSize(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function showToast(message) {
  const toast = $('#toast');
  if (!toast) {
    console.log(message);
    return;
  }

  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function titleForView(view) {
  return ({
    home: 'ОБЗОР',
    materials: 'МАТЕРИАЛЫ',
    tasks: 'ЗАДАЧИ',
    answers: 'ОТВЕТЫ И СРАВНЕНИЕ',
    decisions: 'РЕШЕНИЯ',
    settings: 'НАСТРОЙКИ'
  })[view] || 'ОБЗОР';
}

function goTo(view, addToHistory = true) {
  if (!document.querySelector(`#view-${view}`)) return;

  if (view !== currentView && addToHistory) {
    viewHistory.push(currentView);
    window.history.pushState({ view }, '', `#${view}`);
  }

  currentView = view;

  $all('.view').forEach(element => {
    element.classList.toggle('active', element.id === `view-${view}`);
  });

  $all('.nav-item').forEach(element => {
    element.classList.toggle('active', element.dataset.view === view);
  });

  const crumbTitle = $('#crumbTitle');
  if (crumbTitle) crumbTitle.textContent = titleForView(view);

  closeMobileNav();

  if (view === 'home') renderHome();
  if (view === 'materials') renderMaterials();
  if (view === 'tasks') renderTasks();
  if (view === 'answers') refreshAnswerTaskSelect();
  if (view === 'decisions') renderDecisions();
  if (view === 'settings') fillSettings();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goBack() {
  if (viewHistory.length > 0) {
    const previousView = viewHistory.pop();
    goTo(previousView, false);
  } else {
    goTo('home', false);
  }
}

function openMobileNav() {
  const sidebar = $('.sidebar');
  const mask = $('#mobileNavMask');

  if (sidebar) sidebar.classList.add('open');
  if (mask) mask.classList.add('visible');
}

function closeMobileNav() {
  const sidebar = $('.sidebar');
  const mask = $('#mobileNavMask');

  if (sidebar) sidebar.classList.remove('open');
  if (mask) mask.classList.remove('visible');
}

function updateCounters() {
  const openTasks = state.tasks.filter(task =>
    !['Завершена', 'Отложена'].includes(task.status)
  ).length;

  const counters = {
    '#navOpenCount': openTasks,
    '#navMaterialCount': state.materials.length,
    '#navTaskCount': state.tasks.length,
    '#statMaterials': state.materials.length,
    '#statTasks': openTasks,
    '#statAnswers': state.answers.length,
    '#statDecisions': state.decisions.length
  };

  Object.entries(counters).forEach(([selector, value]) => {
    const element = $(selector);
    if (element) element.textContent = value;
  });
}

function typeIcon(type) {
  const icons = {
    'Видео': '▶',
    'Аудио/музыка': '♫',
    'Сценарий/текст': 'T',
    'Документ': '▤',
    'Референс': '◇',
    'Другое': '◈'
  };

  return icons[String(type || '').trim()] || '◈';
}

function renderHome() {
  updateCounters();

  const container = $('#recentTasks');
  if (!container) return;

  const recent = [...state.tasks]
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 3);

  if (!recent.length) {
    container.className = 'empty-state';
    container.innerHTML = `
      <div class="empty-icon">☷</div>
      <b>Пока задач нет</b>
      <p>Создай первую задачу — например, проверить кадр Семёна на непрерывность внешности.</p>
      <button class="btn btn-small btn-secondary" data-go="tasks">Создать задачу</button>
    `;
    return;
  }

  container.className = 'task-list compact-list';

  container.innerHTML = recent.map(task => `
    <article class="task-card">
      <div class="task-number">${escapeHtml(String(task.id || '').slice(-3).toUpperCase())}</div>
      <div class="task-card-body">
        <div class="task-title-row">
          <h3>${escapeHtml(task.title)}</h3>
          ${statusPill(task.status)}
        </div>
        <p class="task-desc">${escapeHtml(task.goal)}</p>
        <div class="material-meta">
          <span>${niceDate(task.createdAt)}</span>
          <span>•</span>
          <span>${escapeHtml(task.priority || '')} приоритет</span>
        </div>
        <div class="task-actions">
          <button class="mini-btn primary" data-task-action="sendNox" data-id="${escapeHtml(task.id)}">↗ Ноксу</button>
          <button class="mini-btn primary" data-task-action="sendRaven" data-id="${escapeHtml(task.id)}">↗ Ворону</button>
          <button class="mini-btn" data-task-action="answers" data-id="${escapeHtml(task.id)}">Ответы / сравнение</button>
        </div>
      </div>
    </article>
  `).join('');
}

function statusPill(status) {
  const klass = status === 'Завершена'
    ? 'complete'
    : ['На рассмотрении', 'Ожидает ответов'].includes(status)
      ? 'review'
      : '';

  return `<span class="pill ${klass}">${escapeHtml(status || 'Новая')}</span>`;
}

function renderMaterials() {
  const search = $('#materialSearch');
  const filterElement = $('#materialFilter');
  const container = $('#materialList');

  if (!container) return;

  const query = (search?.value || '').trim().toLocaleLowerCase('ru');
  const filter = filterElement?.value || 'all';

  const list = state.materials
    .filter(material =>
      (filter === 'all' || material.type === filter) &&
      `${material.title || ''} ${material.description || ''} ${material.fileName || ''} ${material.type || ''}`
        .toLocaleLowerCase('ru')
        .includes(query)
    )
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (!list.length) {
    container.innerHTML = `
      <div class="panel empty-state">
        <div class="empty-icon">▧</div>
        <b>${state.materials.length ? 'Ничего не найдено' : 'Медиатека пока пустая'}</b>
        <p>${state.materials.length
          ? 'Попробуй изменить поисковую фразу или фильтр.'
          : 'Добавь запись об исходнике, вставь ссылку на Google Drive и укажи, что в нём важно.'}</p>
        ${state.materials.length ? '' : '<button class="btn btn-small btn-secondary" id="emptyAddMaterial">Добавить материал</button>'}
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(material => `
    <article class="material-card">
      <div class="material-icon">${typeIcon(material.type)}</div>
      <div class="material-main">
        <h3>${escapeHtml(material.title)}</h3>
        <div class="material-meta">
          <span>${escapeHtml(material.type)}</span>
          <span>•</span>
          <span>${niceDate(material.createdAt)}</span>
          ${material.fileName
            ? `<span>• ${escapeHtml(material.fileName)}${material.fileSize ? ` (${escapeHtml(material.fileSize)})` : ''}</span>`
            : ''}
        </div>
        ${material.description
          ? `<p class="material-desc">${escapeHtml(material.description)}</p>`
          : ''}
        ${material.link
          ? `<a class="material-link" href="${escapeHtml(material.link)}" target="_blank" rel="noopener noreferrer">Открыть ссылку ↗</a>`
          : ''}
      </div>
      <div class="card-actions">
        <button class="mini-btn" data-material-action="makeTask" data-id="${escapeHtml(material.id)}">＋ Задача</button>
        <button class="mini-btn" data-material-action="delete" data-id="${escapeHtml(material.id)}">Удалить запись</button>
      </div>
    </article>
  `).join('');
}

function refreshTaskMaterialSelect() {
  const select = $('#taskMaterial');

  if (select) {
    const current = select.value;

    select.innerHTML = '<option value="">Без привязки</option>' +
      state.materials.map(material =>
        `<option value="${escapeHtml(material.id)}">${escapeHtml(material.title)}</option>`
      ).join('');

    if ([...select.options].some(option => option.value === current)) {
      select.value = current;
    }
  }

  const decisionSelect = $('#decisionTask');

  if (decisionSelect) {
    const previous = decisionSelect.value;

    decisionSelect.innerHTML = '<option value="">Без привязки</option>' +
      state.tasks.map(task =>
        `<option value="${escapeHtml(task.id)}">${escapeHtml(task.title)}</option>`
      ).join('');

    if ([...decisionSelect.options].some(option => option.value === previous)) {
      decisionSelect.value = previous;
    }
  }
}

function renderTasks() {
  refreshTaskMaterialSelect();

  const search = $('#taskSearch');
  const filterElement = $('#taskFilter');
  const container = $('#taskList');

  if (!container) return;

  const query = (search?.value || '').trim().toLocaleLowerCase('ru');
  const filter = filterElement?.value || 'all';

  const list = state.tasks
    .filter(task =>
      (filter === 'all' || task.status === filter) &&
      `${task.title || ''} ${task.goal || ''} ${task.context || ''}`
        .toLocaleLowerCase('ru')
        .includes(query)
    )
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (!list.length) {
    container.innerHTML = `
      <div class="panel empty-state">
        <div class="empty-icon">☷</div>
        <b>${state.tasks.length ? 'Задачи не найдены' : 'Пока задач нет'}</b>
        <p>${state.tasks.length
          ? 'Попробуй другой поиск или статус.'
          : 'Начни с конкретной задачи. Например: проверить, не изменились ли глаза Семёна в серии кадров.'}</p>
        ${state.tasks.length ? '' : '<button class="btn btn-small btn-secondary" id="emptyAddTask">＋ Создать задачу</button>'}
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(task => {
    const material = state.materials.find(item => item.id === task.materialId);
    const hasNox = state.answers.some(answer =>
      answer.taskId === task.id && answer.helper === 'Нокс'
    );
    const hasRaven = state.answers.some(answer =>
      answer.taskId === task.id && answer.helper === 'Ворон'
    );

    return `
      <article class="task-card">
        <div class="task-number">${escapeHtml(String(task.id || '').slice(-3).toUpperCase())}</div>
        <div class="task-card-body">
          <div class="task-topline">
            <div class="task-main">
              <div class="task-title-row">
                <h3>${escapeHtml(task.title)}</h3>
                ${statusPill(task.status)}
                <span class="pill ${['Срочный', 'Высокий'].includes(task.priority) ? 'high' : ''}">${escapeHtml(task.priority || '')}</span>
              </div>
              <p class="task-desc">${escapeHtml(task.goal)}</p>
              <div class="material-meta">
                <span>${niceDate(task.createdAt)}</span>
                ${material ? `<span>• Материал: ${escapeHtml(material.title)}</span>` : ''}
                <span>• Нокс: ${hasNox ? 'ответ сохранён' : 'нет ответа'}</span>
                <span>• Ворон: ${hasRaven ? 'ответ сохранён' : 'нет ответа'}</span>
              </div>
            </div>
            <select class="task-status-select" data-status-id="${escapeHtml(task.id)}" aria-label="Статус задачи">
              ${['Новая', 'Отправлено', 'Ожидает ответов', 'На рассмотрении', 'Завершена', 'Отложена']
                .map(status => `<option ${task.status === status ? 'selected' : ''}>${status}</option>`)
                .join('')}
            </select>
          </div>
          <div class="task-actions">
            <button class="mini-btn primary" data-task-action="sendNox" data-id="${escapeHtml(task.id)}">↗ Передать Ноксу</button>
            <button class="mini-btn primary" data-task-action="sendRaven" data-id="${escapeHtml(task.id)}">↗ Передать Ворону</button>
            <button class="mini-btn" data-task-action="answers" data-id="${escapeHtml(task.id)}">⇄ Ответы / сравнение</button>
            <button class="mini-btn" data-task-action="decision" data-id="${escapeHtml(task.id)}">✓ Записать решение</button>
            <button class="mini-btn" data-task-action="delete" data-id="${escapeHtml(task.id)}">Удалить</button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function refreshAnswerTaskSelect() {
  const select = $('#answerTaskSelect');
  if (!select) return;

  const previous = select.value;

  select.innerHTML = state.tasks.length
    ? '<option value="">Выбери задачу</option>' +
      state.tasks.map(task =>
        `<option value="${escapeHtml(task.id)}">${escapeHtml(task.title)}</option>`
      ).join('')
    : '<option value="">Сначала создай задачу</option>';

  if ([...select.options].some(option => option.value === previous)) {
    select.value = previous;
  }

  if (select.value) {
    loadAnswerFields(select.value);
  } else {
    const summary = $('#selectedTaskSummary');
    if (summary) summary.textContent = 'Выбери задачу, чтобы сохранить ответы Нокса и Ворона.';

    ['#noxAnswerText', '#ravenAnswerText', '#compareAgree', '#compareDiff', '#compareQuestions']
      .forEach(selector => {
        const element = $(selector);
        if (element) element.value = '';
      });
  }
}

function loadAnswerFields(taskId) {
  const task = state.tasks.find(item => item.id === taskId);
  if (!task) return;

  const material = state.materials.find(item => item.id === task.materialId);
  const summary = $('#selectedTaskSummary');

  if (summary) {
    summary.innerHTML =
      `<b>${escapeHtml(task.title)}</b><br>${escapeHtml(task.goal)}` +
      (material
        ? `<br><span>Материал: ${escapeHtml(material.title)}${material.link
          ? ` · <a href="${escapeHtml(material.link)}" target="_blank" rel="noopener noreferrer">открыть</a>`
          : ''}</span>`
        : '');
  }

  const noxAnswer = $('#noxAnswerText');
  const ravenAnswer = $('#ravenAnswerText');

  if (noxAnswer) {
    noxAnswer.value = state.answers.find(answer =>
      answer.taskId === taskId && answer.helper === 'Нокс'
    )?.text || '';
  }

  if (ravenAnswer) {
    ravenAnswer.value = state.answers.find(answer =>
      answer.taskId === taskId && answer.helper === 'Ворон'
    )?.text || '';
  }

  const comparison = state.comparisons.find(item => item.taskId === taskId);

  if ($('#compareAgree')) $('#compareAgree').value = comparison?.agree || '';
  if ($('#compareDiff')) $('#compareDiff').value = comparison?.diff || '';
  if ($('#compareQuestions')) $('#compareQuestions').value = comparison?.questions || '';
}

function renderDecisions() {
  const container = $('#decisionList');
  if (!container) return;

  const list = [...state.decisions]
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (!list.length) {
    container.innerHTML = `
      <div class="panel empty-state">
        <div class="empty-icon">✓</div>
        <b>Решений пока нет</b>
        <p>Сохраняй утверждённые варианты, причины и вопросы, которые нужно проверить позже.</p>
        <button id="emptyAddDecision" class="btn btn-small btn-secondary">Записать решение</button>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(decision => {
    const task = state.tasks.find(item => item.id === decision.taskId);
    const color = decision.status === 'Утверждено'
      ? 'complete'
      : decision.status === 'На рассмотрении'
        ? 'review'
        : '';

    return `
      <article class="decision-card">
        <div class="material-icon green">✓</div>
        <div class="decision-main">
          <div class="task-title-row">
            <h3>${escapeHtml(decision.title)}</h3>
            <span class="pill ${color}">${escapeHtml(decision.status)}</span>
          </div>
          <p class="decision-reason">${escapeHtml(decision.reason || 'Причина не указана.')}</p>
          <div class="material-meta">
            <span>${niceDate(decision.createdAt)}</span>
            ${task ? `<span>• Задача: ${escapeHtml(task.title)}</span>` : ''}
          </div>
        </div>
        <button class="mini-btn" data-decision-delete="${escapeHtml(decision.id)}">Удалить</button>
      </article>
    `;
  }).join('');
}

function newTaskPrompt(task, helper) {
  const material = state.materials.find(item => item.id === task.materialId);

  const helperRole = helper === 'Нокс'
    ? 'Творческий и технический анализ. Проверь визуальную непрерывность, драматургию и предложи практические исправления.'
    : 'Независимая критическая проверка. Проверь логику, непрерывность, ограничения, риски и укажи, что нельзя подтвердить по исходным данным.';

  const lines = [
    'Задача из Shadow Workshop для проекта «Семён — Охотник теней».',
    `РОЛЬ: ${helper}. ${helperRole}`,
    '',
    `НАЗВАНИЕ: ${task.title}`,
    `ЧТО НУЖНО СДЕЛАТЬ: ${task.goal}`,
    task.context ? `ДОПОЛНИТЕЛЬНЫЙ КОНТЕКСТ: ${task.context}` : '',
    state.settings.projectContext
      ? `ПОСТОЯННЫЕ ПРАВИЛА ПРОЕКТА: ${state.settings.projectContext}`
      : '',
    material ? `СВЯЗАННЫЙ МАТЕРИАЛ: ${material.title} (${material.type})` : '',
    material?.link ? `ССЫЛКА НА МАТЕРИАЛ: ${material.link}` : '',
    material?.fileName && !material?.link
      ? `ИМЯ ФАЙЛА: ${material.fileName}. Файл не прикреплён к этому сообщению; если нужен его визуальный или аудиальный анализ, попроси Виталия прикрепить файл отдельно.`
      : '',
    '',
    'Формат ответа:',
    '1. Что удалось надёжно установить.',
    '2. Найденные проблемы с таймкодами (если они есть).',
    '3. Предлагаемые исправления.',
    '4. Что осталось неясным и требует проверки.',
    'Не придумывай содержимое материала, если не можешь его открыть. Не меняй утверждённые решения без согласования с Виталием.'
  ].filter(Boolean);

  return lines.join('\n');
}

function beginSend(taskId, helper) {
  const task = state.tasks.find(item => item.id === taskId);

  if (!task) {
    showToast('Задача не найдена.');
    return;
  }

  currentPrompt = {
    text: newTaskPrompt(task, helper),
    chatUrl: helper === 'Нокс'
      ? state.settings.noxChatUrl
      : state.settings.ravenChatUrl,
    helper
  };

  if ($('#modalTitle')) $('#modalTitle').textContent = `Передать задачу · ${helper}`;

  if ($('#modalDescription')) {
    $('#modalDescription').textContent =
      `Сообщение подготовлено отдельно для ${helper}. Скопируй текст, открой чат, вставь и отправь вручную.`;
  }

  if ($('#promptPreview')) $('#promptPreview').value = currentPrompt.text;

  if ($('#openChat')) {
    $('#openChat').textContent = currentPrompt.chatUrl
      ? 'Открыть чат'
      : 'Настроить ссылку на чат';
  }

  if ($('#modalBackdrop')) $('#modalBackdrop').classList.remove('hidden');
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      showToast('Сообщение скопировано. Теперь можно открыть чат.');
      return true;
    }

    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';

    document.body.appendChild(area);
    area.select();

    const ok = document.execCommand('copy');
    area.remove();

    if (!ok) throw new Error('Копирование не удалось');

    showToast('Сообщение скопировано.');
    return true;
  } catch (error) {
    const preview = $('#promptPreview');

    if (preview) {
      preview.focus();
      preview.select();
    }

    showToast('Автокопирование недоступно. Выдели текст и выбери «Копировать» в меню.');
    return false;
  }
}

function saveAnswer(helper, text) {
  const taskId = $('#answerTaskSelect')?.value;

  if (!taskId) {
    showToast('Сначала выбери задачу.');
    return false;
  }

  if (!text.trim()) {
    showToast('Вставь ответ перед сохранением.');
    return false;
  }

  const existing = state.answers.find(answer =>
    answer.taskId === taskId && answer.helper === helper
  );

  if (existing) {
    existing.text = text.trim();
    existing.updatedAt = Date.now();
  } else {
    state.answers.push({
      id: uid('ans'),
      taskId,
      helper,
      text: text.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  const task = state.tasks.find(item => item.id === taskId);
  const hasNox = state.answers.some(answer =>
    answer.taskId === taskId && answer.helper === 'Нокс'
  );
  const hasRaven = state.answers.some(answer =>
    answer.taskId === taskId && answer.helper === 'Ворон'
  );

  if (task && hasNox && hasRaven && !['Завершена', 'Отложена'].includes(task.status)) {
    task.status = 'На рассмотрении';
  } else if (task && task.status === 'Новая') {
    task.status = 'Ожидает ответов';
  }

  saveState();
  renderHome();
  renderTasks();
  refreshAnswerTaskSelect();

  const select = $('#answerTaskSelect');
  if (select) select.value = taskId;

  loadAnswerFields(taskId);
  showToast(`Ответ ${helper} сохранён отдельно.`);
  return true;
}

function openForm(formId) {
  const form = $(`#${formId}`);
  if (!form) return;

  form.classList.remove('hidden');
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeForm(formId) {
  const form = $(`#${formId}`);
  if (form) form.classList.add('hidden');
}

function startNewTask(prefillMaterialId = '') {
  goTo('tasks');

  const form = $('#taskForm');
  if (form) form.classList.remove('hidden');

  refreshTaskMaterialSelect();

  if (prefillMaterialId && $('#taskMaterial')) {
    $('#taskMaterial').value = prefillMaterialId;
  }

  $('#taskTitle')?.focus({ preventScroll: true });
}

function startNewDecision(taskId = '') {
  goTo('decisions');

  const form = $('#decisionForm');
  if (form) form.classList.remove('hidden');

  refreshTaskMaterialSelect();

  if (taskId && $('#decisionTask')) {
    $('#decisionTask').value = taskId;
  }

  $('#decisionTitle')?.focus({ preventScroll: true });
}

/* Навигация */

$all('.nav-item').forEach(button => {
  button.addEventListener('click', () => goTo(button.dataset.view));
});

$all('[data-go]').forEach(button => {
  button.addEventListener('click', () => goTo(button.dataset.go));
});

on('#openSettingsTop', 'click', () => goTo('settings'));
on('#mobileMenu', 'click', openMobileNav);
on('#homeShortcut', 'click', () => goTo('home'));
on('#backShortcut', 'click', goBack);

window.addEventListener('popstate', () => {
  if (viewHistory.length > 0) {
    goTo(viewHistory.pop(), false);
  } else if (currentView !== 'home') {
    goTo('home', false);
  }
});

const mask = document.createElement('div');
mask.className = 'mobile-nav-mask';
mask.id = 'mobileNavMask';
document.body.appendChild(mask);
mask.addEventListener('click', closeMobileNav);

/* Материалы */

on('#showMaterialForm', 'click', () => openForm('materialForm'));
on('#closeMaterialForm', 'click', () => closeForm('materialForm'));

on('#materialForm', 'submit', event => {
  event.preventDefault();

  const file = $('#materialFile')?.files?.[0];
  const title = $('#materialTitle')?.value.trim() || '';
  const link = $('#materialLink')?.value.trim() || '';

  if (!title) {
    showToast('Укажи название материала.');
    return;
  }

  if (link && !/^https?:\/\//i.test(link)) {
    showToast('Ссылка должна начинаться с https:// или http://');
    return;
  }

  state.materials.push({
    id: uid('mat'),
    title,
    type: $('#materialType')?.value || 'Другое',
    fileName: file?.name || '',
    fileSize: file ? fileSize(file.size) : '',
    mimeType: file?.type || '',
    link,
    description: $('#materialDescription')?.value.trim() || '',
    createdAt: Date.now()
  });

  saveState();
  event.target.reset();
  closeForm('materialForm');
  renderMaterials();
  refreshTaskMaterialSelect();
  renderHome();

  showToast('Материал добавлен в каталог. Сам файл пока не загружен в облако.');
});

on('#materialSearch', 'input', renderMaterials);
on('#materialFilter', 'change', renderMaterials);

on('#materialList', 'click', event => {
  const button = event.target.closest('[data-material-action]');

  if (!button) {
    if (event.target.id === 'emptyAddMaterial') openForm('materialForm');
    return;
  }

  const material = state.materials.find(item => item.id === button.dataset.id);
  if (!material) return;

  if (button.dataset.materialAction === 'makeTask') {
    startNewTask(material.id);
  }

  if (button.dataset.materialAction === 'delete') {
    if (!confirm(`Удалить запись «${material.title}» из каталога? Исходный файл не затрагивается.`)) {
      return;
    }

    state.materials = state.materials.filter(item => item.id !== material.id);

    state.tasks.forEach(task => {
      if (task.materialId === material.id) task.materialId = '';
    });

    saveState();
    renderMaterials();
    refreshTaskMaterialSelect();
    renderHome();

    showToast('Запись удалена. Исходный файл не изменён.');
  }
});

/* Задачи */

on('#showTaskForm', 'click', () => {
  refreshTaskMaterialSelect();
  openForm('taskForm');
});

on('#closeTaskForm', 'click', () => closeForm('taskForm'));

on('#taskForm', 'submit', event => {
  event.preventDefault();

  const title = $('#taskTitle')?.value.trim() || '';
  const goal = $('#taskGoal')?.value.trim() || '';

  if (!title || !goal) {
    showToast('Заполни название и цель задачи.');
    return;
  }

  const task = {
    id: uid('tsk'),
    title,
    goal,
    priority: $('#taskPriority')?.value || 'Обычный',
    materialId: $('#taskMaterial')?.value || '',
    context: $('#taskContext')?.value.trim() || '',
    status: 'Новая',
    createdAt: Date.now()
  };

  state.tasks.push(task);
  saveState();

  event.target.reset();
  closeForm('taskForm');
  renderTasks();
  renderHome();
  refreshAnswerTaskSelect();
  refreshTaskMaterialSelect();

  showToast('Задача создана. Можно передавать помощникам.');
});

on('#taskSearch', 'input', renderTasks);
on('#taskFilter', 'change', renderTasks);

on('#taskList', 'change', event => {
  if (!event.target.matches('[data-status-id]')) return;

  const task = state.tasks.find(item => item.id === event.target.dataset.statusId);
  if (!task) return;

  task.status = event.target.value;
  saveState();
  renderTasks();
  renderHome();

  showToast('Статус задачи обновлён.');
});

document.body.addEventListener('click', event => {
  const goButton = event.target.closest('[data-go]');

  if (goButton) {
    goTo(goButton.dataset.go);
    return;
  }

  const button = event.target.closest('[data-task-action]');

  if (button) {
    const { taskAction, id } = button.dataset;
    const task = state.tasks.find(item => item.id === id);

    if (!task) return;

    if (taskAction === 'sendNox' || taskAction === 'sendRaven') {
      beginSend(id, taskAction === 'sendNox' ? 'Нокс' : 'Ворон');
    }

    if (taskAction === 'answers') {
      goTo('answers');

      if ($('#answerTaskSelect')) {
        $('#answerTaskSelect').value = id;
      }

      loadAnswerFields(id);
    }

    if (taskAction === 'decision') {
      startNewDecision(id);
    }

    if (taskAction === 'delete') {
      if (!confirm(`Удалить задачу «${task.title}»? Связанные ответы и решения также будут удалены.`)) {
        return;
      }

      state.tasks = state.tasks.filter(item => item.id !== id);
      state.answers = state.answers.filter(answer => answer.taskId !== id);
      state.comparisons = state.comparisons.filter(item => item.taskId !== id);
      state.decisions = state.decisions.filter(item => item.taskId !== id);

      saveState();
      renderTasks();
      renderHome();
      refreshAnswerTaskSelect();
      renderDecisions();

      showToast('Задача и её связанные записи удалены.');
    }

    return;
  }

  if (event.target.closest('#emptyAddTask')) {
    openForm('taskForm');
  }

  if (event.target.closest('#emptyAddDecision')) {
    openForm('decisionForm');
  }
});

/* Ответы и сравнение */

on('#answerTaskSelect', 'change', () => {
  loadAnswerFields($('#answerTaskSelect')?.value);
});

on('#noxAnswerForm', 'submit', event => {
  event.preventDefault();
  saveAnswer('Нокс', $('#noxAnswerText')?.value || '');
});

on('#ravenAnswerForm', 'submit', event => {
  event.preventDefault();
  saveAnswer('Ворон', $('#ravenAnswerText')?.value || '');
});

on('#comparisonForm', 'submit', event => {
  event.preventDefault();

  const taskId = $('#answerTaskSelect')?.value;

  if (!taskId) {
    showToast('Сначала выбери задачу.');
    return;
  }

  const comparison = {
    taskId,
    agree: $('#compareAgree')?.value.trim() || '',
    diff: $('#compareDiff')?.value.trim() || '',
    questions: $('#compareQuestions')?.value.trim() || '',
    updatedAt: Date.now()
  };

  const found = state.comparisons.find(item => item.taskId === taskId);

  if (found) {
    Object.assign(found, comparison);
  } else {
    state.comparisons.push(comparison);
  }

  saveState();
  showToast('Сопоставление сохранено.');
});

/* Решения */

on('#showDecisionForm', 'click', () => {
  refreshTaskMaterialSelect();
  openForm('decisionForm');
});

on('#closeDecisionForm', 'click', () => closeForm('decisionForm'));

on('#decisionForm', 'submit', event => {
  event.preventDefault();

  const title = $('#decisionTitle')?.value.trim() || '';

  if (!title) {
    showToast('Напиши, какое решение принято.');
    return;
  }

  state.decisions.push({
    id: uid('dec'),
    title,
    status: $('#decisionStatus')?.value || 'На рассмотрении',
    taskId: $('#decisionTask')?.value || '',
    reason: $('#decisionReason')?.value.trim() || '',
    createdAt: Date.now()
  });

  saveState();
  event.target.reset();
  closeForm('decisionForm');
  renderDecisions();
  renderHome();
  refreshTaskMaterialSelect();

  showToast('Решение записано в журнал.');
});

on('#decisionList', 'click', event => {
  const button = event.target.closest('[data-decision-delete]');
  if (!button) return;

  const id = button.dataset.decisionDelete;

  if (!confirm('Удалить запись решения?')) return;

  state.decisions = state.decisions.filter(item => item.id !== id);

  saveState();
  renderDecisions();
  renderHome();

  showToast('Решение удалено.');
});

/* Настройки */

function fillSettings() {
  if ($('#noxChatUrl')) {
    $('#noxChatUrl').value = state.settings.noxChatUrl || '';
  }

  if ($('#ravenChatUrl')) {
    $('#ravenChatUrl').value = state.settings.ravenChatUrl || '';
  }

  if ($('#projectContext')) {
    $('#projectContext').value = state.settings.projectContext || '';
  }
}

on('#settingsForm', 'submit', event => {
  event.preventDefault();

  const nox = $('#noxChatUrl')?.value.trim() || '';
  const raven = $('#ravenChatUrl')?.value.trim() || '';

  for (const [name, value] of [
    ['ссылка Нокса', nox],
    ['ссылка Ворона', raven]
  ]) {
    if (value && !/^https:\/\//i.test(value)) {
      showToast(`Укажи корректную HTTPS-ссылку для поля «${name}».`);
      return;
    }
  }

  state.settings = {
    noxChatUrl: nox,
    ravenChatUrl: raven,
    projectContext: $('#projectContext')?.value.trim() || ''
  };

  saveState();
  showToast('Настройки сохранены в этом браузере.');
});

/* Окно передачи задачи */

on('#modalClose', 'click', () => {
  $('#modalBackdrop')?.classList.add('hidden');
});

on('#modalBackdrop', 'click', event => {
  if (event.target.id === 'modalBackdrop') {
    $('#modalBackdrop')?.classList.add('hidden');
  }
});

on('#copyPrompt', 'click', () => {
  copyText($('#promptPreview')?.value || '');
});

on('#openChat', 'click', () => {
  if (!currentPrompt.chatUrl) {
    $('#modalBackdrop')?.classList.add('hidden');
    goTo('settings');
    showToast(`Добавь ссылку на личный чат ${currentPrompt.helper} в настройках.`);
    return;
  }

  try {
    const url = new URL(currentPrompt.chatUrl);

    if (url.protocol !== 'https:') {
      showToast('Допускаются только HTTPS-ссылки.');
      return;
    }

    window.open(url.href, '_blank', 'noopener,noreferrer');
    showToast('Чат открыт в новой вкладке. Вставь сообщение и отправь вручную.');
  } catch {
    showToast('Проверь ссылку на чат в настройках.');
  }
});

/* Экспорт и очистка данных */

on('#exportData', 'click', () => {
  const blob = new Blob([
    JSON.stringify({
      exportedAt: new Date().toISOString(),
      ...state
    }, null, 2)
  ], { type: 'application/json' });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `shadow-workshop-export-${new Date().toISOString().slice(0, 10)}.json`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
  showToast('Экспорт журнала подготовлен. Храни файл в безопасном месте.');
});

on('#clearData', 'click', () => {
  if (!confirm('Точно очистить все локальные материалы, задачи, ответы и решения? Сначала сделай экспорт, если данные нужны.')) {
    return;
  }

  if (!confirm('Последнее подтверждение: удалить все локальные данные этого приложения?')) {
    return;
  }

  state = structuredClone(DEFAULT_STATE);
  saveState();
  fillSettings();
  renderAll();

  showToast('Локальные данные очищены.');
});

/* Запуск приложения */

function renderAll() {
  fillSettings();
  refreshTaskMaterialSelect();
  renderHome();
  renderMaterials();
  renderTasks();
  refreshAnswerTaskSelect();
  renderDecisions();
}

renderAll();

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .catch(error => console.warn('Не удалось зарегистрировать service worker:', error));
  });
}
