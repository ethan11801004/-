let projects = [];
let notifications = [];
const SUPER_PASSWORD = "666666";

function genId(){ return Date.now().toString(36) + "-" + Math.floor(Math.random()*10000); }
function escapeHtml(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }
function formatTime(ms){ let sec=Math.floor(ms/1000); const h=String(Math.floor(sec/3600)).padStart(2,"0"); sec%=3600; const m=String(Math.floor(sec/60)).padStart(2,"0"); const s=String(sec%60).padStart(2,"0"); return `${h}:${m}:${s}`; }

function addProject(){
  const name = document.getElementById("projectName").value.trim();
  const assignee = document.getElementById("assignee").value.trim();
  if(!name||!assignee){ alert("請輸入專案名稱與負責人"); return; }
  const same = projects.filter(p=>p.assignee===assignee);
  const pr = same.length+1;
  const p={id:genId(),name,assignee,priority:pr,status:"未開始",startTime:null,totalTime:0,logs:[`建立於 ${new Date().toLocaleString()}`],draftReport:""};
  projects.push(p);
  updateFilterOptions();
  updateNotifyOptions();
  renderProjects();
  document.getElementById("projectName").value="";
}

function sendNotification(){
  const sel=document.getElementById("notifyProject");
  const txt=document.getElementById("notifyText").value.trim();
  if(!txt) return;
  const selectedId = sel.value;
  if(!selectedId){ alert("請選擇專案"); return; }
  const p=projects.find(x=>x.id===selectedId);
  if(!p) return;
  p.logs.push(`主管意見 (${new Date().toLocaleString()}): ${txt}`);
  document.getElementById("notifyLog").innerHTML=`已對 ${p.assignee} - ${p.name} 發送通知`;
  document.getElementById("notifyText").value="";
  renderProjects();
}

function saveDrafts(){ projects.forEach(p=>{ const ta=document.getElementById(`report-${p.id}`); if(ta)p.draftReport=ta.value; }); }

function changePriority(id,newPriority){
  saveDrafts();
  newPriority=parseInt(newPriority);
  const p=projects.find(x=>x.id===id);
  if(!p)return;
  const same=projects.filter(x=>x.assignee===p.assignee).sort((a,b)=>a.priority-b.priority);
  const others=same.filter(x=>x.id!==p.id);
  const insertIndex=Math.max(0,Math.min(newPriority-1,others.length));
  others.splice(insertIndex,0,p);
  others.forEach((proj,i)=>proj.priority=i+1);
  projects=projects.map(prj=>prj.assignee===p.assignee?(others.find(x=>x.id===prj.id)||prj):prj);
  p.logs.push(`主管修改優先度為 ${newPriority}（${new Date().toLocaleString()}）`);
  renderProjects();
}

function startProject(id){
  const p=projects.find(x=>x.id===id);
  if(!p)return;
  if(p.status==="已結案"||p.status==="已停止"){ alert("此專案已結案或已停止，需主管解鎖才能啟動"); unlockProject(p); return; }
  if(p.status==="執行中") return;
  p.status="執行中"; p.startTime=Date.now();
  p.logs.push(`開始於 ${new Date().toLocaleString()}`);
  renderProjects();
}

function unlockProject(p){
  const pwd=prompt("輸入主管密碼以解鎖專案");
  if(pwd===SUPER_PASSWORD){ p.status="未開始"; renderProjects(); }
  else alert("密碼錯誤");
}

function pauseProject(id){
  const p=projects.find(x=>x.id===id);
  if(!p||p.status!=="執行中")return;
  p.totalTime+=Date.now()-p.startTime; p.startTime=null;
  p.status="已暫停";
  p.logs.push(`暫停於 ${new Date().toLocaleString()}`);
  renderProjects();
}

function stopProject(id){
  const p=projects.find(x=>x.id===id);
  if(!p||p.status==="已停止"||p.status==="已結案") return;
  if(p.status==="執行中")p.totalTime+=Date.now()-p.startTime; p.startTime=null;
  p.status="已停止"; p.logs.push(`停止（中止）於 ${new Date().toLocaleString()}`);
  renderProjects();
}

function closeProject(id){
  const p=projects.find(x=>x.id===id);
  if(!p||p.status==="已結案")return;
  if(p.status==="執行中")p.totalTime+=Date.now()-p.startTime; p.startTime=null;
  p.status="已結案"; p.logs.push(`結案於 ${new Date().toLocaleString()}`);
  renderProjects();
}

function submitReport(id){
  const ta=document.getElementById(`report-${id}`);
  if(!ta)return;
  const txt=ta.value.trim();
  if(!txt)return;
  const p=projects.find(x=>x.id===id);
  if(!p)return;
  if(p.status==="已結案"||p.status==="已停止"){ alert("此專案已結案或已停止，無法回報"); return; }
  p.logs.push(`進度回報 (${new Date().toLocaleString()}): ${txt}`);
  p.draftReport=""; ta.value="";
  const logEl=document.getElementById(`log-${p.id}`);
  if(logEl) logEl.innerHTML=p.logs.map(escapeHtml).join("<br>");
}

