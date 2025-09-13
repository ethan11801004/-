document.getElementById("toggleSupervisor").addEventListener("click", function(){
  const panel = document.getElementById("supervisorPanel");
  panel.style.display = panel.style.display === "none" ? "block" : "none";
});

const SUPER_PASSWORD = "666666";
let projects = [];        
let notifications = [];

/* ---------- helpers ---------- */
function genId(){ return Date.now().toString(36) + "-" + Math.floor(Math.random()*10000); }
function nowISO(){ return new Date().toLocaleString(); }
function escapeHtml(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }
function formatTime(ms){
  const totalSec = Math.floor(ms/1000);
  const h = Math.floor(totalSec/3600);
  const m = Math.floor((totalSec%3600)/60);
  const s = totalSec%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

/* ---------- 新增專案 ---------- */
function addProject(){
  const name = document.getElementById("projectName").value.trim();
  const assignee = document.getElementById("assignee").value.trim();
  const department = document.getElementById("department").value;
  if(!name || !assignee){ alert("請輸入專案名稱與負責人"); return; }
  const same = projects.filter(p => p.assignee === assignee);
  const priority = same.length + 1;
  const p = {
    id: genId(),
    name, assignee, department, priority,
    status: "未開始",
    startTime: null,
    totalTime: 0,
    created: Date.now(),
    endAt: null,
    logs: [{id: genId(), text:`建立於 ${nowISO()}`, type:'system', time:Date.now()}],
    draftReport: "",
    expectedDate: "",
    manualTotalHours: "",
    manualApplied: false,
    mediaFiles: [] // 新增多媒體陣列
  };
  projects.push(p);
  updateFilterOptions();
  updateNotifyOptions();
  renderProjects();
  document.getElementById("projectName").value = "";
  document.getElementById("assignee").value = "";
}

/* ---------- 通知（針對專案） ---------- */
function updateNotifyOptions(){
  const sel = document.getElementById("notifyProject");
  sel.innerHTML = `<option value="">請選專案</option>`;
  projects.forEach(p=>{
    if(p.status !== "已結案" && p.status !== "已停止"){
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.assignee} - ${p.name}`;
      sel.appendChild(opt);
    }
  });
}

function sendNotification(){
  const pid = document.getElementById("notifyProject").value;
  const txt = document.getElementById("notifyText").value.trim();
  if(!pid){ alert("請選擇專案"); return; }
  if(!txt){ alert("請輸入內容"); return; }
  const p = projects.find(x=>x.id===pid);
  if(!p) return;
  const nid = genId();
  const time = Date.now();
  notifications.unshift({id:nid, projectId:pid, text:txt, time});
  p.logs.push({id: nid, text:`主管意見 (${new Date(time).toLocaleString()}): ${txt}`, type:'notif', time});
  updateNotifyLog();
  renderProjects();
  document.getElementById("notifyText").value = "";
}

/* (撤回) */
function deleteNotification(nid){
  notifications = notifications.filter(n => n.id !== nid);
  projects.forEach(p => {
    p.logs = p.logs.filter(l => l.id !== nid);
  });
  updateNotifyLog();
  renderProjects();
}

function updateNotifyLog(){
  const box = document.getElementById("notifyLog");
  box.innerHTML = "";
  notifications.forEach(n => {
    const div = document.createElement("div");
    div.className = "msg";
    const ts = new Date(n.time).toLocaleString();
    div.innerHTML = `<div class="txt">${escapeHtml(`[${ts}] ${n.text}`)}</div>
                     <div><button onclick="deleteNotification('${n.id}')">❌</button></div>`;
    box.appendChild(div);
  });
}

/* 回報 */
function submitReport(projectId){
  const ta = document.getElementById(`report-${projectId}`);
  const dateEl = document.getElementById(`date-${projectId}`);
  if(!ta && !dateEl) return;
  const text = ta ? ta.value.trim() : "";
  const dateVal = dateEl ? dateEl.value : "";
  if(!text && !dateVal){ alert("請輸入回報內容或填寫預計完成日"); return; }

  const p = projects.find(x=>x.id===projectId);
  if(!p) return;
  if(p.status === "已結案" || p.status === "已停止"){ alert("此專案已結案或已停止，無法回報"); return; }

  const id = genId();
  const now = Date.now();
  let logText = '';
  if(text) logText = `進度回報 (${nowISO()}): ${text}`;

  if(logText || p.mediaFiles.length > 0){
    // ✅ 把目前暫存的 mediaFiles 複製到 log
    p.logs.push({
      id,
      text: logText,
      type:'report',
      time: now,
      attachments: [...p.mediaFiles]  // 複製
    });
    p.mediaFiles = []; // 清空暫存，但 log 裡已經保留
  }

  if(dateVal){
    p.expectedDate = dateVal;
  }

  if(ta) { ta.value = ""; p.draftReport = ""; }
  renderProjects();
}


/* ---------- 刪除 log ---------- */
function deleteLog(projectId, logId){
  const p = projects.find(x=>x.id===projectId);
  if(!p) return;
  const log = p.logs.find(l => l.id === logId);
  if(log && log.type === 'notif'){ alert("主管發送通知不可刪除。"); return; }
  if(p.status === "已結案" || p.status === "已停止"){ alert("此專案已結案或已停止，無法刪除紀錄。"); return; }
  p.logs = p.logs.filter(l => l.id !== logId);
  notifications = notifications.filter(n => n.id !== logId);
  renderProjects();
  updateNotifyLog();
}

/* ---------- 時間/狀態控制 ---------- */
function startProject(id){
  const p = projects.find(x=>x.id===id);
  if(!p) return;
  if(p.status === "已結案" || p.status === "已停止"){
    if(!confirm("專案已結案或已停止。若要解鎖並繼續，按確定並輸入主管密碼。")) return;
    unlockProject(p.id);
    return;
  }
  if(p.status === "執行中") return;
  p.status = "執行中";
  p.startTime = Date.now();
  p.logs.push({id: genId(), text:`開始於 ${nowISO()}`, type:'system', time: Date.now()});
  renderProjects();
}

function pauseProject(id){
  const p = projects.find(x=>x.id===id);
  if(!p || p.status !== "執行中") return;
  const now = Date.now();
  p.totalTime += now - p.startTime;
  p.startTime = null;
  p.status = "已暫停";
  p.logs.push({id: genId(), text:`暫停於 ${nowISO()}`, type:'system', time: now});
  renderProjects();
}

function stopProject(id){
  const p = projects.find(x=>x.id===id);
  if(!p || p.status === "已停止" || p.status === "已結案") return;
  if(p.status === "執行中"){
    p.totalTime += Date.now() - p.startTime;
    p.startTime = null;
  }
  p.status = "已停止";
  p.endAt = Date.now();
  p.logs.push({id: genId(), text:`停止（中止）於 ${nowISO()}`, type:'system', time: Date.now()});
  renderProjects();
}

function closeProject(id){
  const p = projects.find(x=>x.id===id);
  if(!p || p.status === "已結案") return;
  if(p.status === "執行中"){
    p.totalTime += Date.now() - p.startTime;
    p.startTime = null;
  }
  if(p.expectedDate && p.manualTotalHours && !p.manualApplied){
    const num = Number(p.manualTotalHours);
    if(!isNaN(num) && num >= 0){
      p.totalTime = num * 3600000;
      p.manualApplied = true;
      p.logs.push({id: genId(), text:`使用者輸入執行總工時 ${num} 小時，已套用於結案時計算效率 (${nowISO()})`, type:'system', time: Date.now()});
    }
  }
  p.status = "已結案";
  p.endAt = Date.now();
  p.logs.push({id: genId(), text:`結案於 ${nowISO()}`, type:'system', time: Date.now()});
  renderProjects();
}

function unlockProject(projectId){
  const p = projects.find(x=>x.id===projectId);
  if(!p) return;
  const pwd = prompt("輸入主管密碼以解鎖專案：");
  if(pwd === SUPER_PASSWORD){
    p.status = "已暫停";
    p.endAt = null;
    p.logs.push({id: genId(), text:`主管解鎖於 ${nowISO()}`, type:'system', time: Date.now()});
    renderProjects();
  } else {
    alert("密碼錯誤，無法解鎖。");
  }
}

/* ---------- 優先順序 ---------- */
function changePriority(id, newPriority){
  newPriority = Number(newPriority);
  const p = projects.find(x=>x.id===id);
  if(!p) return;
  saveDrafts();
  const active = projects
      .filter(x=>x.assignee===p.assignee && x.status!=='已結案' && x.status!=='已停止')
      .sort((a,b)=>a.priority-b.priority);
  const others = active.filter(x=>x.id !== p.id);
  const insertIndex = Math.max(0, Math.min(newPriority-1, others.length));
  others.splice(insertIndex, 0, p);
  others.forEach((proj, i) => proj.priority = i+1);
  projects = projects.map(prj => {
    if(prj.assignee !== p.assignee) return prj;
    if(prj.status==='已結案' || prj.status==='已停止') return prj;
    return others.find(x=>x.id===prj.id) || prj;
  });
  p.logs.push({id: genId(), text:`主管修改優先度為 ${newPriority}（${nowISO()}）`, type:'system', time: Date.now()});
  updateFilterOptions();
  updateNotifyOptions();
  renderProjects();
}

/* ---------- 儲存 textarea 草稿 ---------- */
function saveDrafts(){
  projects.forEach(p=>{
    const ta = document.getElementById(`report-${p.id}`);
    if(ta) p.draftReport = ta.value;
    const dateEl = document.getElementById(`date-${p.id}`);
    if(dateEl) p.expectedDate = dateEl.value;
    const totalEl = document.getElementById(`totalHours-${p.id}`);
    if(totalEl) p.manualTotalHours = totalEl.value;
  });
}

/* ---------- 效率/進度 ---------- */
function efficiency(p){
  if(!p.expectedDate) return "N/A";
  const createdTs = p.created;
  const expectedTs = new Date(p.expectedDate).getTime();
  const endTs = (p.endAt && (p.status === "已結案" || p.status === "已停止")) ? p.endAt : Date.now();
  const plannedDays = Math.max(1, Math.ceil((expectedTs - createdTs) / 86400000));
  const actualDays = Math.max(1, Math.ceil((endTs - createdTs) / 86400000));
  const effPercent = (plannedDays / actualDays) * 100;
  return effPercent.toFixed(1) + "%";
}

function progressPercent(p){
  if(!p.expectedDate) return null;
  const createdTs = p.created;
  const expectedTs = new Date(p.expectedDate).getTime();
  const endTs = (p.endAt && (p.status === "已結案" || p.status === "已停止")) ? p.endAt : Date.now();
  const totalPlannedDays = Math.max(1, Math.ceil((expectedTs - createdTs) / 86400000));
  const elapsedDays = Math.max(0, Math.ceil((endTs - createdTs) / 86400000));
  const percent = Math.min(100, Math.round((elapsedDays / totalPlannedDays) * 100));
  return { percent, elapsedDays, totalPlannedDays };
}

/* ---------- 篩選選單更新 & counters ---------- */
function updateFilterOptions(){
  const deptSel = document.getElementById("filterDept");
  const userSel = document.getElementById("filterUser");
  const currentDept = deptSel.value;
  const currentUser = userSel.value;
  const depts = Array.from(new Set(projects.map(p=>p.department)));
  const users = Array.from(new Set(projects.map(p=>p.assignee)));
  deptSel.innerHTML = `<option value="all">全部部門</option>` +
    depts.map(d=>`<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("");
  userSel.innerHTML = `<option value="all">全部人員</option>` +
    users.map(u=>`<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join("");
  deptSel.value = depts.includes(currentDept) ? currentDept : "all";
  userSel.value = users.includes(currentUser) ? currentUser : "all";
}

function updateCounters(){
  document.getElementById("cnt-running").textContent = `執行中 ${projects.filter(p=>p.status==="執行中").length}`;
  document.getElementById("cnt-closed").textContent = `已結案 ${projects.filter(p=>p.status==="已結案").length}`;
  document.getElementById("cnt-stopped").textContent = `已停止 ${projects.filter(p=>p.status==="已停止").length}`;
}

/* ---------- 多媒體上傳功能 ---------- */
function handleMediaUpload(projectId){
  const input = document.getElementById(`media-${projectId}`);
  const preview = document.getElementById(`mediaPreview-${projectId}`);
  if(!input || !preview) return;

  const p = projects.find(x=>x.id===projectId);
  if(!p) return;

  Array.from(input.files).forEach(file => {
    const url = URL.createObjectURL(file);
    const fileId = genId();  // 生成唯一 id
    p.mediaFiles.push({id: fileId, name: file.name, type: file.type, url});

    // 建立容器
    const wrapper = document.createElement('div');
    wrapper.style.position = "relative";
    wrapper.style.display = "inline-block";

    let el;
    if(file.type.startsWith('image/')){
  el = document.createElement('img');
  el.src = url;
  el.style.width = "120px";   // 縮圖
  el.style.height = "auto";
  el.style.border = "1px solid #ccc";
  el.style.borderRadius = "4px";
  el.style.cursor = "zoom-in";

  // ✅ 改成 DOM 事件，不用字串屬性
  el.addEventListener("dblclick", () => showImagePreview(url));
}
    else if(file.type.startsWith('video/')){
      el = document.createElement('video');
      el.src = url;
      el.controls = true;
      el.style.width = "150px";
      el.style.height = "auto";
      el.style.border = "1px solid #ccc";
      el.style.borderRadius = "4px";
    }

    // 建立刪除按鈕
    const delBtn = document.createElement('button');
    delBtn.textContent = "✖";
    delBtn.style.position = "absolute";
    delBtn.style.top = "2px";
    delBtn.style.right = "2px";
    delBtn.style.background = "rgba(255,0,0,0.7)";
    delBtn.style.color = "#fff";
    delBtn.style.border = "none";
    delBtn.style.borderRadius = "50%";
    delBtn.style.cursor = "pointer";
    delBtn.onclick = () => {
      // 移除畫面上的元素
      wrapper.remove();
      // 移除專案資料裡的檔案紀錄
      p.mediaFiles = p.mediaFiles.filter(m => m.id !== fileId);
    };

    wrapper.appendChild(el);
    wrapper.appendChild(delBtn);
    preview.appendChild(wrapper);
  });

  input.value = ""; // 清空，允許重複上傳同檔案
}
function showImagePreview(url){
  // 建立遮罩
  const overlay = document.createElement('div');
  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.background = "rgba(0,0,0,0.7)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = 9999;

  // 建立大圖
  const bigImg = document.createElement('img');
  bigImg.src = url;
  bigImg.style.maxWidth = "90%";
  bigImg.style.maxHeight = "90%";
  bigImg.style.borderRadius = "8px";
  bigImg.style.boxShadow = "0 4px 12px rgba(0,0,0,0.5)";
  bigImg.style.cursor = "zoom-out";
  
 overlay.appendChild(bigImg);

  // 點擊遮罩或圖片都能關閉
  overlay.addEventListener("click", () => overlay.remove());

  document.body.appendChild(overlay);
}

/* ---------- 主渲染 ---------- */
function renderProjects(){
  saveDrafts();
  updateCounters();
  updateFilterOptions();
  updateNotifyOptions();
  updateNotifyLog();
  const userFilter = document.getElementById("filterUser").value;
  const deptFilter = document.getElementById("filterDept").value;
  const statusFilter = document.getElementById("filterStatus").value;
  projects.sort((a,b)=> a.assignee === b.assignee ? a.priority - b.priority : a.assignee.localeCompare(b.assignee));
  const list = document.getElementById("projectList");
  list.innerHTML = "";
  projects.filter(p=>{
    let ok = true;
    if(userFilter !== "all") ok = ok && p.assignee === userFilter;
    if(deptFilter !== "all") ok = ok && p.department === deptFilter;
    if(statusFilter === "all") ok = ok && (p.status === "未開始" || p.status === "執行中" || p.status === "已暫停");
    else ok = ok && p.status === statusFilter;
    return ok;
  }).forEach(p=>{
    const elapsedMs = p.totalTime + ((p.status === "執行中" && p.startTime) ? (Date.now() - p.startTime) : 0);
    const same = projects.filter(x=>x.assignee===p.assignee).sort((a,b)=>a.priority-b.priority);
    let priorityOpts = "";
    for(let i=1;i<=same.length;i++){
      priorityOpts += `<option value="${i}" ${p.priority===i? 'selected':''}>${i}</option>`;
    }
    const prog = progressPercent(p);
    const progHtml = prog ? `<div class="small">進度：${prog.percent}%（${prog.elapsedDays}/${prog.totalPlannedDays} 天）</div>` : '';
    const div = document.createElement("div");
    div.className = "task";
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
        <div style="flex:1">
          <strong>${escapeHtml(p.name)}</strong>
          <div class="meta">${escapeHtml(p.assignee)} ／ ${escapeHtml(p.department)} ／ 優先 ${p.priority}</div>
          ${progHtml}
        </div>
        <div style="text-align:right">
          <div class="small">累積工時</div>
          <div style="font-weight:700" id="elapsed-${p.id}">${formatTime(elapsedMs)}</div>
          <div class="small">效率：${efficiency(p)}</div>
        </div>
      </div>

      <div style="margin-top:8px">
        <label style="margin:6px 0 4px">優先度 (1 = 最高)</label>
        <select style="width:20%;" onchange="changePriority('${p.id}', this.value)">${priorityOpts}</select>
      </div>

      <div class="controls" style="margin-top:8px">
        <button onclick="startProject('${p.id}')" ${p.status==='執行中' ? 'disabled' : ''}>▶ 開始</button>
        <button onclick="pauseProject('${p.id}')" ${p.status!=='執行中' ? 'disabled' : ''}>⏸ 暫停</button>
        <button onclick="stopProject('${p.id}')" ${p.status==='已停止' || p.status==='已結案' ? 'disabled' : ''}>■ 停止（中止）</button>
        <button onclick="closeProject('${p.id}')" ${p.status==='已結案' ? 'disabled' : ''}>✅ 結案</button>
      </div>

      <div style="margin-top:8px">
        <label style="margin-top:6px">預計完成日</label>
        <input type="date" id="date-${p.id}" value="${p.expectedDate||''}" 
       ${p.status==='已結案'||p.status==='已停止' ? 'disabled' : ''}>
        <label>回報進度</label>
        <textarea id="report-${p.id}" placeholder="${p.status==='已結案'||p.status==='已停止' ? '本專案已結案或已停止，不可回報' : '輸入回報內容'}">${escapeHtml(p.draftReport||'')}</textarea>

        <label style="margin-top:6px">執行總工時</label>
        <input type="number" id="totalHours-${p.id}" min="0" step="0.1" placeholder="例如：12.5" value="${p.manualTotalHours||''}">

        <div style="margin-top:6px">
          <button onclick="submitReport('${p.id}')" ${p.status==='已結案'||p.status==='已停止' ? 'disabled' : ''}>送出回報</button>
        </div>
      </div>

      <div style="margin-top:8px">
        <label>上傳影音/圖片</label>
        <input type="file" id="media-${p.id}" multiple accept="image/*,video/*">
        <div id="mediaPreview-${p.id}" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px"></div>
      </div>

 <div class="log" id="log-${p.id}">
  ${p.logs.map(l => {
    const safe = escapeHtml(l.text);
    let html = "";
    if(l.type === 'report'){ 
      html = `<div class="msg"><div class="txt">${safe}</div><div><button onclick="deleteLog('${p.id}','${l.id}')">X</button></div></div>`;
    } else {
      html = `<div class="msg"><div class="txt">${safe}</div></div>`;
    }

    // ✅ 顯示附件
    if(l.attachments && l.attachments.length > 0){
      html += `<div class="attachments">
        ${l.attachments.map(att => {
          if(att.type.startsWith("image/")){
            return `<div class="file-preview">
                      <img src="${att.url}" style="width:120px;cursor:zoom-in;border:1px solid #ccc;border-radius:4px"
                           ondblclick="showImagePreview('${att.url}')">
                      <div class="filename">${escapeHtml(att.name)}</div>
                    </div>`;
          } else if(att.type.startsWith("video/")){
            return `<div class="file-preview">
                      <video src="${att.url}" controls style="width:160px;max-height:120px"></video>
                      <div class="filename">${escapeHtml(att.name)}</div>
                    </div>`;
          } else {
            return `<div class="file-preview">
                      <a href="${att.url}" download="${escapeHtml(att.name)}">📄 ${escapeHtml(att.name)}</a>
                    </div>`;
          }
        }).join('')}
      </div>`;
    }
    return html;
  }).join('')}

`;
    list.appendChild(div);

    const logEl = document.getElementById(`log-${p.id}`);
    if(logEl) logEl.scrollTop = logEl.scrollHeight;

    const mediaInput = document.getElementById(`media-${p.id}`);
    if(mediaInput) mediaInput.onchange = ()=> handleMediaUpload(p.id);
  });
}

/* 更新 timers */
function updateTimers(){
  projects.forEach(p=>{
    const el = document.getElementById(`elapsed-${p.id}`);
    if(!el) return;
    const elapsedMs = p.totalTime + ((p.status === "執行中" && p.startTime) ? (Date.now() - p.startTime) : 0);
    el.textContent = formatTime(elapsedMs);
  });
  updateCounters();
}

/* ---------- 初始化 ---------- */
updateFilterOptions();
updateNotifyOptions();
updateNotifyLog();
renderProjects();
setInterval(updateTimers, 1000);



