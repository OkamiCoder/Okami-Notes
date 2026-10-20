const $ = s => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10);
let DB = null;
try { DB = JSON.parse(localStorage.getItem("okamiNotes")); } catch (e) {}
if (!DB || !DB.users) DB = { users: [], active: null };
let U = null;

const SVG = {
  folder: '<svg class="n-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  note: '<svg class="n-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
  checklist: '<svg class="n-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 5l1.2 1.2L7.5 4M4 11l1.2 1.2L7.5 10M4 17l1.2 1.2L7.5 16"/></svg>',
  caret: '<svg class="caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>'
};

function persist() { localStorage.setItem("okamiNotes", JSON.stringify(DB)); }

function toast(msg) {
  $("#toastTxt").textContent = msg;
  const t = $("#toast");
  t.classList.add("on");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("on"), 2200);
}

function findNode(list, id) {
  for (const n of list) {
    if (n.id === id) return n;
    if (n.children) { const f = findNode(n.children, id); if (f) return f; }
  }
  return null;
}
function removeNode(list, id) {
  const i = list.findIndex(n => n.id === id);
  if (i > -1) { list.splice(i, 1); return true; }
  return list.some(n => n.children && removeNode(n.children, id));
}
function isDescendant(node, id) {
  if (!node.children) return false;
  return node.children.some(c => c.id === id || isDescendant(c, id));
}

function applyAll() {
  document.body.classList.toggle("dark", U.theme === "dark");
  $("#moonIco").style.display = U.theme === "dark" ? "none" : "block";
  $("#sunIco").style.display = U.theme === "dark" ? "block" : "none";
  $("#darkChk").checked = U.theme === "dark";
  document.documentElement.style.setProperty("--radius", U.radius + "px");
  document.documentElement.style.setProperty("--font", '"' + U.font + '",' + (U.font === "JetBrains Mono" ? "monospace" : "sans-serif"));
  document.body.style.backgroundImage = U.bg
    ? "linear-gradient(" + (U.theme === "dark" ? "rgba(10,10,16,.78)" : "rgba(255,255,255,.72)") + ",rgba(0,0,0,.1)),url(" + U.bg + ")"
    : "";
  const map = { app: "#app", sidebar: "#sidebar", editor: "#editor", tree: "#tree", buttons: ".tool-btn,.icon-btn,#saveBtn,.m-btn", modal: ".modal-card" };
  $("#customCssEl").textContent = Object.entries(U.customCss || {}).map(([k, v]) => (map[k] || "#app") + "{" + v + "}").join("\n");
  renderUserBadge();
}
function renderUserBadge() {
  $("#userName").textContent = U.name;
  $("#avatarBtn").innerHTML = U.avatar ? '<img src="' + U.avatar + '">' : U.name.charAt(0).toUpperCase();
}

function renderTree() {
  const t = $("#tree");
  const build = (nodes, depth) => nodes.map(n => {
    if (n.kind === "folder") {
      const open = U.open[n.id] !== false;
      const kids = n.children || [];
      return '<div class="node folder ' + (open ? "open" : "closed") + '" data-id="' + n.id + '">' +
        '<div class="node-row" draggable="true" data-id="' + n.id + '">' +
        SVG.caret + SVG.folder +
        '<span class="n-name">' + esc(n.name) + '</span>' +
        (kids.length ? '<span class="n-count">' + kids.length + "</span>" : "") +
        '<button class="n-del" data-del="' + n.id + '">' + SVG.x + "</button>" +
        "</div>" +
        '<div class="node-children">' + (kids.length ? build(kids, depth + 1) : "") + "</div>" +
        "</div>";
    }
    return '<div class="node file" data-id="' + n.id + '">' +
      '<div class="node-row ' + (U.activeFile === n.id ? "sel" : "") + '" draggable="true" data-id="' + n.id + '">' +
      SVG.caret.replace('class="caret"', 'class="caret" style="visibility:hidden"') +
      (n.kind === "checklist" ? SVG.checklist : SVG.note) +
      '<span class="n-name">' + esc(n.name) + "</span>" +
      '<button class="n-del" data-del="' + n.id + '">' + SVG.x + "</button>" +
      "</div></div>";
  }).join("");
  t.innerHTML = U.tree.length
    ? '<div class="tree-label">Проводник</div>' + build(U.tree, 0)
    : '<div class="empty-tree">Здесь пока пусто.<br>Создай первую папку или файл ✨</div>';
}

