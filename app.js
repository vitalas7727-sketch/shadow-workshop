'use strict';

const STORAGE_KEY = 'shadowWorkshop.mvp.v01';
const DEFAULT_STATE = {
  materials: [], tasks: [], answers: [], comparisons: [], decisions: [],
  settings: { noxChatUrl: '', ravenChatUrl: '', projectContext: 'Главный герой — взрослый узнаваемый сиамский кот с голубыми глазами. Мир: мистическое фэнтези. Оригинальные черты Семёна и утверждённые элементы нельзя менять без решения Виталия.' }
};
let state = loadState();
let currentPrompt = { text: '', chatUrl: '', helper: '' };
let toastTimer;
let currentView = 'home';
let viewHistory = [];
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return structuredClone(DEFAULT_STATE);
    return {
      materials: Array.isArray(saved.materials) ? saved.materials : [],
      tasks: Array.isArray(saved.tasks) ? saved.tasks : [],
      answers: Array.isArray(saved.answers) ? saved.answers : [],
      comparisons: Array.isArray(saved.comparisons) ? saved.comparisons : [],
      decisions: Array.isArray(saved.decisions) ? saved.decisions : [],
      settings: { ...DEFAULT_STATE.settings, ...(saved.settings || {}) }
    };
  } catch (error) { console.warn('Cannot read local journal:', error); return structuredClone(DEFAULT_STATE); }
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); updateCounters(); return true; }
  catch (error) { console.error(error); showToast('Не удалось сохранить: возможно, закончилось место в браузере. Экспортируй журнал в JSON.'); return false; }
}
function uid(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function niceDate(value) { try { return new Intl.DateTimeFormat('ru-RU', { day:'2-digit', month:'short', year:'numeric' }).format(new Date(value)); } catch { return ''; } }
function fileSize(bytes) { if (!Number.isFinite(bytes)) return ''; if (bytes < 1024) return `${bytes} Б`; if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(1)} КБ`; return `${(bytes/1024/1024).toFixed(1)} МБ`; }
function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 3000); }
function $(selector, parent = document) { return parent.querySelector(selector); }
function $all(selector, parent = document) { return [...parent.querySelectorAll(selector)]; }
function titleForView(view) { return ({home:'ОБЗОР',materials:'МАТЕРИАЛЫ',tasks:'ЗАДАЧИ',answers:'ОТВЕТЫ И СРАВНЕНИЕ',decisions:'РЕШЕНИЯ',settings:'НАСТРОЙКИ'})[view] || 'ОБЗОР'; }
function goTo(view, addToHistory = true) {
if (!document.querySelector(`#view-${view}`)) return;

if (view !== currentView && addToHistory) {
  viewHistory.push(currentView);
  window.history.pushState({ view: view }, '', '#' + view);
}

currentView = view;

$all('.view').forEach(el => el.classList.toggle('active', el.id === `view-${view}`));
$all('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
$ ( '#crumbTitle' ) . textContent = titleForView ( view ) ;
closeMobileNav ( ) ;
if  ( view === 'materials' )  renderMaterials ( ) ;
if  ( view === 'tasks' )  renderTasks ( ) ;
if  ( view === 'answers' )  refreshAnswerTaskSelect ( ) ;
if  ( view === 'decisions' )  renderDecisions ( ) ;
window.scrollTo ( { top : 0 , behavior : ' smooth ' } ) ;
}
function  openMobileNav ( )  {  $ ( '.sidebar' ) . classList . add ( 'open' ) ; $ ( '#mobileNavMask' ) . classList . add ( 'visible' ) ; }
function  closeMobileNav ( )  {  $ ( '.sidebar' ) . classList . remove ( 'open' ) ; $ ( '#mobileNavMask' ) . classList . remove ( 'visible' ) ; }
function  updateCounters ( )  {
  const  openTasks = состояние . задачи . filter ( t = > ! [ 'Завершена' , ' Отложена' ] . includes ( t.status ) ) . длина ;
  $ ( '#navOpenCount' ) . textContent = openTasks ;
  $ ( '#navMaterialCount' ) . textContent = state . materials . length ;
  $ ( '#navTaskCount' ) . textContent = state . tasks . length ;
  $ ( '#statMaterials' ) . textContent = state . materials . length ;
  $ ( '#statTasks' ) . textContent = openTasks ;
  $ ( '#statAnswers' ) . textContent = state . answers . length ;
  $ ( '#statDecisions' ) . textContent = state . decisions . length ;
}
function  typeIcon ( type ) { return ( { 'Видео ' : ' ▶' , 'Аудио/музыка ' : '♫' , 'Сценарий/текст' : ' T' , ' Документ ' : ' ▤' , 'Референс' : ' ◇' , 'Другое' : '◈' } ) ] || '◈' ; }   
function  renderHome ( )  {
  updateCounters ( ) ;
  const  container = $ (;
 ' 
# 
recentTasks 
' 
)
 ... 
state.tasks 
] 
.sort 
( 
( 
a
 , 
b 
)
 = 
> 
b.createdAt
 - 
a.createdAt 
)
 .slice 
