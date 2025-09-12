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
    manualApplied: false
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
  // create notification record
  const nid = genId();
  const time = Date.now();
  notifications.unshift({id:nid, projectId:pid, text:txt, time});
  // write into project logs with reference to nid
  p.logs.push({id: nid, text:`主管意見 (${new Date(time).toLocaleString()}): ${txt}`, type:'notif', time});
  updateNotifyLog();
  renderProjects();
  document.getElementById("notifyText").value = "";
}

/* (撤回) */
function deleteNotification(nid){
  notifications = notifications.filter(n => n.id !== nid);
  // remove from project logs any log with that id
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
  if(logText){
    p.logs.push({id, text: logText, type:'report', time: now});
  }
  // **重要**：回報時不清除預計完成日，且儲存回 p.expectedDate
  if(dateVal){
    p.expectedDate = dateVal;
  }
  if(ta) { ta.value = ""; p.draftReport = ""; }
  renderProjects();
}

/* ---------- 刪除 log（回報或通知撤回） ---------- */
function deleteLog(projectId, logId){
  const p = projects.find(x=>x.id===projectId);
  if(!p) return;
// 禁止刪除主管通知
  const log = p.logs.find(l => l.id === logId);
  if(log && log.type === 'notif'){
    alert("主管發送通知不可刪除。");
    return;
  }
  // ✅ 若為已結案或已停止，不允許刪除
  if(p.status === "已結案" || p.status === "已停止"){
    alert("此專案已結案或已停止，無法刪除紀錄。");
    return;
  }

  // 執行刪除
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
  // 若正在執行中，先累計時間
  if(p.status === "執行中"){
    p.totalTime += Date.now() - p.startTime;
    p.startTime = null;
  }

  // 如果使用者有填入 manual hours 且有預計完成日，套用該人工輸入總工時（以小時為單位）
  if(p.expectedDate && p.manualTotalHours && !p.manualApplied){
    const num = Number(p.manualTotalHours);
    if(!isNaN(num) && num >= 0){
      p.totalTime = num * 3600000; // 轉成毫秒
      p.manualApplied = true;
      p.logs.push({id: genId(), text:`使用者輸入執行總工時 ${num} 小時，已套用於結案時計算效率 (${nowISO()})`, type:'system', time: Date.now()});
    }
  }

  p.status = "已結案";
  p.endAt = Date.now();
  p.logs.push({id: genId(), text:`結案於 ${nowISO()}`, type:'system', time: Date.now()});
  renderProjects();
}

/* 解鎖需密碼 */
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

/* ---------- 優先順序（主管調整） ---------- */
function changePriority(id, newPriority){
  newPriority = Number(newPriority);
  const p = projects.find(x=>x.id===id);
  if(!p) return;
  // 儲存草稿（避免 textarea 被重建清掉）
  saveDrafts();

  // 只針對同人「未結案/未停止」專案排序
  const active = projects
      .filter(x=>x.assignee===p.assignee && x.status!=='已結案' && x.status!=='已停止')
      .sort((a,b)=>a.priority-b.priority);
  
  const others = active.filter(x=>x.id !== p.id);
  const insertIndex = Math.max(0, Math.min(newPriority-1, others.length));
  others.splice(insertIndex, 0, p);
  others.forEach((proj, i) => proj.priority = i+1);

  // 將排序後的 active 專案套回 projects
  projects = projects.map(prj => {
    if(prj.assignee !== p.assignee) return prj;
    if(prj.status==='已結案' || prj.status==='已停止') return prj; // 保留結案/停止順序
    return others.find(x=>x.id===prj.id) || prj;
  });

  p.logs.push({id: genId(), text:`主管修改優先度為 ${newPriority}（${nowISO()}）`, type:'system', time: Date.now()});
  updateFilterOptions();
  updateNotifyOptions();
  renderProjects();
}

/* ---------- 儲存 textarea 草稿（避免重建時遺失） ---------- */
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