function esc(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

function renderEditor() {
  const ed = $("#editor"), head = $("#editorHead");
  const node = U.activeFile ? findNode(U.tree, U.activeFile) : null;
  if (!node) {
    head.style.display = "none";
    ed.innerHTML = '<div class="ed-empty"><div class="big">📝</div><div style="font-size:20px;font-weight:800">Выбери файл слева</div><div style="font-size:14px">или создай новый — заметку или чеклист</div></div>';
    return;
  }
  head.style.display = "flex";
  $("#fileTitle").value = node.name;
  if (node.kind === "note") {
    ed.innerHTML = '<textarea id="noteArea" placeholder="Начни писать..." spellcheck="false">' + esc(node.text || "") + "</textarea>";
    const ta = $("#noteArea");
    ta.addEventListener("input", () => { node.text = ta.value; });
  } else {
    const items = node.items || [];
    const done = items.filter(i => i.done).length;
    const pct = items.length ? Math.round(done / items.length * 100) : 0;
    ed.innerHTML =
      '<div class="prog"><i style="width:' + pct + '%"></i></div>' +
      '<div id="chkList">' + items.map(i =>
        '<div class="chk-item ' + (i.done ? "done" : "") + '" data-iid="' + i.id + '">' +
        '<button class="chk-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg></button>' +
        '<span class="chk-text">' + esc(i.text) + "</span>" +
        '<button class="chk-del">' + SVG.x + "</button>" +
        "</div>").join("") +
      "</div>" +
      '<div id="chkAdd"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" style="color:var(--muted)"><path d="M12 5v14M5 12h14"/></svg>' +
      '<input id="chkInput" placeholder="Добавить задачу и нажми Enter"></div>';
    $("#chkList").addEventListener("click", e => {
      const row = e.target.closest(".chk-item");
      if (!row) return;
      const it = items.find(x => x.id === row.dataset.iid);
      if (e.target.closest(".chk-box")) { it.done = !it.done; row.classList.toggle("done"); refreshProg(node); }
      if (e.target.closest(".chk-del")) { row.style.opacity = "0"; row.style.transform = "translateX(30px)"; setTimeout(() => { node.items = items.filter(x => x.id !== it.id); renderEditor(); }, 260); }
    });
    const inp = $("#chkInput");
    const add = () => {
      const v = inp.value.trim();
      if (!v) return;
      items.push({ id: uid(), text: v, done: false });
      renderEditor();
      const ni = $("#chkInput"); if (ni) ni.focus();
    };
    inp.addEventListener("keydown", e => { if (e.key === "Enter") add(); });
    $("#chkAdd").addEventListener("click", e => { if (e.target.id === "chkAdd") inp.focus(); });
  }
}

function refreshProg(node) {
  const items = node.items || [];
  const done = items.filter(i => i.done).length;
  const bar = document.querySelector(".prog i");
  if (bar) bar.style.width = (items.length ? Math.round(done / items.length * 100) : 0) + "%";
}

function newUser(name) {
  return {
    id: uid(), name, avatar: null, theme: "light", bg: null, font: "Manrope", radius: 16,
    customCss: {}, activeFile: null, open: {},
    tree: [{ id: uid(), kind: "note", name: "Добро пожаловать 🌸", text: "Это твоё новое пространство Okami Notes.\n\n— Создавай папки и файлы кнопками слева\n— Перетаскивай файлы в папки (если включено)\n— Жми SAVE, чтобы сохранить всё\n— Шестерёнка сверху откроет кастомизацию\n\nУдачи!", items: [] }]
  };
}

function openApp() {
  $("#landing").classList.add("hide");
  $("#app").classList.add("show");
  applyAll();
  renderTree();
  renderEditor();
}

$("#startBtn").addEventListener("click", () => {
  if (!DB.users.length) { showOv("#nameOv"); setTimeout(() => $("#nameInput").focus(), 380); }
  else { U = DB.users.find(u => u.id === DB.active) || DB.users[0]; DB.active = U.id; openApp(); }
});
function showOv(sel) { $(sel).classList.add("on"); }
function hideOv(sel) { $(sel).classList.remove("on"); }
document.querySelectorAll(".overlay").forEach(ov => ov.addEventListener("click", e => { if (e.target === ov) ov.classList.remove("on"); }));

$("#nameGo").addEventListener("click", () => {
  const n = $("#nameInput").value.trim() || "Okami";
  U = newUser(n); DB.users.push(U); DB.active = U.id; persist();
  hideOv("#nameOv"); openApp(); toast("Привет, " + n + "!");
});
$("#nameInput").addEventListener("keydown", e => { if (e.key === "Enter") $("#nameGo").click(); });

let pickKind = "note";
$("#newFileBtn").addEventListener("click", () => { $("#fileNameInput").value = ""; showOv("#fileOv"); setTimeout(() => $("#fileNameInput").focus(), 380); });
document.querySelectorAll(".opt-card").forEach(c => c.addEventListener("click", () => {
  document.querySelectorAll(".opt-card").forEach(x => x.classList.remove("pick"));
  c.classList.add("pick"); pickKind = c.dataset.kind;
}));
$("#fileCreate").addEventListener("click", () => {
  const n = { id: uid(), kind: pickKind, name: $("#fileNameInput").value.trim() || (pickKind === "note" ? "Новая заметка" : "Новый чеклист"), text: "", items: [] };
  U.tree.push(n); U.activeFile = n.id;
  hideOv("#fileOv"); renderTree(); renderEditor(); toast("Файл создан");
});
$("#newFolderBtn").addEventListener("click", () => { $("#folderNameInput").value = ""; showOv("#folderOv"); setTimeout(() => $("#folderNameInput").focus(), 380); });
$("#folderCreate").addEventListener("click", () => {
  U.tree.push({ id: uid(), kind: "folder", name: $("#folderNameInput").value.trim() || "Новая папка", allowNesting: $("#nestChk").checked, children: [], open: true });
  hideOv("#folderOv"); renderTree(); toast("Папка создана");
});

$("#tree").addEventListener("click", e => {
  const del = e.target.closest("[data-del]");
  if (del) {
    e.stopPropagation();
    const id = del.dataset.del;
    if (U.activeFile === id) U.activeFile = null;
    removeNode(U.tree, id);
    renderTree(); renderEditor(); toast("Удалено");
    return;
  }
  const row = e.target.closest(".node-row");
  if (!row) return;
  const id = row.dataset.id;
  const node = findNode(U.tree, id);
  if (node.kind === "folder") {
    const wrap = row.parentElement;
    const willOpen = wrap.classList.contains("closed");
    wrap.classList.toggle("closed"); wrap.classList.toggle("open");
    U.open[id] = willOpen;
  } else {
    U.activeFile = id;
    renderTree(); renderEditor();
  }
});
$("#tree").addEventListener("dblclick", e => {
  const row = e.target.closest(".node-row");
  if (!row) return;
  const node = findNode(U.tree, row.dataset.id);
  const v = prompt("Переименовать:", node.name);
  if (v && v.trim()) { node.name = v.trim(); renderTree(); renderEditor(); }
});

let dragId = null;
$("#tree").addEventListener("dragstart", e => {
  const row = e.target.closest(".node-row");
  if (row) { dragId = row.dataset.id; e.dataTransfer.effectAllowed = "move"; }
});
$("#tree").addEventListener("dragover", e => {
  e.preventDefault();
  document.querySelectorAll(".node-row.drop").forEach(r => r.classList.remove("drop"));
  const row = e.target.closest(".node-row");
  if (!row || !dragId || row.dataset.id === dragId) return;
  const node = findNode(U.tree, row.dataset.id);
  if (node.kind === "folder" && node.allowNesting && !isDescendant(findNode(U.tree, dragId), node.id)) {
    row.classList.add("drop");
  }
});
$("#tree").addEventListener("dragleave", e => { const row = e.target.closest(".node-row"); if (row) row.classList.remove("drop"); });
$("#tree").addEventListener("drop", e => {
  e.preventDefault();
  document.querySelectorAll(".node-row.drop").forEach(r => r.classList.remove("drop"));
  if (!dragId) return;
  const row = e.target.closest(".node-row");
  let targetFolder = null;
  if (row) {
    const node = findNode(U.tree, row.dataset.id);
    if (node.kind === "folder" && node.allowNesting && !isDescendant(findNode(U.tree, dragId), node.id)) targetFolder = node;
  }
  const src = findNode(U.tree, dragId);
  removeNode(U.tree, dragId);
  if (targetFolder) { targetFolder.children = targetFolder.children || []; targetFolder.children.push(src); U.open[targetFolder.id] = true; }
  else U.tree.push(src);
  dragId = null;
  renderTree(); toast(targetFolder ? "Перемещено в «" + targetFolder.name + "»" : "Перемещено в корень");
});

$("#fileTitle").addEventListener("input", e => {
  const node = findNode(U.tree, U.activeFile);
  if (node) { node.name = e.target.value; renderTree(); }
});
$("#delFileBtn").addEventListener("click", () => {
  if (!U.activeFile) return;
  removeNode(U.tree, U.activeFile);
  U.activeFile = null;
  renderTree(); renderEditor(); toast("Файл удалён");
});

function doSave() {
  persist();
  const b = $("#saveBtn");
  b.classList.remove("saved"); void b.offsetWidth; b.classList.add("saved");
  toast("Всё сохранено ✦");
}
$("#saveBtn").addEventListener("click", doSave);
document.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); doSave(); } });

