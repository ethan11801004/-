/* main.js — 完整版（可對接後端，若無後端則使用 local memory） */

const SUPER_PASSWORD = "666666";
let projects = [];        // 主要資料來源（若使用後端，會由 getProjects.php 填入）
let notifications = [];
let currentSupervisor = null; // 記錄目前登入者（簡單 session 機制）

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

function safeFetch(url, opts = {}, fallback = null){
  // wrapper to gracefully handle fetch failures
  return fetch(url, opts).then(r=>{
    if(!r.ok) throw new Error("http "+r.status);
    return r.json().catch(()=>{ throw new Error("invalid json"); });
  }).catch(err=>{
    console.warn("fetch error", url, err);
    return fallback;
  });
}

/* ---------- Supervisor UI ---------- */
function logoutSupervisor() {
  if (confirm("確定要登出嗎？")) {
    currentSupervisor = null;
    document.getElementById("supervisorPanel").style.display = "none";
    alert("已登出，可以重新登入其他帳號");
  }
}

function toggleSupervisorPanel() {
  if (!currentSupervisor) {
    const user = prompt("請輸入帳號:");
    const pass = prompt("請輸入密碼:");

    // (可改為呼叫後端驗證) — 目前使用硬編碼帳號
    if ((user === "陳維塘" && pass === "123") ||
        (user === "user2" && pass === "456") ||
        (user === "user3" && pass === "789")
       )
    {
      currentSupervisor = user;
      alert("登入成功，歡迎 " + user);
      const panel = document.getElementById("supervisorPanel");
      if(panel) panel.style.display = "block";
    } else {
      alert("帳號或密碼錯誤！");
    }
  } else {
    const panel = document.getElementById("supervisorPanel");
    if(panel) panel.style.display = panel.style.display === "none" ? "block" : "none";
  }
}

/* ---------- DB-aware helpers ---------- */
function loadProjectsFromServer(){
  // 從 getProjects.php 取得整合資料：projects + logs + attachments + notifications
  safeFetch("getProjects.php", {}, null).then(resp=>{
    if(!resp) {
      // 無伺服器：保留目前 local projects（或先填入空）
      renderProjects();
      return;
    }
    if(resp.success && Array.isArray(resp.data)){
      // map to internal shape
      projects = resp.data.map(p => ({
        id: p.id,
        projectCode: p.project_code || p.projectCode || '',
        name: p.name,
        assignee: p.assignee,
        department: p.department,
        priority: Number(p.priority || 1),
        supervisor: p.supervisor || '未指派',
        status: p.status || '未開始',
        startTime: p.start_time ? Number(p.start_time) : null,
        totalTime: p.total_time ? Number(p.total_time) : 0,
        created: p.created ? Number(p.created) : Date.now(),
        endAt: p.end_at ? Number(p.end_at) : null,
        draftReport: p.draft_report || '',
        expectedDate: p.expected_date || '',
        manualTotalHours: p.manual_total_hours || '',
        manualApplied: p.manual_applied==1,
        logs: p.logs ? p.logs.map(l=>({
          id: l.id,
          text: l.content,
          type: l.log_type,
          time: Number(l.created),
          isSupervisor: l.is_supervisor==1,
          attachments: l.attachments || []
        })) : [],
        attachments: p.attachments || [], // server-side attachments
        notifications: p.notifications || [],
        mediaFiles: [] // client-side not-yet-uploaded items
      }));
      // rebuild global notifications for notifyLog
      notifications = [];
      projects.forEach(pr => {
        (pr.notifications||[]).forEach(n => notifications.push({ id: n.id, projectId: pr.id, text: n.text, time: Number(n.created) }));
      });
      renderProjects();
    } else {
      // fallback local
      renderProjects();
    }
  });
}

/* ---------- 專案編號生成 ---------- */
function getNextProjectCode() {
  if (projects.length === 0) return '0000000001';
  const numericCodes = projects.map(p=>{
    const v = Number(p.projectCode || p.project_code || 0);
    return isNaN(v)?0:v;
  });
  const maxCode = Math.max(...numericCodes,0);
  const nextCode = maxCode + 1;
  return String(nextCode).padStart(10, '0');
}

