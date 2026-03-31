/* Minimal link manager using localStorage. Single-screen, touch-friendly. Added drag-and-drop reorder and simple auth. */
const STORAGE_KEY = 'links.v1';
const STORAGE_CODE_KEY = 'codes.v1';
const AUTH_KEY = 'session.v1'; // store username when logged in

const el = id => document.getElementById(id);
const qs = s => document.querySelector(s);

const urlIn = el('url');
const titleIn = el('title');

// code snippet elements
const codeTitleIn = el('codeTitle');
const codeContentIn = el('codeContent');
const addCodeBtn = el('addCode');
const clearCodeBtn = el('clearCode');
const codeListEl = el('codeList');
const searchCodeIn = el('searchCode');
const codeTpl = qs('#codeTpl');

const addBtn = el('add');
const clearBtn = el('clear');
const pasteBtn = el('paste');

const listEl = el('list');
const tpl = qs('#itemTpl');
const emptyEl = el('empty');
const searchIn = el('search');
const filterTag = el('filterTag');
const exportBtn = el('export');
const importBtn = el('import');
const importFile = el('importFile');

const loginBtn = el('loginBtn');
const logoutBtn = el('logoutBtn');
const loginOverlay = el('loginOverlay');
const doLogin = el('doLogin');
const cancelLogin = el('cancelLogin');
const loginUser = el('loginUser');
const loginPass = el('loginPass');
const toast = el('toast');
const statusBadge = el('statusBadge');

let links = [];
let codes = [];
let editId = null;
let editCodeId = null;
let draggingId = null;
let isAdmin = false;
let activeView = 'links'; // 'links' or 'code'

// hardcoded credentials
const CREDENTIALS = { user: 'anocgestor', pass: '12457889/Aa' };

function saveAll(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
  localStorage.setItem(STORAGE_CODE_KEY, JSON.stringify(codes));
  render();
}

function loadAll(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    links = raw ? JSON.parse(raw) : [];
  }catch(e){ links = [] }
  try{
    const cr = localStorage.getItem(STORAGE_CODE_KEY);
    codes = cr ? JSON.parse(cr) : [];
  }catch(e){ codes = [] }
}
function normalizeTags(raw){
  if(!raw) return [];
  return raw.split(',').map(t=>t.trim()).filter(Boolean).slice(0,10);
}
function addLink(url, title, tags){
  const id = Date.now().toString();
  links.unshift({id, url, title: title||url, tags});
  saveAll();
}
function updateLink(id, url, title, tags){
  const i = links.findIndex(l=>l.id===id);
  if(i>=0){ links[i] = {id, url, title: title||url, tags}; saveAll(); }
}
function deleteLink(id){
  links = links.filter(l=>l.id!==id); saveAll();
}
function openInNewTab(url){
  window.open(url,'_blank','noopener');
}

function reorderById(dragId, beforeId){
  const from = links.findIndex(l=>l.id===dragId);
  if(from === -1) return;
  const item = links.splice(from,1)[0];
  if(!beforeId){
    links.push(item);
  }else{
    const to = links.findIndex(l=>l.id===beforeId);
    if(to === -1){
      links.push(item);
    }else{
      links.splice(to,0,item);
    }
  }
  saveAll();
}

function showToast(msg, timeout = 1800){
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(()=> toast.classList.remove('visible'), timeout);
}

function setAdminState(state){
  isAdmin = !!state;
  if(isAdmin){
    document.documentElement.classList.add('admin-mode');
    statusBadge.textContent = 'Admin';
    loginBtn.style.display = 'none';
    logoutBtn.style.display = '';
  }else{
    document.documentElement.classList.remove('admin-mode');
    statusBadge.textContent = 'Guest';
    loginBtn.style.display = '';
    logoutBtn.style.display = 'none';
  }
  // persist session
  if(isAdmin) localStorage.setItem(AUTH_KEY, CREDENTIALS.user);
  else localStorage.removeItem(AUTH_KEY);
  render(); // re-render to show/hide UI controls
}

function tryRestoreSession(){
  const user = localStorage.getItem(AUTH_KEY);
  if(user === CREDENTIALS.user){
    setAdminState(true);
  }else{
    setAdminState(false);
  }
}