$("#themeBtn").addEventListener("click", () => {
  U.theme = U.theme === "dark" ? "light" : "dark";
  applyAll();
});
document.addEventListener("click", e => {
  const b = e.target.closest("#saveBtn,.m-btn,#startBtn,.tool-btn");
  if (!b) return;
  const r = document.createElement("span");
  const rect = b.getBoundingClientRect();
  const s = Math.max(rect.width, rect.height);
  r.className = "ripple";
  r.style.cssText = "width:" + s + "px;height:" + s + "px;left:" + (e.clientX - rect.left - s / 2) + "px;top:" + (e.clientY - rect.top - s / 2) + "px";
  b.appendChild(r);
  setTimeout(() => r.remove(), 600);
});

$("#gearBtn").addEventListener("click", () => { $("#settings").classList.add("on"); syncSettings(); });
$("#setClose").addEventListener("click", () => $("#settings").classList.remove("on"));
function syncSettings() {
  $("#fontSel").value = U.font;
  $("#radiusRange").value = U.radius;
  $("#darkChk").checked = U.theme === "dark";
  loadCssArea();
}
$("#darkChk").addEventListener("change", e => { U.theme = e.target.checked ? "dark" : "light"; applyAll(); });
$("#fontSel").addEventListener("change", e => { U.font = e.target.value; applyAll(); });
$("#radiusRange").addEventListener("input", e => { U.radius = +e.target.value; applyAll(); });
$("#bgInput").addEventListener("change", e => {
  const f = e.target.files[0];
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => { U.bg = rd.result; applyAll(); toast("Фон обновлён"); };
  rd.readAsDataURL(f);
});
$("#bgClear").addEventListener("click", () => { U.bg = null; applyAll(); toast("Фон убран"); });