/* ---------- 新增專案（會嘗試呼叫後端 addProject.php） ---------- */
function addProject(){
  const name = document.getElementById("projectName").value.trim();
  const assignee = document.getElementById("assignee").value.trim();
  const department = document.getElementById("department").value;
  if(!name || !assignee){ alert("請輸入專案名稱與負責人"); return; }

  const form = new FormData();
  form.append("name", name);
  form.append("assignee", assignee);
  form.append("department", department);
  if(currentSupervisor) form.append("supervisor", currentSupervisor);

  fetch("addProject.php", { method: "POST", body: form })
    .then(r=>r.json())
    .then(res=>{
      if(res && res.success){
        loadProjectsFromServer();
        document.getElementById("projectName").value = "";
        document.getElementById("assignee").value = "";
      } else {
        // 若後端沒回應成功，則 fallback 到 local
        const same = projects.filter(p => p.assignee === assignee);
        const priority = same.length + 1;
        const p = {
          id: genId(),
          projectCode: getNextProjectCode(),
          name, assignee, department, priority,
          supervisor: currentSupervisor || "未指派",
          status: "未開始",
          startTime: null,
          totalTime: 0,
          created: Date.now(),
          endAt: null,
          logs: [],
          draftReport: "",
          expectedDate: "",
          manualTotalHours: "",
          manualApplied: false,
          mediaFiles: []
        };
        projects.push(p);
        updateFilterOptions();
        updateNotifyOptions();
        renderProjects();
        document.getElementById("projectName").value = "";
        document.getElementById("assignee").value = "";
      }
    })
    .catch(err=>{
      console.warn("addProject error, fallback local", err);
      // fallback local: create project client-side
      const same = projects.filter(p => p.assignee === assignee);
      const priority = same.length + 1;
      const p = {
        id: genId(),
        projectCode: getNextProjectCode(),
        name, assignee, department, priority,
        supervisor: currentSupervisor || "未指派",
        status: "未開始",
        startTime: null,
        totalTime: 0,
        created: Date.now(),
        endAt: null,
        logs: [],
        draftReport: "",
        expectedDate: "",
        manualTotalHours: "",
        manualApplied: false,
        mediaFiles: []
      };
      projects.push(p);
      updateFilterOptions();
      updateNotifyOptions();
      renderProjects();
      document.getElementById("projectName").value = "";
      document.getElementById("assignee").value = "";
    });
}

/* ---------- 通知（針對專案） ---------- */
function updateNotifyOptions(){
  const sel = document.getElementById("notifyProject");
  if(!sel) return;
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

  const form = new FormData();
  form.append("project_id", pid);
  form.append("text", txt);
  if(currentSupervisor) form.append("supervisor", currentSupervisor);

  fetch("sendNotification.php", { method: "POST", body: form })
    .then(r=>r.json())
    .then(res=>{
      if(res && res.success){
        loadProjectsFromServer();
        document.getElementById("notifyText").value = "";
      } else {
        // fallback local
        const nid = genId();
        const time = Date.now();
        notifications.unshift({id:nid, projectId:pid, text:txt, time});
        const p = projects.find(x=>x.id==pid);
        if(p){
          p.logs.push({ id: nid, text:`主管意見 (${new Date(time).toLocaleString()}): ${txt}`, type:'report', time, isSupervisor:true });
        }
        updateNotifyLog();
        renderProjects();
        document.getElementById("notifyText").value = "";
      }
    }).catch(err=>{
      console.warn("sendNotification failed, fallback local", err);
      const nid = genId();
      const time = Date.now();
      notifications.unshift({id:nid, projectId:pid, text:txt, time});
      const p = projects.find(x=>x.id==pid);
      if(p){
        p.logs.push({ id: nid, text:`主管意見 (${new Date(time).toLocaleString()}): ${txt}`, type:'report', time, isSupervisor:true });
      }
      updateNotifyLog();
      renderProjects();
      document.getElementById("notifyText").value = "";
    });
}

function deleteNotification(nid){
  fetch("deleteNotification.php", { method: "POST", headers: {"Content-Type":"application/x-www-form-urlencoded"}, body: `id=${encodeURIComponent(nid)}` })
    .then(r=>r.json())
    .then(res=>{
      if(res && res.success){
        loadProjectsFromServer();
      } else {
        notifications = notifications.filter(n => n.id !== nid);
        projects.forEach(p => p.logs = p.logs.filter(l => l.id !== nid));
        updateNotifyLog();
        renderProjects();
      }
    }).catch(err=>{
      console.warn("deleteNotification fail", err);
      notifications = notifications.filter(n => n.id !== nid);
      projects.forEach(p => p.logs = p.logs.filter(l => l.id !== nid));
      updateNotifyLog();
      renderProjects();
    });
}

