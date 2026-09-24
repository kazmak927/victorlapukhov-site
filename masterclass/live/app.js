'use strict';
(() => {
  const content = window.workshopContent;
  const steps = content.steps;
  const core = steps.filter(step => !step.bonus);
  const key = 'victor-workshop-live-v1';
  const $ = id => document.getElementById(id);
  const empty = () => ({index:0,done:[],checks:{},questions:'',clock:{running:false,total:0,started:0,stepStarted:0,stepMs:{}}});
  let state = empty();
  let storageOK = true;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved && typeof saved === 'object') {
      if (Number.isInteger(saved.index) && saved.index >= 0 && saved.index < steps.length) state.index = saved.index;
      state.done = Array.isArray(saved.done) ? saved.done.filter(id => steps.some(s => s.id === id)) : [];
      state.questions = typeof saved.questions === 'string' ? saved.questions.slice(0,12000) : '';
      if (saved.checks && typeof saved.checks === 'object') {
        for (const step of steps) if (Array.isArray(saved.checks[step.id])) state.checks[step.id] = saved.checks[step.id].filter(x => Number.isInteger(x) && x >= 0 && x < 30);
      }
      const clock = saved.clock;
      if (clock && typeof clock === 'object') {
        for (const field of ['total','started','stepStarted']) if (Number.isFinite(clock[field]) && clock[field] >= 0) state.clock[field] = clock[field];
        if (clock.stepMs && typeof clock.stepMs === 'object') for (const step of steps) if (Number.isFinite(clock.stepMs[step.id]) && clock.stepMs[step.id] >= 0) state.clock.stepMs[step.id] = clock.stepMs[step.id];
        state.clock.running = clock.running === true && state.clock.started > 0 && state.clock.stepStarted > 0;
      }
    }
  } catch (_) { storageOK = false; }
  let toastTimeout;
  function toast(text) {
    $('toast').textContent = text;
    $('toast').classList.add('visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => $('toast').classList.remove('visible'), 3000);
  }
  function save() {
    try { localStorage.setItem(key, JSON.stringify(state)); }
    catch (_) { storageOK = false; $('completion-hint').textContent = 'Браузер не разрешил сохранение: отметки действуют до закрытия страницы.'; }
  }
  function mmss(ms) {
    const seconds = Math.floor(Math.max(0, ms) / 1000);
    return String(Math.floor(seconds/60)).padStart(2,'0') + ':' + String(seconds%60).padStart(2,'0');
  }
  function elapsed() { return state.clock.total + (state.clock.running ? Math.max(0,Date.now()-state.clock.started) : 0); }
  function stepElapsed() { return (state.clock.stepMs[steps[state.index].id] || 0) + (state.clock.running ? Math.max(0,Date.now()-state.clock.stepStarted) : 0); }
  function tick() {
    $('total-clock').textContent = mmss(elapsed());
    $('step-clock').textContent = mmss(stepElapsed());
    $('step-clock').parentElement.classList.toggle('over',stepElapsed() > steps[state.index].minutes*60000);
    $('clock-toggle').textContent = state.clock.running ? 'Пауза' : elapsed() > 0 ? 'Продолжить' : 'Начать встречу';
    $('clock-label').textContent = state.clock.running ? 'Идёт встреча' : elapsed() > 0 ? 'На паузе' : 'Время встречи';
  }
  function accrueStep() {
    if (!state.clock.running) return;
    const id = steps[state.index].id;
    state.clock.stepMs[id] = (state.clock.stepMs[id] || 0) + Math.max(0,Date.now()-state.clock.stepStarted);
    state.clock.stepStarted = Date.now();
  }
  function toggleClock() {
    if (state.clock.running) {
      accrueStep(); state.clock.total = elapsed(); state.clock.running = false;
    } else {
      state.clock.started = Date.now(); state.clock.stepStarted = Date.now(); state.clock.running = true;
    }
    save(); tick();
  }
  function slot(step) { return step.bonus ? 'После основного часа · +20 мин' : `${String(step.start).padStart(2,'0')}–${String(step.end).padStart(2,'0')} мин`; }
  function refreshProgress() {
    const count = core.filter(s=>state.done.includes(s.id)).length;
    $('progress-label').textContent = `${count} из ${core.length}`;
    $('progress').value = count;
    $('progress').max = core.length;
    document.querySelectorAll('.timeline-button').forEach((button,index)=>{
      const done = state.done.includes(steps[index].id);
      button.classList.toggle('is-done',done);
      button.querySelector('.step-dot').textContent = done ? '✓' : steps[index].bonus ? '+' : String(index+1).padStart(2,'0');
      button.setAttribute('aria-label', `${steps[index].short}. ${slot(steps[index])}${done ? '. Завершён' : ''}`);
      if (index===state.index) button.setAttribute('aria-current','step'); else button.removeAttribute('aria-current');
    });
    $('completion-hint').textContent = !storageOK ? 'Отметки не сохраняются после закрытия: хранилище браузера недоступно.' : count===core.length ? 'Все основные этапы завершены. Спасибо за встречу! Бонус с формой доступен в плане.' : '«Дальше» завершает текущий этап автоматически. Выбор этапа в плане только переключает страницу.';
  }
  async function copy(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const textarea = document.createElement('textarea'); textarea.value = text; textarea.setAttribute('readonly',''); document.body.appendChild(textarea); textarea.select();
        const copied = document.execCommand('copy'); textarea.remove(); if (!copied) throw new Error('copy unavailable');
      }
      toast('Промпт скопирован');
    } catch (_) { toast('Копирование недоступно. Выделите текст промпта и скопируйте вручную.'); }
  }
  function openDialog(id) { if (!$(id).open) $(id).showModal(); }
  function updateQuestions() { const n=state.questions.split('\n').filter(x=>x.trim()).length; $('question-count').textContent=n ? `(${n})` : ''; }
  function render() {
    const step=steps[state.index];
    $('stage-kind').textContent=step.kind;
    $('stage-slot').textContent=slot(step);
    $('step-budget').textContent=`/ ${step.minutes} мин`;
    $('stage-title').textContent=step.title;
    $('stage-lead').textContent=step.lead;
    $('stage-visual').innerHTML=step.visual;
    $('stage-body').innerHTML=step.body;
    $('stage-prompt').textContent=step.prompt;
    $('prompt-panel').hidden=!step.prompt;
    $('prompt-panel').open=false;
    $('stage-notes').innerHTML=step.notes;
    $('speaker-panel').hidden=!step.notes;
    $('speaker-panel').open=false;
    $('stage-sources').replaceChildren();
    step.sources.forEach(([label,url])=>{const a=document.createElement('a');a.textContent=label+' ↗';a.href=url;a.target='_blank';a.rel='noopener noreferrer';$('stage-sources').appendChild(a);});
    $('prev-step').disabled=state.index===0;
    const lastCore = state.index===core.length-1;
    const lastBonus = state.index===steps.length-1;
    const finished = state.done.includes(step.id);
    $('next-step').disabled=(lastCore||lastBonus)&&finished;
    $('next-step').textContent=lastCore ? (finished?'Встреча завершена':'Завершить встречу') : lastBonus ? (finished?'Бонус завершён':'Завершить бонус') : 'Дальше →';
    $('stage-body').querySelectorAll('[data-check]').forEach(input=>{
      const id=Number(input.dataset.check); input.checked=(state.checks[step.id]||[]).includes(id);
      input.addEventListener('change',()=>{const values=new Set(state.checks[step.id]||[]);input.checked ? values.add(id) : values.delete(id);state.checks[step.id]=[...values];save();});
    });
    $('stage-body').querySelectorAll('[data-open-help]').forEach(b=>b.addEventListener('click',()=>openDialog('help-dialog')));
    $('stage-body').querySelectorAll('[data-open-questions]').forEach(b=>b.addEventListener('click',()=>openDialog('questions-dialog')));
    if ($('demo-hour')) {
      const preview=()=>{const h=Number($('demo-hour').value);const light=h>=8&&h<18;const dusk=(h>=6&&h<8)||(h>=18&&h<21);$('day-demo').style.backgroundColor=light?'#e1e6d8':dusk?'#646b5c':'#24332c';$('day-demo').style.color=light?'#283b31':'#fffdf7';$('demo-hour-label').textContent=`${String(h).padStart(2,'0')}:00 · ${light?'день':dusk?'сумерки':'ночь'}`;};
      $('demo-hour').addEventListener('input',preview);preview();
    }
    refreshProgress();tick();
  }
  function select(index) {
    if(index<0||index>=steps.length||index===state.index)return;
    accrueStep();state.index=index;save();render();
    $('stage').focus({preventScroll:true}); $('stage').scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  function next() {
    const step=steps[state.index];
    if(!state.done.includes(step.id))state.done.push(step.id);
    if(state.index===core.length-1||state.index===steps.length-1){
      if(state.clock.running){accrueStep();state.clock.total=elapsed();state.clock.running=false;}
      save();render();toast(step.bonus?'Бонус завершён':'Встреча завершена');
    } else {save();select(state.index+1);}
  }
  steps.forEach((step,index)=>{
    const button=document.createElement('button');button.type='button';button.className='timeline-button'+(step.bonus?' bonus':'');
    const dot=document.createElement('span');dot.className='step-dot';dot.setAttribute('aria-hidden','true');
    const label=document.createElement('span');label.className='step-text';label.textContent=step.short;
    const time=document.createElement('small');time.textContent=slot(step);label.appendChild(time);button.append(dot,label);button.addEventListener('click',()=>select(index));$('timeline').appendChild(button);
    const row=document.createElement('div');row.className='agenda-row';const range=document.createElement('span');range.textContent=step.bonus?'+20':`${String(step.start).padStart(2,'0')}–${String(step.end).padStart(2,'0')}`;
    const jump=document.createElement('button');jump.textContent=step.short;jump.addEventListener('click',()=>{$('agenda-dialog').close();select(index);});
    const duration=document.createElement('span');duration.textContent=`${step.minutes} мин`;row.append(range,jump,duration);$('agenda-list').appendChild(row);
  });
  $('clock-toggle').addEventListener('click',toggleClock);
  $('present-toggle').addEventListener('click',()=>{const on=document.body.classList.toggle('present');$('present-toggle').setAttribute('aria-pressed',String(on));$('present-toggle').textContent=on?'Вернуть план':'Режим показа';});
  $('prev-step').addEventListener('click',()=>select(state.index-1));
  $('next-step').addEventListener('click',next);
  $('copy-prompt').addEventListener('click',()=>copy(steps[state.index].prompt));
  $('copy-trouble').addEventListener('click',()=>copy(content.troublePrompt));
  $('trouble-prompt').textContent=content.troublePrompt;
  $('agenda-open').addEventListener('click',()=>openDialog('agenda-dialog'));
  $('questions-open').addEventListener('click',()=>openDialog('questions-dialog'));
  $('help-open').addEventListener('click',()=>openDialog('help-dialog'));
  document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
  $('question-notes').value=state.questions;
  $('question-notes').maxLength=12000;
  $('question-notes').addEventListener('input',()=>{state.questions=$('question-notes').value;save();updateQuestions();});
  $('reset-session').addEventListener('click',()=>{
    const questions=state.questions;
    state=empty();state.questions=questions;save();updateQuestions();render();window.scrollTo({top:0,behavior:'instant'});toast('Таймер и прохождение сброшены. Записанные вопросы сохранены.');
  });
  // Accessible shortcuts stay inactive in fields and open dialogs.
  document.addEventListener('keydown',event=>{
    if(event.altKey||event.metaKey||event.ctrlKey||event.shiftKey||document.querySelector('dialog[open]')||event.target.closest('input,textarea,select,button,summary,a'))return;
    if(event.key==='ArrowRight'){event.preventDefault();if(!$('next-step').disabled)next();}
    if(event.key==='ArrowLeft'){event.preventDefault();select(state.index-1);}
  });
  const auxiliary=document.createElement('div');auxiliary.className='aux-actions';
  [['Вопросы на потом','questions-dialog'],['Если возникла проблема','help-dialog']].forEach(([label,id])=>{const b=document.createElement('button');b.className='plain';b.textContent=label;b.addEventListener('click',()=>openDialog(id));auxiliary.appendChild(b);});
  const print=document.createElement('a');print.href='./plan.html';print.textContent='Версия для чтения и печати ↗';auxiliary.appendChild(print);$('stage').appendChild(auxiliary);
  const sessionBar=document.querySelector('.session-bar');
  new ResizeObserver(()=>document.documentElement.style.setProperty('--session-height',`${sessionBar.getBoundingClientRect().height}px`)).observe(sessionBar);
  if (['localhost','127.0.0.1','::1'].includes(location.hostname)||location.protocol==='file:') $('draft-notice').hidden=false;
  updateQuestions();render();setInterval(tick,500);
})();