const cssMap = { app: "#app", sidebar: "#sidebar", editor: "#editor", tree: "#tree", buttons: ".tool-btn,.icon-btn,#saveBtn,.m-btn", modal: ".modal-card" };
function loadCssArea() { $("#cssArea").value = (U.customCss && U.customCss[$("#cssSel").value]) || ""; }
$("#cssSel").addEventListener("change", loadCssArea);
$("#cssApply").addEventListener("click", () => {
  U.customCss = U.customCss || {};
  U.customCss[$("#cssSel").value] = $("#cssArea").value;
  applyAll(); toast("CSS применён");
});

$("#avatarBtn").addEventListener("click", () => { renderUsers(); showOv("#userOv"); });
/* function renderUsers() {
  $("#uList").innerHTML = DB.users.map(u =>
    '<div class="u-item ' + (u.id === U.id ? "cur" : "") + '" data-uid="' + u.id + '">' +
    '<div class="u-av">' + (u.avatar ? '<img src="' + u.avatar + '">' : u.name.charAt(0).toUpperCase()) + "</div>" +
    '<span class="nm">' + esc(u.name) + "</span>" +
    (u.id === U.id ? '<span style="font-size:11px;color:var(--accent);font-weight:800">это ты</span>' : "") +
    "</div>").join("");
}
$("#uList").addEventListener("click", e => {
  const it = e.target.closest(".u-item");
  if (!it || it.dataset.uid === U.id) return;
  DB.active = it.dataset.uid;
  U = DB.users.find(u => u.id === DB.active);
  persist(); hideOv("#userOv"); applyAll(); renderTree(); renderEditor(); toast("Привет, " + U.name + "!");
});
*/
function renderUsers() {
  $("#uList").innerHTML = DB.users.map(u =>
    '<div class="u-item ' + (u.id === U.id ? "cur" : "") + '" data-uid="' + u.id + '">' +
    '<div class="u-av">' + (u.avatar ? '<img src="' + u.avatar + '">' : u.name.charAt(0).toUpperCase()) + "</div>" +
    '<span class="nm">' + esc(u.name) + "</span>" +
    (u.id === U.id ? '<span style="font-size:11px;color:var(--accent);font-weight:800">это ты</span>' : "") +
    (DB.users.length > 1
      ? '<button class="u-del" data-deluid="' + u.id + '" title="Удалить пользователя и его файлы">' + SVG.x + "</button>"
      : "") +
    "</div>").join("");
}
$("#uList").addEventListener("click", e => {
  const delBtn = e.target.closest("[data-deluid]");
  if (delBtn) {
    e.stopPropagation();
    if (DB.users.length <= 1) return;
    const id = delBtn.dataset.deluid;
    const victim = DB.users.find(u => u.id === id);
    if (!victim) return;
    if (!confirm("Удалить пользователя «" + victim.name + "» и все его файлы?")) return;

    DB.users = DB.users.filter(u => u.id !== id);

    if (U.id === id) {
      U = DB.users[0];
      DB.active = U.id;
      applyAll();
      renderTree();
      renderEditor();
    }

    persist();
    renderUsers();
    toast("Пользователь удалён");
    return;
  }

  const it = e.target.closest(".u-item");
  if (!it || it.dataset.uid === U.id) return;
  DB.active = it.dataset.uid;
  U = DB.users.find(u => u.id === DB.active);
  persist(); hideOv("#userOv"); applyAll(); renderTree(); renderEditor();
  toast("Привет, " + U.name + "!");
});
$("#renameBtn").addEventListener("click", () => {
  const v = $("#renameInput").value.trim();
  if (!v) return;
  U.name = v; $("#renameInput").value = "";
  persist(); renderUsers(); applyAll(); toast("Имя изменено");
});
$("#addUserBtn").addEventListener("click", () => {
  const v = $("#addUserInput").value.trim();
  if (!v) return;
  const nu = newUser(v);
  DB.users.push(nu); DB.active = nu.id; U = nu; $("#addUserInput").value = "";
  persist(); renderUsers(); applyAll(); renderTree(); renderEditor(); toast("Пользователь создан");
});
$("#avatarInput").addEventListener("change", e => {
  const f = e.target.files[0];
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => { U.avatar = rd.result; persist(); renderUsers(); applyAll(); toast("Аватар обновлён"); };
  rd.readAsDataURL(f);
});
$("#wipeBtn").addEventListener("click", () => {
  if (!confirm("Точно сбросить все данные Okami Notes?")) return;
  localStorage.removeItem("okamiNotes");
  location.reload();
});

window.addEventListener("beforeunload", () => { if (U) persist(); });