function render(){
  // toggle visible view
  document.querySelectorAll('.view').forEach(v=>{
    v.style.display = v.dataset.view === activeView ? '' : 'none';
  });

  // show/hide add panels based on admin, but only for their view
  document.querySelectorAll('.view .add-panel').forEach(p=>{
    p.style.display = isAdmin ? '' : 'none';
  });

  // LINKS view rendering
  if(activeView === 'links'){
    // list
    const q = (searchIn.value || '').trim().toLowerCase();
    const tagFilter = filterTag.value;
    listEl.innerHTML = '';
    const filtered = links.filter(l=>{
      const matchText = l.title.toLowerCase().includes(q) || l.url.toLowerCase().includes(q) || l.tags.join(' ').toLowerCase().includes(q);
      const matchTag = !tagFilter || l.tags.includes(tagFilter);
      return matchText && matchTag;
    });
    if(!filtered.length){ emptyEl.style.display = 'block'; } else { emptyEl.style.display = 'none' }
    for(const item of filtered){
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.dataset.id = item.id;
      node.draggable = isAdmin;
      if(!isAdmin) node.classList.add('readonly-item');
      node.querySelector('.title').textContent = item.title;
      node.querySelector('.url').textContent = item.url;
      const a = node.querySelector('.link');
      a.href = item.url;
      const badgeRow = node.querySelector('.badge-row');
      item.tags.slice(0,4).forEach(t=>{
        const b = document.createElement('div'); b.className='badge'; b.textContent = t; badgeRow.appendChild(b);
      });
      node.querySelector('.open').addEventListener('click', e=>{ e.stopPropagation(); openInNewTab(item.url); });

      node.querySelector('.copy').addEventListener('click', async e=>{
        e.stopPropagation();
        try{
          await navigator.clipboard.writeText(item.url);
          const btn = e.currentTarget;
          const old = btn.textContent;
          btn.textContent = '✅';
          setTimeout(()=> btn.textContent = old, 1200);
        }catch(err){
          alert('No se pudo copiar');
        }
      });

      node.querySelector('.edit').addEventListener('click', e=>{
        e.stopPropagation();
        if(!isAdmin) return;
        editId = item.id;
        urlIn.value = item.url;
        titleIn.value = item.title === item.url ? '' : item.title;
        urlIn.focus();
      });

      const deleteBtn = node.querySelector('.delete');
      if(!isAdmin){
        deleteBtn.style.display = 'none';
      }else{
        deleteBtn.style.display = '';
        deleteBtn.addEventListener('click', e=>{ e.stopPropagation(); if(confirm('Eliminar enlace?')) deleteLink(item.id); });
      }

      // Drag & Drop handlers
      node.addEventListener('dragstart', (e)=>{
        if(!isAdmin) return;
        draggingId = item.id;
        node.classList.add('dragging');
        document.body.classList.add('dragging-list');
        try{ e.dataTransfer.setData('text/plain', item.id); }catch(err){}
        if(e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      });
      node.addEventListener('dragend', ()=>{
        draggingId = null;
        node.classList.remove('dragging');
        document.body.classList.remove('dragging-list');
        listEl.querySelectorAll('.over').forEach(n=>n.classList.remove('over'));
      });
      node.addEventListener('dragover', (e)=>{
        if(!isAdmin) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const target = e.currentTarget;
        listEl.querySelectorAll('.over').forEach(n=>{ if(n!==target) n.classList.remove('over'); });
        target.classList.add('over');
      });
      node.addEventListener('dragleave', (e)=>{ e.currentTarget.classList.remove('over'); });
      node.addEventListener('drop', (e)=>{
        if(!isAdmin) return;
        e.preventDefault();
        const target = e.currentTarget;
        const beforeId = target.dataset.id === draggingId ? null : target.dataset.id;
        if(draggingId){ reorderById(draggingId, beforeId); }
        target.classList.remove('over');
      });

      listEl.appendChild(node);
    }

    // tags filter
    const tagsSet = new Set();
    links.forEach(l=>l.tags.forEach(t=>tagsSet.add(t)));
    const current = filterTag.value;
    filterTag.innerHTML = '<option value="">Filtrar etiqueta</option>';
    Array.from(tagsSet).sort().forEach(t=>{
      const opt = document.createElement('option'); opt.value = t; opt.textContent = t; filterTag.appendChild(opt);
    });
    if(current) filterTag.value = current;
  }

  // CODE view rendering
  if(activeView === 'code'){
    const q = (searchCodeIn.value || '').trim().toLowerCase();
    codeListEl.innerHTML = '';
    const filtered = codes.filter(c=>{
      return (c.title || '').toLowerCase().includes(q) || (c.content || '').toLowerCase().includes(q);
    });
    if(!filtered.length){ el('emptyCode').style.display = 'block'; } else { el('emptyCode').style.display = 'none' }
    for(const item of filtered){
      const node = codeTpl.content.firstElementChild.cloneNode(true);
      node.dataset.id = item.id;
      if(!isAdmin) node.classList.add('readonly-item');
      node.querySelector('.title').textContent = item.title || 'Sin título';
      node.querySelector('.code').textContent = item.content || '';
      const copyBtn = node.querySelector('.copy');
      copyBtn.addEventListener('click', async e=>{
        e.stopPropagation();
        try{
          await navigator.clipboard.writeText(item.content || '');
          const b = e.currentTarget; const old = b.textContent;
          b.textContent = '✅'; setTimeout(()=> b.textContent = old, 1200);
        }catch(err){ alert('No se pudo copiar'); }
      });
      const editBtn = node.querySelector('.edit');
      editBtn.addEventListener('click', e=>{
        e.stopPropagation();
        if(!isAdmin) return;
        editCodeId = item.id;
        codeTitleIn.value = item.title;
        codeContentIn.value = item.content;
        codeTitleIn.focus();
      });
      const delBtn = node.querySelector('.delete');
      if(!isAdmin) delBtn.style.display = 'none';
      else delBtn.addEventListener('click', e=>{ e.stopPropagation(); if(confirm('Eliminar snippet?')){ codes = codes.filter(c=>c.id!==item.id); saveAll(); } });
      codeListEl.appendChild(node);
    }
  }
}

function resetForm(){
  urlIn.value = '';
  titleIn.value = '';
  editId = null;
}

addBtn.addEventListener('click', ()=>{
  const url = urlIn.value.trim();
  if(!url) return urlIn.focus();
  const title = titleIn.value.trim();
  const tags = [];
  if(editId){
    updateLink(editId, url, title, tags);
  }else{
    addLink(url, title, tags);
  }
  resetForm();
});

// code add
addCodeBtn.addEventListener('click', ()=>{
  const title = (codeTitleIn.value || '').trim();
  const content = (codeContentIn.value || '').trim();
  if(!content) return codeContentIn.focus();
  if(editCodeId){
    const i = codes.findIndex(c=>c.id===editCodeId);
    if(i>=0){ codes[i] = {id: editCodeId, title: title || content.slice(0,30), content}; saveAll(); }
  }else{
    const id = Date.now().toString() + Math.random().toString(36).slice(2,6);
    codes.unshift({id, title: title || content.slice(0,30), content});
    saveAll();
  }
  editCodeId = null;
  codeTitleIn.value = '';
  codeContentIn.value = '';
});

clearCodeBtn.addEventListener('click', ()=>{
  editCodeId = null;
  codeTitleIn.value = '';
  codeContentIn.value = '';
});

clearBtn.addEventListener('click', ()=>{ resetForm(); });

pasteBtn.addEventListener('click', async ()=>{
  try{
    const text = await navigator.clipboard.readText();
    if(text) urlIn.value = text;
  }catch(e){}
});

searchIn.addEventListener('input', render);
filterTag.addEventListener('change', render);
searchCodeIn.addEventListener('input', render);

// tabs
const tabLinks = el('tab-links');
const tabCode = el('tab-code');
tabLinks.addEventListener('click', ()=>{ activeView = 'links'; tabLinks.classList.add('active'); tabCode.classList.remove('active'); render(); });
tabCode.addEventListener('click', ()=>{ activeView = 'code'; tabCode.classList.add('active'); tabLinks.classList.remove('active'); render(); });

// export / import
exportBtn.addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(links, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'links.json';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});