function updateNotifyLog(){
  const box = document.getElementById("notifyLog");
  if(!box) return;
  box.innerHTML = "";
  notifications.sort((a,b)=> b.time - a.time);
  notifications.forEach(n => {
    const div = document.createElement("div");
    div.className = "msg";
    const ts = new Date(n.time).toLocaleString();
    div.innerHTML = `<div class="txt">${escapeHtml(`[${ts}] ${n.text}`)}</div>
                     <div><button onclick="deleteNotification('${n.id}')">❌</button></div>`;
    box.appendChild(div);
  });
}

/* ---------- 回報（含附件） ---------- */
function submitReport(projectId){
  const ta = document.getElementById(`report-${projectId}`);
  const dateEl = document.getElementById(`date-${projectId}`);
  if(!ta && !dateEl) return;
  const text = ta ? ta.value.trim() : "";
  const dateVal = dateEl ? dateEl.value : "";
  if(!text && !dateVal){ alert("請輸入回報內容或填寫預計完成日"); return; }

  const form = new FormData();
  form.append("project_id", projectId);
  form.append("content", text);
  if(dateVal) form.append("expected_date", dateVal);
  if(currentSupervisor) form.append("supervisor", currentSupervisor);

  fetch("submitReport.php", { method: "POST", body: form })
    .then(r=>r.json())
    .then(res=>{
      if(res && res.success){
        loadProjectsFromServer();
      } else {
        // fallback local
        const p = projects.find(x=>x.id==projectId);
        if(!p){ alert("找不到專案"); return; }
        const id = genId();
        const now = Date.now();
        const logText = text ? `進度回報 (${nowISO()}): ${text}` : "";
        p.logs.push({ id, text: logText, type: 'report', time: now, isSupervisor: false, attachments: [...p.mediaFiles] });
        p.mediaFiles = [];
        if(dateVal) p.expectedDate = dateVal;
        if(ta) ta.value = "";
        renderProjects();
      }
    }).catch(err=>{
      console.warn("submitReport error, fallback local", err);
      const p = projects.find(x=>x.id==projectId);
      if(!p){ alert("找不到專案"); return; }
      const id = genId();
      const now = Date.now();
      const logText = text ? `進度回報 (${nowISO()}): ${text}` : "";
      p.logs.push({ id, text: logText, type: 'report', time: now, isSupervisor: false, attachments: [...p.mediaFiles] });
      p.mediaFiles = [];
      if(dateVal) p.expectedDate = dateVal;
      if(ta) ta.value = "";
      renderProjects();
    });
}

/* ---------- 刪除 log（server 或 local） ---------- */
function deleteLog(projectId, logId){
  if(!confirm("確定要刪除此回報紀錄？")) return;
  fetch("deleteLog.php", { method: "POST", headers: {"Content-Type":"application/x-www-form-urlencoded"}, body: `id=${encodeURIComponent(logId)}` })
    .then(r=>r.json())
    .then(res=>{
      if(res && res.success) loadProjectsFromServer();
      else {
        const p = projects.find(x=>x.id==projectId);
        if(p){ p.logs = p.logs.filter(l=>l.id!=logId); renderProjects(); }
      }
    }).catch(err=>{
      console.warn("deleteLog fail", err);
      const p = projects.find(x=>x.id==projectId);
      if(p){ p.logs = p.logs.filter(l=>l.id!=logId); renderProjects(); }
    });
}

/* ---------- 時間/狀態控制（會呼叫 updateProjectStatus.php） ---------- */
function startProject(id){
  fetch("updateProjectStatus.php", { method: "POST", headers: {"Content-Type":"application/x-www-form-urlencoded"}, body: `id=${encodeURIComponent(id)}&action=start` })
    .then(r=>r.json())
    .then(res=>{ if(res && res.success) loadProjectsFromServer(); else fallbackStart(id); })
    .catch(()=>fallbackStart(id));
}
function fallbackStart(id){
  const p = projects.find(x=>x.id==id);
  if(!p) return;
  if(p.status==='已結案' || p.status==='已停止'){ if(!confirm("專案已結案/停止，要解鎖嗎？")) return; unlockProject(p.id); return; }
  if(p.status==='執行中') return;
  p.status='執行中'; p.startTime = Date.now();
  p.logs.push({id: genId(), text:`開始於 ${nowISO()}`, type:'system', time: Date.now()});
  renderProjects();
}

