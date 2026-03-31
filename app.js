/* Minimal link manager using localStorage. Single-screen, touch-friendly. Added drag-and-drop reorder and simple auth. */
/* Import highlight.js core and common languages via esm.sh import map for syntax highlighting */
import hljs from 'hljs-core';
import javascript from 'hljs-js';
import typescript from 'hljs-ts';
import css from 'hljs-css';
import xml from 'hljs-html';
import python from 'hljs-python';
import bash from 'hljs-bash';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('css', css);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('python', python);
hljs.registerLanguage('bash', bash);

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

// profile elements & storage key
const PROFILE_KEY = 'profile.v1';
const profileAvatarEl = el('profileAvatar');
const profileNameEl = el('profileName');
const profileOverlay = el('profileOverlay');
const profileNameInput = el('profileNameInput');
const profileAvatarInput = el('profileAvatarInput');
const saveProfileBtn = el('saveProfile');
const cancelProfileBtn = el('cancelProfile');

let profile = { name: 'Guest', avatar: 'https://www.gravatar.com/avatar/?d=mp' };

function loadProfile(){
  try{
    const raw = localStorage.getItem(PROFILE_KEY);
    if(raw) profile = JSON.parse(raw);
  }catch(e){}
  updateProfileUI();
}
function saveProfile(){
  try{
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }catch(e){}
  updateProfileUI();
}
function updateProfileUI(){
  profileAvatarEl.src = profile.avatar || 'https://www.gravatar.com/avatar/?d=mp';
  profileNameEl.textContent = profile.name || 'Guest';
  // status badge reflects admin/guest
  statusBadge.textContent = isAdmin ? 'Admin' : 'Guest';
}

// profile overlay handlers
profileAvatarEl.addEventListener('click', (e)=>{
  e.stopPropagation();
  profileNameInput.value = profile.name === 'Guest' ? '' : profile.name;
  profileAvatarInput.value = profile.avatar || '';
  profileOverlay.style.display = 'block';
  profileOverlay.setAttribute('aria-hidden','false');
  profileNameInput.focus();
});
saveProfileBtn.addEventListener('click', ()=>{
  const name = (profileNameInput.value || '').trim();
  const avatar = (profileAvatarInput.value || '').trim();
  profile.name = name || (isAdmin ? 'Admin' : 'Guest');
  profile.avatar = avatar || 'https://www.gravatar.com/avatar/?d=mp';
  saveProfile();
  profileOverlay.style.display = 'none';
  profileOverlay.setAttribute('aria-hidden','true');
});
cancelProfileBtn.addEventListener('click', ()=>{
  profileOverlay.style.display = 'none';
  profileOverlay.setAttribute('aria-hidden','true');
});

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

/* robust copy helper: try navigator.clipboard, otherwise fallback to textarea+execCommand */
async function copyText(text){
  if(!text) return false;
  // try modern clipboard API first
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(text);
      return true;
    }
  }catch(e){
    // continue to fallback
  }
  // fallback method
  try{
    const ta = document.createElement('textarea');
    ta.value = text;
    // prevent flash on mobile
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.setAttribute('readonly','');
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }catch(e){
    return false;
  }
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

/* Link preview helpers: fetch page title/description (best-effort) and show a small card next to cursor */
const previewEl = (()=>{
  const d = document.createElement('div');
  d.className = 'link-preview';
  d.innerHTML = '<div class="pv-row"><div class="pv-favicon"></div><div style="flex:1"><div class="pv-title"></div><div class="pv-url"></div></div></div><div class="pv-desc"></div>';
  document.body.appendChild(d);
  return d;
})();

let previewTimeout = null;
let lastPreviewUrl = null;

async function fetchPreviewData(url){
  // best-effort: try to fetch page HTML and parse title/meta description; may fail due to CORS
  try{
    const res = await fetch(url, { mode: 'cors' });
    const txt = await res.text();
    const doc = new DOMParser().parseFromString(txt, 'text/html');
    const title = (doc.querySelector('title') || {}).textContent || '';
    const descEl = doc.querySelector('meta[name="description"]') || doc.querySelector('meta[property="og:description"]') || {};
    const desc = descEl.content || '';
    return { title: title.trim(), description: desc.trim() };
  }catch(err){
    return null;
  }
}