importBtn.addEventListener('click', ()=> importFile.click());
importFile.addEventListener('change', async (e)=>{
  const f = e.target.files?.[0];
  if(!f) return;
  try{
    const txt = await f.text();
    const imported = JSON.parse(txt);
    if(Array.isArray(imported)){
      // merge and dedupe by url
      const existing = new Set(links.map(l=>l.url));
      const toAdd = imported.filter(i=>i.url && !existing.has(i.url)).map(i=>({
        id: Date.now().toString() + Math.random().toString(36).slice(2,6),
        url: i.url,
        title: i.title || i.url,
        tags: Array.isArray(i.tags) ? i.tags.map(t=>String(t)) : normalizeTags(i.tags || '')
      }));
      links = toAdd.concat(links);
      saveAll();
      importFile.value = '';
    }else{
      alert('Archivo inválido');
    }
  }catch(err){ alert('Error al importar'); }
});

// quick add on enter in URL
urlIn.addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ addBtn.click(); } });
titleIn.addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ addBtn.click(); } });

/* Login overlay interactions */
loginBtn.addEventListener('click', ()=>{ loginOverlay.style.display = 'block'; loginOverlay.setAttribute('aria-hidden','false'); loginUser.focus(); });
cancelLogin.addEventListener('click', ()=>{ loginOverlay.style.display = 'none'; loginOverlay.setAttribute('aria-hidden','true'); loginUser.value=''; loginPass.value=''; });
doLogin.addEventListener('click', ()=>{
  const u = loginUser.value.trim();
  const p = loginPass.value;
  if(u === CREDENTIALS.user && p === CREDENTIALS.pass){
    setAdminState(true);
    loginOverlay.style.display = 'none';
    loginOverlay.setAttribute('aria-hidden','true');
    loginUser.value=''; loginPass.value='';
    // subtle UI change + toast
    showToast('Welcome, Admin');
  }else{
    showToast('Credenciales incorrectas');
  }
});

// logout
logoutBtn.addEventListener('click', ()=>{
  if(confirm('Cerrar sesión?')){ setAdminState(false); showToast('Sesion cerrada'); }
});

/* initial load */
loadAll();
tryRestoreSession();
render();