/* ---------- 效率計算（小時/天） ---------- */
function efficiency(p){
  // 新邏輯：依據「開立日期(created) / 預定完成日(expectedDate) / 實際完成日(endAt)」計算效率
  // 若沒有預計完成日則無法計算，回傳 "N/A"
  if(!p.expectedDate) return "N/A";

  const createdTs = p.created;
  const expectedTs = new Date(p.expectedDate).getTime();
  const endTs = (p.endAt && (p.status === "已結案" || p.status === "已停止")) ? p.endAt : Date.now();

  const plannedDays = Math.max(1, Math.ceil((expectedTs - createdTs) / 86400000));
  const actualDays = Math.max(1, Math.ceil((endTs - createdTs) / 86400000));

  // 效率 = (預定天數 / 實際天數) * 100%
  const effPercent = (plannedDays / actualDays) * 100;
  return effPercent.toFixed(1) + "%";
}

/* 進度百分比：若有預計完成日，顯示已過天數 / 預定天數 百分比 */
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

  // 先記錄目前選取值
  const currentDept = deptSel.value;
  const currentUser = userSel.value;

  // 取得專案中的部門 / 人員
  const depts = Array.from(new Set(projects.map(p=>p.department)));
  const users = Array.from(new Set(projects.map(p=>p.assignee)));

  // 重建選單
  deptSel.innerHTML = `<option value="all">全部部門</option>` +
    depts.map(d=>`<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("");
  userSel.innerHTML = `<option value="all">全部人員</option>` +
    users.map(u=>`<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join("");

  // 還原原本選擇，若不存在則退回 all
  deptSel.value = depts.includes(currentDept) ? currentDept : "all";
  userSel.value = users.includes(currentUser) ? currentUser : "all";
}


function updateCounters(){
  document.getElementById("cnt-running").textContent = `執行中 ${projects.filter(p=>p.status==="執行中").length}`;
  document.getElementById("cnt-closed").textContent = `已結案 ${projects.filter(p=>p.status==="已結案").length}`;
  document.getElementById("cnt-stopped").textContent = `已停止 ${projects.filter(p=>p.status==="已停止").length}`;
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

  // sort by assignee then priority
  projects.sort((a,b)=> a.assignee === b.assignee ? a.priority - b.priority : a.assignee.localeCompare(b.assignee));

  const list = document.getElementById("projectList");
  list.innerHTML = "";

  projects.filter(p=>{
    let ok = true;
    if(userFilter !== "all") ok = ok && p.assignee === userFilter;
    if(deptFilter !== "all") ok = ok && p.department === deptFilter;
    if(statusFilter === "all"){
      // 「全部」只顯示 未開始 / 執行中 / 已暫停
      ok = ok && (p.status === "未開始" || p.status === "執行中" || p.status === "已暫停");
    } else {
      ok = ok && p.status === statusFilter;
    }
    return ok;
  }).forEach(p=>{
    const elapsedMs = p.totalTime + ((p.status === "執行中" && p.startTime) ? (Date.now() - p.startTime) : 0);

    // priority select options (按同人專案數量)
    const same = projects.filter(x=>x.assignee===p.assignee).sort((a,b)=>a.priority-b.priority);
    let priorityOpts = "";
    for(let i=1;i<=same.length;i++){
      priorityOpts += `<option value="${i}" ${p.priority===i? 'selected':''}>${i}</option>`;
    }

    // progress percent (保留原本，但標示為「進度」)
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

      <div class="log" id="log-${p.id}">
  ${p.logs.map(l => {
    const safe = escapeHtml(l.text);
    if(l.type === 'report'){ // 只對回報加刪除鍵
      return `<div class="msg"><div class="txt">${safe}</div><div><button onclick="deleteLog('${p.id}','${l.id}')">X</button></div></div>`;
    } else { // notif 或 system 不加刪除鍵
      return `<div class="msg"><div class="txt">${safe}</div></div>`;
    }
  }).join('')}
</div>
    `;
    list.appendChild(div);
    
// ✅ 在 DOM 插入後自動滾動到末筆
const logEl = document.getElementById(`log-${p.id}`);
if(logEl){
  logEl.scrollTop = logEl.scrollHeight;
}    
  });
}


/* 更新 timers (避免重建 DOM 造成輸入框被清掉) */
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