function showPreviewAt(targetRect, data){
  const el = previewEl;
  const padding = 10;
  // position to the right if enough space, otherwise left
  const viewportW = window.innerWidth;
  let left = targetRect.right + 12;
  if(left + el.offsetWidth + padding > viewportW){
    left = targetRect.left - el.offsetWidth - 12;
    if(left < padding) left = padding;
  }
  let top = Math.max(padding, targetRect.top);
  el.style.left = left + 'px';
  el.style.top = top + 'px';
  // fill content
  el.querySelector('.pv-favicon').innerHTML = `<img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(data.domain)}&sz=64" alt="" style="width:20px;height:20px">`;
  el.querySelector('.pv-title').textContent = data.title || data.domain;
  el.querySelector('.pv-url').textContent = data.url;
  el.querySelector('.pv-desc').textContent = data.description || '';
  el.classList.add('visible');
}

function hidePreview(){
  previewEl.classList.remove('visible');
  lastPreviewUrl = null;
  if(previewTimeout){ clearTimeout(previewTimeout); previewTimeout = null; }
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
        const ok = await copyText(item.url);
        if(ok){
          const btn = e.currentTarget;
          const old = btn.textContent;
          btn.textContent = '✅';
          setTimeout(()=> btn.textContent = old, 1200);
        }else{
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

      // Hover preview: show a mini preview card on mouseenter (best-effort fetch)
      node.addEventListener('mouseenter', (e)=>{
        const rect = node.getBoundingClientRect();
        const url = item.url;
        lastPreviewUrl = url;
        // small delay to avoid flicker
        previewTimeout = setTimeout(async ()=>{
          // optimistic fallback data
          const base = new URL(url, window.location.href);
          const fallback = { title: item.title || base.hostname, description: '', url, domain: base.hostname };
          // try to fetch metadata
          const data = await fetchPreviewData(url) || {};
          const merged = { title: data?.title || fallback.title, description: data?.description || fallback.description, url: fallback.url, domain: fallback.domain };
          // if the hovered item changed meanwhile, skip
          if(lastPreviewUrl !== url) return;
          showPreviewAt(rect, merged);
        }, 220);
      });
      node.addEventListener('mousemove', (e)=>{
        // update position as cursor moves
        if(previewEl.classList.contains('visible')){
          const r = node.getBoundingClientRect();
          showPreviewAt(r, { title: previewEl.querySelector('.pv-title').textContent, description: previewEl.querySelector('.pv-desc').textContent, url: item.url, domain: (new URL(item.url,location.href)).hostname });
        }
      });
      node.addEventListener('mouseleave', (e)=>{
        hidePreview();
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

      // title and collapsed code content
      const titleEl = node.querySelector('.title');
      const preEl = node.querySelector('.code');
      titleEl.textContent = item.title || 'Sin título';
      // use highlight.js to render code with syntax highlighting (auto-detect)
      const content = item.content || '';
      try{
        const highlighted = hljs.highlightAuto(content);
        preEl.innerHTML = highlighted.value;
        // ensure pre has language class if auto-detected
        if(highlighted.language) preEl.classList.add('language-' + highlighted.language);
      }catch(e){
        // fallback to plain text
        preEl.textContent = content;
      }

      // initialize collapsed state
      preEl.classList.remove('expanded');
      titleEl.classList.remove('expanded');
      // ensure collapsed max-height for CSS transition
      preEl.style.maxHeight = '0px';

      // clicking the title toggles the code block
      titleEl.addEventListener('click', (e)=>{
        e.stopPropagation();
        const willExpand = !preEl.classList.contains('expanded');
        if(willExpand){
          preEl.classList.add('expanded');
          titleEl.classList.add('expanded');
          // set max-height to scrollHeight to animate open
          preEl.style.maxHeight = preEl.scrollHeight + 20 + 'px';
        }else{
          preEl.classList.remove('expanded');
          titleEl.classList.remove('expanded');
          preEl.style.maxHeight = '0px';
        }
      });

      // also allow clicking the whole node to toggle for easier touch interaction
      node.addEventListener('click', (e)=>{
        // ignore clicks on action buttons
        if(e.target.closest('.item-actions')) return;
        titleEl.click();
      });

      const copyBtn = node.querySelector('.copy');
      copyBtn.addEventListener('click', async e=>{
        e.stopPropagation();
        const ok = await copyText(item.content || '');
        if(ok){
          const b = e.currentTarget; const old = b.textContent;
          b.textContent = '✅'; setTimeout(()=> b.textContent = old, 1200);
        }else{
          alert('No se pudo copiar');
        }
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
loadProfile();
tryRestoreSession();
render();