( 
0
 , 
3 
) 
;
​
​
​
​
  const recent = [
  если  ( ! recent . length )  {
    container.className = ' empty-state ' ;
    container.innerHTML = '<div class="empty-icon">☷</div><b>Пока задач нет</b><p>Создай первую задачу — например, проверить кадр Семёна на непрерывность внешности.</p><button class="btn btn-small btn-secondary" data-go="tasks">Создать задачу</button>';
  } else {
    container.className = 'task-list compact-list';
    container.innerHTML = recent.map(task => `<article class="task-card"><div class="task-number">${escapeHtml(task.id.slice(-3).toUpperCase())}</div><div class="task-card-body"><div class="task-title-row"><h3>${escapeHtml(task.title)}</h3>${statusPill(task.status)}</div><p class="task-desc">${escapeHtml(task.goal)}</p><div class="material-meta"><span>${niceDate(task.createdAt)}</span><span>•</span><span>${escapeHtml(task.priority)} приоритет</span></div><div class="task-actions"><button class="mini-btn primary" data-task-action="sendNox" data-id="${escapeHtml(task.id)}">↗ Ноксу</button><button class="mini-btn primary" data-task-action="sendRaven" data-id="${escapeHtml(task.id)}">↗ Ворону</button><button class="mini-btn" data-task-action="answers" data-id="${escapeHtml(task.id)}">Ответы / сравнение</button></div></div></article>`).join('');
  }
}
function statusPill(status) { const klass = status === 'Завершена' ? 'complete' : ['На рассмотрении','Ожидает ответов'].includes(status) ? 'review' : ''; return `<span class="pill ${klass}">${escapeHtml(status)}</span>`; }
function renderMaterials() {
  const query = $('#materialSearch').value.trim().toLocaleLowerCase('ru');
  const filter = $('#materialFilter').value;
  const list = state.materials.filter(m => (filter === 'all' || m.type === filter) && `${m.title} ${m.description} ${m.fileName} ${m.type}`.toLocaleLowerCase('ru').includes(query)).sort((a,b)=>b.createdAt-a.createdAt);
  const container = $('#materialList');
  if (!list.length) { container.innerHTML = `<div class="panel empty-state"><div class="empty-icon">▧</div><b>${state.materials.length ? 'Ничего не найдено' : 'Медиатека пока пустая'}</b><p>${state.materials.length ? 'Попробуй изменить поисковую фразу или фильтр.' : 'Добавь запись об исходнике, вставь ссылку на Google Drive и укажи, что в нём важно.'}</p>${state.materials.length ? '' : '<button class="btn btn-small btn-secondary" id="emptyAddMaterial">Добавить материал</button>'}</div>`; return; }
  container.innerHTML = list.map(m => `<article class="material-card"><div class="material-icon">${typeIcon(m.type)}</div><div class="material-main"><h3>${escapeHtml(m.title)}</h3><div class="material-meta"><span>${escapeHtml(m.type)}</span><span>•</span><span>${niceDate(m.createdAt)}</span>${m.fileName ? `<span>• ${escapeHtml(m.fileName)}${m.fileSize ? ` (${escapeHtml(m.fileSize)})` : ''}</span>` : ''}</div>${m.description ? `<p class="material-desc">${escapeHtml(m.description)}</p>` : ''}${m.link ? `<a class="material-link" href="${escapeHtml(m.link)}" target="_blank" rel="noopener noreferrer">Открыть ссылку ↗</a>` : ''}</div><div class="card-actions"><button class="mini-btn" data-material-action="makeTask" data-id="${escapeHtml(m.id)}">＋ Задача</button><button class="mini-btn" data-material-action="delete" data-id="${escapeHtml(m.id)}">Удалить запись</button></div></article>`).join('');
}
function refreshTaskMaterialSelect() {
  const select = $('#taskMaterial'); const current = select.value;
  select.innerHTML = '<option value="">Без привязки</option>' + state.materials.map(m=>`<option value="${escapeHtml(m.id)}">${escapeHtml(m.title)}</option>`).join('');
  if ([...select.options].some(o=>o.value===current)) select.value=current;
  const decisionSelect = $('#decisionTask'); const oldDecision = decisionSelect.value;
  decisionSelect.innerHTML = '<option value="">Без привязки</option>' + state.tasks.map(t=>`<option value="${escapeHtml(t.id)}">${escapeHtml(t.title)}</option>`).join('');
  if ([...decisionSelect.options].some(o=>o.value===oldDecision)) decisionSelect.value=oldDecision;
}
function renderTasks() {
  refreshTaskMaterialSelect();
  const query = $('#taskSearch').value.trim().toLocaleLowerCase('ru'); const filter = $('#taskFilter').value;
  const list = state.tasks.filter(t => (filter === 'all' || t.status === filter) && `${t.title} ${t.goal} ${t.context}`.toLocaleLowerCase('ru').includes(query)).sort((a,b)=>b.createdAt-a.createdAt);
  const container = $('#taskList');
  if (!list.length) { container.innerHTML = `<div class="panel empty-state"><div class="empty-icon">☷</div><b>${state.tasks.length ? 'Задачи не найдены' : 'Пока задач нет'}</b><p>${state.tasks.length ? 'Попробуй другой поиск или статус.' : 'Начни с конкретной задачи. Например: проверить, не изменились ли глаза Семёна в серии кадров.'}</p>${state.tasks.length ? '' : '<button class="btn btn-small btn-secondary" id="emptyAddTask">＋ Создать задачу</button>'}</div>`; return; }
  container.innerHTML = list.map(t => { const mat = state.materials.find(m=>m.id===t.materialId); const nox = state.answers.some(a=>a.taskId===t.id&&a.helper==='Нокс'); const raven = state.answers.some(a=>a.taskId===t.id&&a.helper==='Ворон'); return `<article class="task-card"><div class="task-number">${escapeHtml(t.id.slice(-3).toUpperCase())}</div><div class="task-card-body"><div class="task-topline"><div class="task-main"><div class="task-title-row"><h3>${escapeHtml(t.title)}</h3>${statusPill(t.status)}<span class="pill ${t.priority==='Срочный'||t.priority==='Высокий'?'high':''}">${escapeHtml(t.priority)}</span></div><p class="task-desc">${escapeHtml(t.goal)}</p><div class="material-meta"><span>${niceDate(t.createdAt)}</span>${mat?`<span>• Материал: ${escapeHtml(mat.title)}</span>`:''}<span>• Нокс: ${nox?'ответ сохранён':'нет ответа'}</span><span>• Ворон: ${raven?'ответ сохранён':'нет ответа'}</span></div></div><select class="task-status-select" data-status-id="${escapeHtml(t.id)}" aria-label="Статус задачи"><option ${t.status==='Новая'?'selected':''}>Новая</option><option ${t.status==='Отправлено'?'selected':''}>Отправлено</option><option ${t.status==='Ожидает ответов'?'selected':''}>Ожидает ответов</option><option ${t.status==='На рассмотрении'?'selected':''}>На рассмотрении</option><option ${t.status==='Завершена'?'selected':''}>Завершена</option><option ${t.status==='Отложена'?'selected':''}>Отложена</option></select></div><div class="task-actions"><button class="mini-btn primary" data-task-action="sendNox" data-id="${escapeHtml(t.id)}">↗ Передать Ноксу</button><button class="mini-btn primary" data-task-action="sendRaven" data-id="${escapeHtml(t.id)}">↗ Передать Ворону</button><button class="mini-btn" data-task-action="answers" data-id="${escapeHtml(t.id)}">⇄ Ответы / сравнение</button><button class="mini-btn" data-task-action="decision" data-id="${escapeHtml(t.id)}">✓ Записать решение</button><button class="mini-btn" data-task-action="delete" data-id="${escapeHtml(t.id)}">Удалить</button></div></div></article>`; }).join('');
}
function refreshAnswerTaskSelect() {
  const select = $('#answerTaskSelect'); const previous = select.value;
  select.innerHTML = state.tasks.length ? '<option value="">Выбери задачу</option>' + state.tasks.map(t=>`<option value="${escapeHtml(t.id)}">${escapeHtml(t.title)}</option>`).join('') : '<option value="">Сначала создай задачу</option>';
  if ([...select.options].some(o=>o.value===previous)) select.value=previous;
  if (select.value) loadAnswerFields(select.value); else { $('#selectedTaskSummary').textContent='Выбери задачу, чтобы сохранить ответы Нокса и Ворона.'; $('#noxAnswerText').value=''; $('#ravenAnswerText').value=''; $('#compareAgree').value=''; $('#compareDiff').value=''; $('#compareQuestions').value=''; }
}
function loadAnswerFields(taskId) {
  const task = state.tasks.find(t=>t.id===taskId); if (!task) return;
  const mat = state.materials.find(m=>m.id===task.materialId);
  $('#selectedTaskSummary').innerHTML = `<b>${escapeHtml(task.title)}</b><br>${escapeHtml(task.goal)}${mat?`<br><span>Материал: ${escapeHtml(mat.title)}${mat.link?` · <a href="${escapeHtml(mat.link)}" target="_blank" rel="noopener">открыть</a>`:''}</span>`:''}`;
  $('#noxAnswerText').value = state.answers.find(a=>a.taskId===taskId&&a.helper==='Нокс')?.text || '';
  $('#ravenAnswerText').value = state.answers.find(a=>a.taskId===taskId&&a.helper==='Ворон')?.text || '';
  const comparison = state.comparisons.find(c=>c.taskId===taskId);
  $('#compareAgree').value = comparison?.agree || ''; $('#compareDiff').value = comparison?.diff || ''; $('#compareQuestions').value = comparison?.questions || '';
}
function renderDecisions() {
  const list = [...state.decisions].sort((a,b)=>b.createdAt-a.createdAt); const container = $('#decisionList');
  if (!list.length) { container.innerHTML = '<div class="panel empty-state"><div class="empty-icon">✓</div><b>Решений пока нет</b><p>Сохраняй утверждённые варианты, причины и вопросы, которые нужно проверить позже.</p><button id="emptyAddDecision" class="btn btn-small btn-secondary">Записать решение</button></div>'; return; }
  container.innerHTML = list.map(d=>{const task=state.tasks.find(t=>t.id===d.taskId);const color=d.status==='Утверждено'?'complete':d.status==='На рассмотрении'?'review':'';return `<article class="decision-card"><div class="material-icon green">✓</div><div class="decision-main"><div class="task-title-row"><h3>${escapeHtml(d.title)}</h3><span class="pill ${color}">${escapeHtml(d.status)}</span></div><p class="decision-reason">${escapeHtml(d.reason||'Причина не указана.')}</p><div class="material-meta"><span>${niceDate(d.createdAt)}</span>${task?`<span>• Задача: ${escapeHtml(task.title)}</span>`:''}</div></div><button class="mini-btn" data-decision-delete="${escapeHtml(d.id)}">Удалить</button></article>`;}).join('');
}
function newTaskPrompt(task, helper) {
  const material = state.materials.find(m=>m.id===task.materialId);
  const helperRole = helper === 'Нокс' ? 'Творческий и технический анализ. Проверь визуальную непрерывность, драматургию и предложи практические исправления.' : 'Независимая критическая проверка. Проверь логику, непрерывность, ограничения, риски и укажи, что нельзя подтвердить по исходным данным.';
  const lines = [
    `Задача из Shadow Workshop для проекта «Семён — Охотник теней».`,
    `РОЛЬ: ${helper}. ${helperRole}`,
    '', `НАЗВАНИЕ: ${task.title}`, `ЧТО НУЖНО СДЕЛАТЬ: ${task.goal}`,
    task.context ? `ДОПОЛНИТЕЛЬНЫЙ КОНТЕКСТ: ${task.context}` : '',
    state.settings.projectContext ? `ПОСТОЯННЫЕ ПРАВИЛА ПРОЕКТА: ${state.settings.projectContext}` : '',
    material ? `СВЯЗАННЫЙ МАТЕРИАЛ: ${material.title} (${material.type})` : '',
    material?.link ? `ССЫЛКА НА МАТЕРИАЛ: ${material.link}` : '',
    material?.fileName && !material?.link ? `ИМЯ ФАЙЛА: ${material.fileName}. Файл не прикреплён к этому сообщению; если нужен его визуальный/аудиальный анализ, попроси Виталия прикрепить файл отдельно.` : '',
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
  const task = state.tasks.find(t=>t.id===taskId); if (!task) { showToast('Задача не найдена.'); return; }
  currentPrompt = { text: newTaskPrompt(task, helper), chatUrl: helper==='Нокс'?state.settings.noxChatUrl:state.settings.ravenChatUrl, helper };
  $('#modalTitle').textContent = `Передать задачу · ${helper}`;
  $('#modalDescription').textContent = `Сообщение подготовлено отдельно для ${helper}. Скопируй текст, открой чат, вставь и отправь вручную.`;
  $('#promptPreview').value = currentPrompt.text;
  $('#openChat').textContent = currentPrompt.chatUrl ? 'Открыть чат' : 'Настроить ссылку на чат';
  $('#modalBackdrop').classList.remove('hidden');
}
async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); showToast('Сообщение скопировано. Теперь можно открыть чат.'); return true; }
    const area = document.createElement('textarea'); area.value=text; area.style.position='fixed'; area.style.opacity='0'; document.body.appendChild(area); area.select(); const ok=document.execCommand('copy'); area.remove(); if(!ok) throw new Error('copy failed'); showToast('Сообщение скопировано.'); return true;
  } catch (error) { $('#promptPreview').focus(); $('#promptPreview').select(); showToast('Автокопирование недоступно. Текст выделен — выбери «Копировать» в меню.'); return false; }
}
function saveAnswer(helper, text) {
  const taskId = $('#answerTaskSelect').value;
  if (!taskId) { showToast('Сначала выбери задачу.'); return false; }
  if (!text.trim()) { showToast('Вставь ответ перед сохранением.'); return false; }
  const existing = state.answers.find(a=>a.taskId===taskId&&a.helper===helper);
  if (existing) { existing.text=text.trim(); existing.updatedAt=Date.now(); }
  else state.answers.push({id:uid('ans'),taskId,helper,text:text.trim(),createdAt:Date.now(),updatedAt:Date.now()});
  const task = state.tasks.find(t=>t.id===taskId);
  const hasNox=state.answers.some(a=>a.taskId===taskId&&a.helper==='Нокс'); const hasRaven=state.answers.some(a=>a.taskId===taskId&&a.helper==='Ворон');
  if (task && hasNox && hasRaven && !['Завершена','Отложена'].includes(task.status)) task.status='На рассмотрении';
  else if (task && task.status==='Новая') task.status='Ожидает ответов';
  saveState(); renderHome(); renderTasks(); refreshAnswerTaskSelect(); $('#answerTaskSelect').value=taskId; loadAnswerFields(taskId); showToast(`Ответ ${helper} сохранён отдельно.`); return true;
}
function openForm(formId) { $(`#${formId}`).classList.remove('hidden'); $(`#${formId}`).scrollIntoView({behavior:'smooth',block:'start'}); }
function closeForm(formId) { $(`#${formId}`).classList.add('hidden'); }
function startNewTask(prefillMaterialId='') { goTo('tasks'); $('#taskForm').classList.remove('hidden'); refreshTaskMaterialSelect(); if(prefillMaterialId) $('#taskMaterial').value=prefillMaterialId; $('#taskTitle').focus({preventScroll:true}); }
function startNewDecision(taskId='') { goTo('decisions'); $('#decisionForm').classList.remove('hidden'); refreshTaskMaterialSelect(); if(taskId) $('#decisionTask').value=taskId; $('#decisionTitle').focus({preventScroll:true}); }