function updateFilterOptions(){
  const sel=document.getElementById("filterUser");
  const current=sel.value||"all";
  const users=Array.from(new Set(projects.map(p=>p.assignee)));
  sel.innerHTML=`<option value="all">全部人員</option>`;
  users.forEach(u=>{ const opt=document.createElement("option"); opt.value=u; opt.textContent=u; sel.appendChild(opt); });
  sel.value=Array.from(sel.options).some(o=>o.value===current)? current:"all";
}

function updateNotifyOptions(){
  const sel=document.getElementById("notifyProject");
  sel.innerHTML=`<option value="">請選擇專案</option>`;
  projects.forEach(p=>{
    if(p.status!=="已結案" && p.status!=="已停止"){
      const opt=document.createElement("option");
      opt.value=p.id; opt.textContent=`${p.assignee} - ${p.name}`;
      sel.appendChild(opt);
    }
  });
}

function updateCounters(){
  document.getElementById("cnt-running").textContent=`執行中 ${projects.filter(p=>p.status==="執行中").length}`;
  document.getElementById("cnt-closed").textContent=`已結案 ${projects.filter(p=>p.status==="已結案").length}`;
  document.getElementById("cnt-stopped").textContent=`已停止 ${projects.filter(p=>p.status==="已停止").length}`;
}

function renderProjects(){
  saveDrafts();
  const userFilter=document.getElementById("filterUser").value;
  const statusFilter=document.getElementById("filterStatus").value;
  projects.sort((a,b)=>a.assignee===b.assignee?a.priority-b.priority:a.assignee.localeCompare(b.assignee));
  updateCounters(); updateNotifyOptions();
  const list=document.getElementById("projectList"); list.innerHTML="";
  projects.filter(p=>{
    let pass=true;
    if(userFilter!=="all") pass=pass && p.assignee===userFilter;
    if(statusFilter==="all") pass=pass && (p.status==="未開始"||p.status==="執行中"||p.status==="已暫停");
    else if(statusFilter!=="all") pass=pass && p.status===statusFilter;
    return pass;
  }).forEach(p=>{
    const same=projects.filter(x=>x.assignee===p.assignee).sort((a,b)=>a.priority-b.priority);
    let opts=""; for(let i=1;i<=same.length;i++) opts+=`<option value="${i}" ${p.priority===i?"selected":""}>${i}</option>`;
    const elapsedMs=p.totalTime+(p.status==="執行中"&&p.startTime?(Date.now()-p.startTime):0);
    const div=document.createElement("div"); div.className="task";
    div.innerHTML=`
<div style="display:flex; justify-content:space-between; gap:8px; align-items:flex-start;">
<div style="flex:1">
<strong>${escapeHtml(p.name)}</strong> <span class="small">(${escapeHtml(p.assignee)})</span><br>
<div class="small">狀態：${escapeHtml(p.status)}</div>
</div>
<div style="text-align:right;">
<div class="small">累積工時</div>
<div style="font-weight:700;" id="elapsed-${p.id}">${formatTime(elapsedMs)}</div>
</div>
</div>

<div style="margin-top:8px;">
<label style="margin:6px 0 4px;">優先度 (1 = 最高)</label>
<select onchange="changePriority('${p.id}', this.value)">${opts}</select>
</div>

<div class="controls" style="margin-top:8px;">
<button onclick="startProject('${p.id}')" ${p.status==="執行中"?'disabled':''}>▶ 開始</button>
<button onclick="pauseProject('${p.id}')" ${p.status!=="執行中"?'disabled':''}>⏸ 暫停</button>
<button onclick="stopProject('${p.id}')" ${p.status==="已停止"||p.status==="已結案"?'disabled':''}>■ 停止（中止）</button>
<button onclick="closeProject('${p.id}')" ${p.status==="已結案"?'disabled':''}>✅ 結案</button>
</div>

<div style="margin-top:8px;">
<label>回報進度</label>
<textarea id="report-${p.id}" placeholder="${p.status==="已結案"||p.status==="已停止"?'本專案已結案或已停止，不可回報':'輸入進度並按送出'}">${escapeHtml(p.draftReport||'')}</textarea>
<div style="margin-top:6px;">
<button onclick="submitReport('${p.id}')" ${p.status==="已結案"||p.status==="已停止"?'disabled':''}>送出回報</button>
</div>
</div>

<div class="log" id="log-${p.id}">${p.logs.map(escapeHtml).join("<br>")}</div>
`;
    list.appendChild(div);
  });
}

function updateTimers(){
  projects.forEach(p=>{
    const el=document.getElementById(`elapsed-${p.id}`);
    if(!el) return;
    const elapsedMs=p.totalTime+(p.status==="執行中"&&p.startTime?(Date.now()-p.startTime):0);
    el.textContent=formatTime(elapsedMs);
  });
  updateCounters();
}

/* 初始化 */
updateFilterOptions();
updateNotifyOptions();
renderProjects();
setInterval(updateTimers,1000);