function pauseProject(id){
  fetch("updateProjectStatus.php", { method: "POST", headers: {"Content-Type":"application/x-www-form-urlencoded"}, body: `id=${encodeURIComponent(id)}&action=pause` })
    .then(r=>r.json())
    .then(res=>{ if(res && res.success) loadProjectsFromServer(); else fallbackPause(id); })
    .catch(()=>fallbackPause(id));
}
function fallbackPause(id){
  const p = projects.find(x=>x.id==id);
  if(!p || p.status!=='執行中') return;
  const now = Date.now();
  p.totalTime += now - p.startTime;
  p.startTime = null;
  p.status = '已暫停';
  p.logs.push({id: genId(), text:`暫停於 ${nowISO()}`, type:'system', time: now});
  renderProjects();
}

function stopProject(id){
  if(!confirm("確定中止專案？")) return;
  fetch("updateProjectStatus.php", { method: "POST", headers: {"Content-Type":"application/x-www-form-urlencoded"}, body: `id=${encodeURIComponent(id)}&action=stop` })
    .then(r=>r.json())
    .then(res=>{ if(res && res.success) loadProjectsFromServer(); else fallbackStop(id); })
    .catch(()=>fallbackStop(id));
}
function fallbackStop(id){
  const p = projects.find(x=>x.id==id);
  if(!p || p.status==='已停止' || p.status==='已結案') return;
  if(p.status==='執行中'){ p.totalTime += Date.now()-p.startTime; p.startTime = null; }
  p.status = '已停止'; p.endAt = Date.now();
  p.logs.push({id: genId(), text:`停止（中止）於 ${nowISO()}`, type:'system', time: Date.now()});
  renderProjects();
}

function closeProject(id){
  fetch("updateProjectStatus.php", { method: "POST", headers: {"Content-Type":"application/x-www-form-urlencoded"}, body: `id=${encodeURIComponent(id)}&action=close` })
    .then(r=>r.json())
    .then(res=>{ if(res && res.success) loadProjectsFromServer(); else fallbackClose(id); })
    .catch(()=>fallbackClose(id));
}
function fallbackClose(id){
  const p = projects.find(x=>x.id==id);
  if(!p || p.status==='已結案') return;
  if(p.status==='執行中'){ p.totalTime += Date.now()-p.startTime; p.startTime=null; }
  if(p.expectedDate && p.manualTotalHours && !p.manualApplied){
    const num = Number(p.manualTotalHours);
    if(!isNaN(num) && num>=0){ p.totalTime = num*3600000; p.manualApplied = true; p.logs.push({id: genId(), text:`使用者輸入執行總工時 ${num} 小時，已套用於結案時計算效率 (${nowISO()})`, type:'system', time: Date.now()}); }
  }
  p.status = '已結案'; p.endAt = Date.now();
  p.logs.push({id: genId(), text:`結案於 ${nowISO()}`, type:'system', time: Date.now()});
  renderProjects();
}

function unlockProject(projectId){
  const pwd = prompt("輸入主管密碼以解鎖專案：");
  if(!pwd) return;
  fetch("unlockProject.php", { method: "POST", headers: {"Content-Type":"application/x-www-form-urlencoded"}, body: `id=${encodeURIComponent(projectId)}&pwd=${encodeURIComponent(pwd)}` })
    .then(r=>r.json())
    .then(res=>{ if(res && res.success) loadProjectsFromServer(); else fallbackUnlock(projectId, pwd); })
    .catch(()=>fallbackUnlock(projectId, pwd));
}
function fallbackUnlock(projectId, pwd){
  if(pwd === SUPER_PASSWORD){
    const p = projects.find(x=>x.id==projectId);
    if(!p) return;
    p.status = '已暫停'; p.endAt = null; p.logs.push({id: genId(), text:`主管解鎖於 ${nowISO()}`, type:'system', time: Date.now()});
    renderProjects();
  } else alert("密碼錯誤，無法解鎖。");
}