$all('.nav-item').forEach(button => button.addEventListener('click', () => goTo(button.dataset.view)));
$all('[data-go]').forEach(button => button.addEventListener('click', () => { if(button.dataset.go==='tasks') goTo('tasks'); else goTo(button.dataset.go); }));
$('#openSettingsTop').addEventListener('click',()=>goTo('settings'));
$('#mobileMenu').addEventListener('click',openMobileNav);
$('#homeShortcut').addEventListener('click',()=>goTo('home'));
window.addEventListener('popstate', () => {
if (viewHistory.length > 0) {
const previousView = viewHistory.pop();
goTo(previousView, false);
} else if (currentView !== 'home') {
goTo('home', false);
}
});
const mask = document.createElement('div'); mask.className='mobile-nav-mask'; mask.id='mobileNavMask'; document.body.appendChild(mask); mask.addEventListener('click',closeMobileNav);

$('#showMaterialForm').addEventListener('click',()=>openForm('materialForm')); $('#closeMaterialForm').addEventListener('click',()=>closeForm('materialForm'));
$('#materialForm').addEventListener('submit',event=>{event.preventDefault();const file=$('#materialFile').files[0];const title=$('#materialTitle').value.trim();const link=$('#materialLink').value.trim();if(!title){showToast('Укажи название материала.');return;}if(link&&!/^https?:\/\//i.test(link)){showToast('Ссылка должна начинаться с https:// или http://');return;}state.materials.push({id:uid('mat'),title,type:$('#materialType').value,fileName:file?.name||'',fileSize:file?fileSize(file.size):'',mimeType:file?.type||'',link,description:$('#materialDescription').value.trim(),createdAt:Date.now()});saveState();event.target.reset();closeForm('materialForm');renderMaterials();refreshTaskMaterialSelect();renderHome();showToast('Материал добавлен в каталог. Сам файл пока не загружен в облако.');});
$('#materialSearch').addEventListener('input',renderMaterials); $('#materialFilter').addEventListener('change',renderMaterials);
$('#materialList').addEventListener('click',event=>{const button=event.target.closest('[data-material-action]');if(!button){if(event.target.id==='emptyAddMaterial')openForm('materialForm');return;}const material=state.materials.find(m=>m.id===button.dataset.id);if(!material)return;if(button.dataset.materialAction==='makeTask')startNewTask(material.id);if(button.dataset.materialAction==='delete'){if(confirm(`Удалить запись «${material.title}» из каталога? Исходный файл не затрагивается.`)){state.materials=state.materials.filter(m=>m.id!==material.id);state.tasks.forEach(t=>{if(t.materialId===material.id)t.materialId='';});saveState();renderMaterials();refreshTaskMaterialSelect();renderHome();showToast('Запись удалена. Исходный файл не изменён.');}}});
$('#showTaskForm').addEventListener('click',()=>{refreshTaskMaterialSelect();openForm('taskForm');}); $('#closeTaskForm').addEventListener('click',()=>closeForm('taskForm'));
$('#taskForm').addEventListener('submit',event=>{event.preventDefault();const title=$('#taskTitle').value.trim(),goal=$('#taskGoal').value.trim();if(!title||!goal){showToast('Заполни название и цель задачи.');return;}const task={id:uid('tsk'),title,goal,priority:$('#taskPriority').value,materialId:$('#taskMaterial').value,context:$('#taskContext').value.trim(),status:'Новая',createdAt:Date.now()};state.tasks.push(task);saveState();event.target.reset();closeForm('taskForm');renderTasks();renderHome();refreshAnswerTaskSelect();refreshTaskMaterialSelect();showToast('Задача создана. Можно передавать помощникам.');});
$('#taskSearch').addEventListener('input',renderTasks); $('#taskFilter').addEventListener('change',renderTasks);
$('#taskList').addEventListener('change',event=>{if(!event.target.matches('[data-status-id]'))return;const task=state.tasks.find(t=>t.id===event.target.dataset.statusId);if(task){task.status=event.target.value;saveState();renderTasks();renderHome();showToast('Статус задачи обновлён.');}});
document.body.addEventListener('click',event=>{const goButton=event.target.closest('[data-go]');if(goButton){goTo(goButton.dataset.go);return;}const button=event.target.closest('[data-task-action]');if(button){const {taskAction,id}=button.dataset;const task=state.tasks.find(t=>t.id===id);if(!task)return;if(taskAction==='sendNox'||taskAction==='sendRaven')beginSend(id,taskAction==='sendNox'?'Нокс':'Ворон');if(taskAction==='answers'){goTo('answers');$('#answerTaskSelect').value=id;loadAnswerFields(id);}if(taskAction==='decision')startNewDecision(id);if(taskAction==='delete'&&confirm(`Удалить задачу «${task.title}»? Связанные ответы и решения также будут удалены.`)){state.tasks=state.tasks.filter(t=>t.id!==id);state.answers=state.answers.filter(a=>a.taskId!==id);state.comparisons=state.comparisons.filter(c=>c.taskId!==id);state.decisions=state.decisions.filter(d=>d.taskId!==id);saveState();renderTasks();renderHome();refreshAnswerTaskSelect();renderDecisions();showToast('Задача и её связанные записи удалены.');}return;}
 const emptyTask = event.target.closest('#emptyAddTask'); if(emptyTask)openForm('taskForm'); const emptyDecision=event.target.closest('#emptyAddDecision'); if(emptyDecision)openForm('decisionForm');});

$('#answerTaskSelect').addEventListener('change',()=>loadAnswerFields($('#answerTaskSelect').value));
$('#noxAnswerForm').addEventListener('submit',event=>{event.preventDefault();saveAnswer('Нокс',$('#noxAnswerText').value);});
$('#ravenAnswerForm').addEventListener('submit',event=>{event.preventDefault();saveAnswer('Ворон',$('#ravenAnswerText').value);});
$('#comparisonForm').addEventListener('submit',event=>{event.preventDefault();const taskId=$('#answerTaskSelect').value;if(!taskId){showToast('Сначала выбери задачу.');return;}const comparison={taskId,agree:$('#compareAgree').value.trim(),diff:$('#compareDiff').value.trim(),questions:$('#compareQuestions').value.trim(),updatedAt:Date.now()};const found=state.comparisons.find(c=>c.taskId===taskId);if(found)Object.assign(found,comparison);else state.comparisons.push(comparison);saveState();showToast('Сопоставление сохранено.');});

$('#showDecisionForm').addEventListener('click',()=>{refreshTaskMaterialSelect();openForm('decisionForm');});$('#closeDecisionForm').addEventListener('click',()=>closeForm('decisionForm'));
$('#decisionForm').addEventListener('submit',event=>{event.preventDefault();const title=$('#decisionTitle').value.trim();if(!title){showToast('Напиши, какое решение принято.');return;}state.decisions.push({id:uid('dec'),title,status:$('#decisionStatus').value,taskId:$('#decisionTask').value,reason:$('#decisionReason').value.trim(),createdAt:Date.now()});saveState();event.target.reset();closeForm('decisionForm');renderDecisions();renderHome();refreshTaskMaterialSelect();showToast('Решение записано в журнал.');});
$('#decisionList').addEventListener('click',event=>{const button=event.target.closest('[data-decision-delete]');if(!button)return;const id=button.dataset.decisionDelete;if(confirm('Удалить запись решения?')){state.decisions=state.decisions.filter(d=>d.id!==id);saveState();renderDecisions();renderHome();showToast('Решение удалено.');}});

function fillSettings() { $('#noxChatUrl').value=state.settings.noxChatUrl||'';$('#ravenChatUrl').value=state.settings.ravenChatUrl||'';$('#projectContext').value=state.settings.projectContext||''; }
$('#settingsForm').addEventListener('submit',event=>{event.preventDefault();const nox=$('#noxChatUrl').value.trim(),raven=$('#ravenChatUrl').value.trim();for(const [name,value] of [['ссылка Нокса',nox],['ссылка Ворона',raven]]){if(value&&!/^https:\/\//i.test(value)){showToast(`Укажи корректную HTTPS-ссылку для поля «${name}».`);return;}}state.settings={noxChatUrl:nox,ravenChatUrl:raven,projectContext:$('#projectContext').value.trim()};saveState();showToast('Настройки сохранены в этом браузере.');});
$('#modalClose').addEventListener('click',()=>$('#modalBackdrop').classList.add('hidden'));
$('#modalBackdrop').addEventListener('click',event=>{if(event.target.id==='modalBackdrop')$('#modalBackdrop').classList.add('hidden');});
$('#copyPrompt').addEventListener('click',()=>copyText($('#promptPreview').value));
$('#openChat').addEventListener('click',()=>{if(!currentPrompt.chatUrl){$('#modalBackdrop').classList.add('hidden');goTo('settings');showToast(`Добавь ссылку на личный чат ${currentPrompt.helper} в настройках.`);return;}try{const url=new URL(currentPrompt.chatUrl);if(url.protocol!=='https:'){showToast('Допускаются только HTTPS-ссылки.');return;}window.open(url.href,'_blank','noopener,noreferrer');showToast('Чат открыт в новой вкладке. Вставь сообщение и отправь вручную.');}catch{showToast('Проверь ссылку на чат в настройках.');}});
$('#exportData').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),...state},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`shadow-workshop-export-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);showToast('Экспорт журнала подготовлен. Храни файл в безопасном месте.');});
$('#clearData').addEventListener('click',()=>{if(!confirm('Точно очистить все локальные материалы, задачи, ответы и решения? Сначала сделай экспорт, если данные нужны.'))return;if(!confirm('Последнее подтверждение: удалить все локальные данные этого приложения?'))return;state=structuredClone(DEFAULT_STATE);saveState();fillSettings();renderAll();showToast('Локальные данные очищены.');});

function renderAll() { fillSettings(); refreshTaskMaterialSelect(); renderHome(); renderMaterials(); renderTasks(); refreshAnswerTaskSelect(); renderDecisions(); }
renderAll();
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) { window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(error=>console.warn('Service worker registration failed:',error))); }
