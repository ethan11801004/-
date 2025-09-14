<?php
// index.php
?>
<!DOCTYPE html>
<html lang="en" >
<head>
  <meta charset="UTF-8">
  <title>專案管理系統</title>
  <link rel="stylesheet" href="index_styles.css">

</head>
<body>
<!-- partial:index.partial.html -->
<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8"/>
<title>專案管理系統</title>
<style></style>
</head>
<body>
<h1 id="dynamicTitle">📝專案管理系統🖋️</h1>
<div class="container">
<div class="card">
<button id="toggleSupervisor" style="width:20%;margin-bottom:8px;" onclick="toggleSupervisorPanel()">📌 主管指派專案</button>

  <div id="supervisorPanel" style="display:none">
<label>專案名稱</label>
<input id="projectName" placeholder="專案名稱">
<label>負責人</label>
<input id="assignee" placeholder="負責人員">
<label>開立部門</label>
<select style="width:20%;" id="department">
<option value="1771製程工程部">1771製程工程部</option>
<option value="1731設備工程部">1731設備工程部</option>
<option value="1741品保中心">1741品保中心</option>
</select>

<div style="margin-top:10px;"><button onclick="addProject()">➕ 新增專案</button>
<button onclick="logoutSupervisor()">🔚登出</button></div>
<hr style="margin:12px 0;border:none;border-top:1px solid #0000FF">

<h3>主管通知</h3>
<label>選擇專案</label>
<select id="notifyProject"><option value="">請選專案</option></select>
<label>通知內容</label>
<textarea id="notifyText" placeholder="輸入主管意見..."></textarea>
<div style="margin-top:8px;"><button onclick="sendNotification()">發送通知</button></div>
<div id="notifyLog" class="small" style="margin-top:12px;"></div>
</div>
  <hr style="margin:12px 0;border:none;border-top:1px solid #0000FF">
<div class="card wide">
<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;">
<div class="card2">
<h3>執行專案管理</h3>
<strong>專案清單</strong>
<span class="counters">
<span class="badge" id="cnt-running">執行中 0</span>
<span class="badge" id="cnt-closed">已結案 0</span>
<span class="badge" id="cnt-stopped">已停止 0</span>
</span>
</div>

<div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
<div>
<label style="margin:0 6px 9 0">篩選部門</label>
<select id="filterDept" onchange="renderProjects()"><option value="all">全部部門</option></select>
  </div>
    <div>
<label style="margin:0 6px 9 0">篩選人員</label>
<select id="filterUser" onchange="renderProjects()"><option value="all">全部人員</option></select>
       </div>
    <div>
<label style="margin:0 6px 9 0">篩選狀態</label>
<select id="filterStatus" onchange="renderProjects()">
<option value="all">全部</option>
<option value="未開始">未開始</option>
<option value="執行中">執行中</option>
<option value="已暫停">已暫停</option>
<option value="已結案">已結案</option>
<option value="已停止">已停止</option>
</select>
</div>
  </div>
   </div>
 <div id="projectList" style="margin-top:12px"></div>
</div>
</div>
 <script  src="./main.js"></script>
</body>
</html>