/* ---------- 優先順序 ---------- */
function changePriority(id, newPriority){
  const form = new URLSearchParams();
  form.append("id", id);
  form.append("priority", newPriority);
  fetch("changePriority.php", { method: "POST", headers: {"Content-Type":"application/x-www-form-urlencoded"}, body: form.toString() })
    .then(r=>r.json())
    .then(res=>{ if(res && res.success) loadProjectsFromServer(); else fallbackChangePriority(id, newPriority); })
    .catch(()=>fallbackChangePriority(id, newPriority));
}
function fallbackChangePriority(id, newPriority){
  newPriority = Number(newPriority);
  const p = projects.find(x=>x.id==id);
  if(!p) return;
  saveDrafts();
  const active = projects.filter(x=>x.assignee===p.assignee && x.status!=='已結案' && x.status!=='已停止').sort((a,b)=>a.priority-b.priority);
  const others = active.filter(x=>x.id !== p.id);
  const insertIndex = Math.max(0, Math.min(newPriority-1, others.length));
  others.splice(insertIndex, 0, p);
  others.forEach((proj,i)=>proj.priority = i+1);
  projects = projects.map(prj=>{
    if(prj.assignee !== p.assignee) return prj;
    if(prj.status==='已結案' || prj.status==='已停止') return prj;
    return others.find(x=>x.id===prj.id) || prj;
  });
  p.logs.push({id: genId(), text:`主管修改優先度為 ${newPriority}（${nowISO()}）`, type:'system', time: Date.now()});
  updateFilterOptions(); updateNotifyOptions(); renderProjects();
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
  const createdTs = Number(p.created);
  const expectedTs = new Date(p.expectedDate).getTime();
  const endTs = (p.endAt && (p.status === "已結案" || p.status === "已停止")) ? Number(p.endAt) : Date.now();
  const plannedDays = Math.max(1, Math.ceil((expectedTs - createdTs) / 86400000));
  const actualDays = Math.max(1, Math.ceil((endTs - createdTs) / 86400000));
  const effPercent = (plannedDays / actualDays) * 100;
  return effPercent.toFixed(1) + "%";
}
function progressPercent(p){
  if(!p.expectedDate) return null;
  const createdTs = Number(p.created);
  const expectedTs = new Date(p.expectedDate).getTime();
  const endTs = (p.endAt && (p.status === "已結案" || p.status === "已停止")) ? Number(p.endAt) : Date.now();
  const totalPlannedDays = Math.max(1, Math.ceil((expectedTs - createdTs) / 86400000));
  const elapsedDays = Math.max(0, Math.ceil((endTs - createdTs) / 86400000));
  const percent = Math.min(100, Math.round((elapsedDays / totalPlannedDays) * 100));
  return { percent, elapsedDays, totalPlannedDays };
}

/* ---------- 篩選選單更新 & counters ---------- */
function updateFilterOptions(){
  const deptSel = document.getElementById("filterDept");
  const userSel = document.getElementById("filterUser");
  if(!deptSel || !userSel) return;
  const currentDept = deptSel.value;
  const currentUser = userSel.value;
  const depts = Array.from(new Set(projects.map(p=>p.department))).filter(Boolean);
  const users = Array.from(new Set(projects.map(p=>p.assignee))).filter(Boolean);
  deptSel.innerHTML = `<option value="all">全部部門</option>` +
    depts.map(d=>`<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("");
  userSel.innerHTML = `<option value="all">全部人員</option>` +
    users.map(u=>`<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join("");
  deptSel.value = depts.includes(currentDept) ? currentDept : "all";
  userSel.value = users.includes(currentUser) ? currentUser : "all";
}

function updateCounters(){
  const run = projects.filter(p=>p.status==="執行中").length;
  const closed = projects.filter(p=>p.status==="已結案").length;
  const stopped = projects.filter(p=>p.status==="已停止").length;
  const e = document.getElementById("cnt-running");
  const c = document.getElementById("cnt-closed");
  const s = document.getElementById("cnt-stopped");
  if(e) e.textContent = `執行中 ${run}`;
  if(c) c.textContent = `已結案 ${closed}`;
  if(s) s.textContent = `已停止 ${stopped}`;
}

/* ---------- 多媒體上傳（立即上傳到 server，若失敗則保留本地 preview） ---------- */
function handleMediaUpload(projectId){
  const input = document.getElementById(`media-${projectId}`);
  const preview = document.getElementById(`mediaPreview-${projectId}`);
  if(!input || !preview) return;
  const p = projects.find(x=>x.id==projectId);
  if(!p) return;
  const files = Array.from(input.files);
  if(files.length===0) return;

  files.forEach(file=>{
    const url = URL.createObjectURL(file);
    const fileId = genId();
    // 本地預覽
    const wrapper = document.createElement('div');
    wrapper.style.position = "relative";
    wrapper.style.display = "inline-block";
    wrapper.style.marginRight = "6px";
    let el;
    if(file.type.startsWith('image/')){
      el = document.createElement('img'); el.src = url; el.style.width="120px"; el.style.border="1px solid #ccc"; el.style.borderRadius="4px"; el.style.cursor="zoom-in";
      el.addEventListener("dblclick", ()=> showImagePreview(url));
    } else if(file.type.startsWith('video/')){
      el = document.createElement('video'); el.src = url; el.controls = true; el.style.width="150px";
    } else {
      el = document.createElement('div'); el.textContent = file.name; el.style.padding="6px";
    }
    const delBtn = document.createElement('button');
    delBtn.textContent = "✖";
    delBtn.style.position = "absolute"; delBtn.style.top="2px"; delBtn.style.right="2px";
    delBtn.style.background="rgba(255,0,0,0.7)"; delBtn.style.color="#fff"; delBtn.style.border="none"; delBtn.style.borderRadius="50%"; delBtn.style.cursor="pointer";

    wrapper.appendChild(el); wrapper.appendChild(delBtn);
    preview.appendChild(wrapper);

    // 先在 client 記錄（以便押下送出回報時可一起附上）
    p.mediaFiles.push({ id: fileId, name: file.name, type: file.type, url });

    // 立即上傳到 server（若 server 可用）
    const fd = new FormData();
    fd.append("project_id", projectId);
    fd.append("file", file);
    fetch("uploadAttachment.php", { method: "POST", body: fd })
      .then(r=>r.json())
      .then(res=>{
        if(res && res.success){
          // update server attachments
          p.attachments = p.attachments || [];
          p.attachments.unshift({ id: res.id, file_name: res.file_name, file_type: res.file_type, file_path: res.path, uploaded: res.uploaded });
          // change delBtn behavior to delete server file
          delBtn.onclick = ()=>{
            if(!confirm("確定刪除伺服器上的檔案？")) return;
            fetch("deleteAttachment.php", { method: "POST", headers: {"Content-Type":"application/x-www-form-urlencoded"}, body: `id=${encodeURIComponent(res.id)}` })
              .then(r=>r.json()).then(rj=>{
                if(rj && rj.success){
                  wrapper.remove();
                  p.attachments = p.attachments.filter(a=>a.id!=res.id);
                } else alert("刪除失敗");
              }).catch(()=>alert("刪除失敗"));
          };
        } else {
          // server 上傳失敗：delBtn 刪除本地預覽與 client-side 記錄
          delBtn.onclick = ()=>{
            wrapper.remove();
            p.mediaFiles = p.mediaFiles.filter(m=>m.id!==fileId);
          };
        }
      }).catch(err=>{
        console.warn("uploadAttachment failed", err);
        delBtn.onclick = ()=>{
          wrapper.remove();
          p.mediaFiles = p.mediaFiles.filter(m=>m.id!==fileId);
        };
      });
  });

  input.value = "";
}

function showImagePreview(url){
  const overlay = document.createElement('div');
  overlay.style.position = "fixed"; overlay.style.top = 0; overlay.style.left = 0; overlay.style.width = "100vw"; overlay.style.height = "100vh";
  overlay.style.background = "rgba(0,0,0,0.7)"; overlay.style.display = "flex"; overlay.style.alignItems = "center"; overlay.style.justifyContent = "center"; overlay.style.zIndex = 9999;
  const bigImg = document.createElement('img'); bigImg.src = url; bigImg.style.maxWidth="90%"; bigImg.style.maxHeight="90%"; bigImg.style.borderRadius="8px"; bigImg.style.boxShadow="0 4px 12px rgba(0,0,0,0.5)"; bigImg.style.cursor="zoom-out";
  overlay.appendChild(bigImg);
  overlay.addEventListener("click", ()=> overlay.remove());
  document.body.appendChild(overlay);
}

/* ---------- 翻頁 ---------- */
let currentIndex = 0;
function prevPage(){ if(currentIndex>0){ currentIndex--; renderProjects(); } }
function nextPage(){ if(currentIndex < filteredProjects.length-1){ currentIndex++; renderProjects(); } }

/* ---------- 主渲染 ---------- */
let filteredProjects = [];

function renderProjects(){
  saveDrafts();
  updateCounters();
  updateFilterOptions();
  updateNotifyOptions();
  updateNotifyLog();

  const userFilterEl = document.getElementById("filterUser");
  const deptFilterEl = document.getElementById("filterDept");
  const statusFilterEl = document.getElementById("filterStatus");
  const userFilter = userFilterEl ? userFilterEl.value : "all";
  const deptFilter = deptFilterEl ? deptFilterEl.value : "all";
  const statusFilter = statusFilterEl ? statusFilterEl.value : "all";

  projects.sort((a,b)=>{
    if(a.assignee === b.assignee) return (a.priority||0) - (b.priority||0);
    return String(a.assignee||'').localeCompare(String(b.assignee||''));
  });

  const list = document.getElementById("projectList");
  if(!list) return;
  list.innerHTML = "";

  filteredProjects = projects.filter(p=>{
    let ok = true;
    if(userFilter !== "all") ok = ok && p.assignee === userFilter;
    if(deptFilter !== "all") ok = ok && p.department === deptFilter;
    if(statusFilter === "all") ok = ok && (p.status === "未開始" || p.status === "執行中" || p.status === "已暫停");
    else ok = ok && p.status === statusFilter;
    return ok;
  });

  if(filteredProjects.length === 0){
    list.innerHTML = "<p>目前沒有符合條件的專案</p>";
    return;
  }
  if(currentIndex >= filteredProjects.length) currentIndex = filteredProjects.length - 1;
  if(currentIndex < 0) currentIndex = 0;

  const p = filteredProjects[currentIndex];
  const elapsedMs = Number(p.totalTime || 0) + ((p.status === "執行中" && p.startTime) ? (Date.now() - Number(p.startTime)) : 0);
  const same = projects.filter(x=>x.assignee===p.assignee).sort((a,b)=> (a.priority||0)-(b.priority||0));
  let priorityOpts = "";
  for(let i=1;i<=same.length;i++){ priorityOpts += `<option value="${i}" ${p.priority===i? 'selected':''}>${i}</option>`; }
  const prog = progressPercent(p);
  const progHtml = prog ? `<div class="small">進度：${prog.percent}%<br>（${prog.elapsedDays}/${prog.totalPlannedDays} 天）</div>` : '';

  const div = document.createElement("div");
  div.className = "task";
  div.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
      <div style="flex:1">
       <strong class="meta">專案編號: ${escapeHtml(p.projectCode||p.project_code||'')}</strong>
       <br>
       <strong class="meta">專案名稱: ${escapeHtml(p.name)}</strong>
       <div class="meta">建立日期：${p.created? new Date(Number(p.created)).toLocaleString():''}</div>
       <div class="meta">指派人：${escapeHtml(p.supervisor||'')}</div>
        <div class="meta">${escapeHtml(p.assignee||'')} ／ ${escapeHtml(p.department||'')} ／ 優先 ${p.priority||1}</div>
      </div>
      <div style="text-align:right">
        <div class="small">累積工時</div>
        <div style="font-weight:700" id="elapsed-${p.id}">${formatTime(elapsedMs)}</div>
        <div class="small">效率：${efficiency(p)}</div>${progHtml}
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
      <input type="date" id="date-${p.id}" value="${p.expectedDate||''}" ${p.status==='已結案'||p.status==='已停止' ? 'disabled' : ''}>

      <label style="margin-top:6px">執行總工時</label>
      <input type="number" id="totalHours-${p.id}" min="0" step="0.1" placeholder="例如：12.5" value="${p.manualTotalHours||''}">

      <label>回報進度</label>
      <textarea id="report-${p.id}" placeholder="${p.status==='已結案'||p.status==='已停止' ? '本專案已結案或已停止，不可回報' : '輸入回報內容'}">${escapeHtml(p.draftReport||'')}</textarea>
      <div style="margin-top:6px">
        <button onclick="submitReport('${p.id}')" ${p.status==='已結案'||p.status==='已停止' ? 'disabled' : ''}>送出回報</button>
      </div>
    </div>

    <div style="margin-top:8px">
      <label>上傳影音/圖片</label>
      <input type="file" id="media-${p.id}" multiple accept="image/*,video/*">
      <div id="mediaPreview-${p.id}" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px"></div>
      <div style="margin-top:6px" id="serverAttachments-${p.id}"></div>
    </div>

    <div style="margin-top:8px">
      <h4>📋 回報紀錄</h4>
      <div class="log" id="reportLog-${p.id}">
       ${ (p.logs||[]).filter(l => l.type === 'report').map(l => {
         const safe = escapeHtml(l.text || l.content || '');
         let html = `<div class="msg"><div class="txt">${safe}</div>`;
         if(!l.isSupervisor){
           html += `<div><button onclick="deleteLog('${p.id}','${l.id}')">X</button></div>`;
         }
         html += `</div>`;
         // attachments inside logs (client-side or server)
         if(l.attachments && l.attachments.length){
           html += `<div class="attachments">` + l.attachments.map(att=>{
             if(att.type && att.type.startsWith("image/")){
               return `<div class="file-preview"><img src="${att.url||att.file_path}" style="width:120px;cursor:zoom-in;border:1px solid #ccc;border-radius:4px" ondblclick="showImagePreview('${att.url||att.file_path}')"><div class="filename">${escapeHtml(att.name||att.file_name||'')}</div></div>`;
             } else if(att.type && att.type.startsWith("video/")){
               return `<div class="file-preview"><video src="${att.url||att.file_path}" controls style="width:160px;max-height:120px"></video><div class="filename">${escapeHtml(att.name||att.file_name||'')}</div></div>`;
             } else {
               return `<div class="file-preview"><a href="${att.url||att.file_path}" download>${escapeHtml(att.name||att.file_name||'')}</a></div>`;
             }
           }).join('') + `</div>`;
         }
         return html;
       }).join('') }
      </div>
    </div>

    <div style="margin-top:8px">
      <h4 style="cursor:pointer" onclick="toggleSystemLog('${p.id}')">⚙ 系統紀錄（點我展開/收合）</h4>
      <div class="log" id="systemLog-${p.id}" style="display:none;">
        ${ (p.logs||[]).filter(l=>l.type!=='report').map(l => `<div class="msg"><div class="txt">${escapeHtml(l.text||l.content||'')}</div></div>`).join('') }
      </div>
    </div>
  `;
  list.appendChild(div);

  // server attachments area
  const attachDiv = document.getElementById(`serverAttachments-${p.id}`);
  if(attachDiv){
    attachDiv.innerHTML = "";
    if(p.attachments && p.attachments.length){
      p.attachments.forEach(a=>{
        const entry = document.createElement("div");
        entry.className = "msg";
        let preview="";
        if(a.file_type && a.file_type.startsWith("image")){
          preview = `<img src="${a.file_path}" style="width:120px;border:1px solid #ccc;border-radius:4px;cursor:zoom-in" ondblclick="showImagePreview('${a.file_path}')">`;
        } else if(a.file_type && a.file_type.startsWith("video")){
          preview = `<video src="${a.file_path}" controls style="width:160px;max-height:120px"></video>`;
        } else {
          preview = `<a href="${a.file_path}" target="_blank">${escapeHtml(a.file_name)}</a>`;
        }
        entry.innerHTML = `<div class="txt">${preview}<div class="meta">${a.uploaded? new Date(Number(a.uploaded)).toLocaleString():''}</div></div>
                           <div><button onclick="deleteAttachment(${a.id})">刪除</button></div>`;
        attachDiv.appendChild(entry);
      });
    } else {
      attachDiv.innerHTML = "<div class='small'>尚無附件</div>";
    }
  }

  // pagination nav
  const nav = document.createElement("div");
  nav.style.textAlign = "center"; nav.style.marginTop="12px";
  nav.innerHTML = `<button onclick="prevPage()" ${currentIndex===0?'disabled':''}>⬅ 上一頁</button>
                   <span style="margin:0 12px">第 ${currentIndex+1} / ${filteredProjects.length} 頁</span>
                   <button onclick="nextPage()" ${currentIndex===filteredProjects.length-1?'disabled':''}>下一頁 ➡</button>`;
  list.appendChild(nav);

  // wire media input
  const mediaInput = document.getElementById(`media-${p.id}`);
  if(mediaInput) mediaInput.onchange = ()=> handleMediaUpload(p.id);
}

/* update running timers every second */
function updateTimers(){
  const p = filteredProjects[currentIndex];
  if(!p) return;
  const el = document.getElementById(`elapsed-${p.id}`);
  if(!el) return;
  const elapsedMs = Number(p.totalTime || 0) + ((p.status === "執行中" && p.startTime) ? (Date.now() - Number(p.startTime)) : 0);
  el.textContent = formatTime(elapsedMs);
  updateCounters();
}

/* delete attachment (server) */
function deleteAttachment(id){
  if(!confirm("確定從伺服器刪除此附件？")) return;
  fetch("deleteAttachment.php", { method: "POST", headers: {"Content-Type":"application/x-www-form-urlencoded"}, body: `id=${encodeURIComponent(id)}` })
    .then(r=>r.json()).then(res=>{
      if(res && res.success) loadProjectsFromServer();
      else alert("刪除失敗");
    }).catch(()=>alert("刪除失敗"));
}

/* toggle system log */
function toggleSystemLog(projectId){
  const box = document.getElementById(`systemLog-${projectId}`);
  if(!box) return;
  box.style.display = (box.style.display === "none") ? "block" : "none";
}

/* ---------- 初始化 ---------- */
document.addEventListener("DOMContentLoaded", ()=>{
  // 首先嘗試從 server 載入，若失敗則使用本地資料
  loadProjectsFromServer();
  setInterval(updateTimers, 1000);

  // Hook supervisor button if exists
  const btn = document.getElementById("toggleSupervisor");
  if(btn) btn.onclick = toggleSupervisorPanel;
});
