<?php
// getProjects.php
header("Content-Type: application/json");
include "db.php";

// 讀出 projects
$res = $conn->query("SELECT * FROM projects ORDER BY created DESC");
$projects = [];
if ($res) {
    while ($row = $res->fetch_assoc()) {
        $proj = $row;

        // 取得 logs
        $logsStmt = $conn->prepare("SELECT id, log_type, content, is_supervisor, created FROM project_logs WHERE project_id=? ORDER BY created DESC");
        $logsStmt->bind_param("i", $proj['id']);
        $logsStmt->execute();
        $logsRes = $logsStmt->get_result();
        $logs = [];
        while ($l = $logsRes->fetch_assoc()) {
            $logs[] = $l;
        }
        $logsStmt->close();

        // 取得 notifications
        $notStmt = $conn->prepare("SELECT id, text, created FROM notifications WHERE project_id=? ORDER BY created DESC");
        $notStmt->bind_param("i", $proj['id']);
        $notStmt->execute();
        $notRes = $notStmt->get_result();
        $notifs = [];
        while ($n = $notRes->fetch_assoc()) {
            $notifs[] = $n;
        }
        $notStmt->close();

        // 取得 attachments
        $attStmt = $conn->prepare("SELECT id, file_name, file_type, file_path, uploaded FROM attachments WHERE project_id=? ORDER BY uploaded DESC");
        $attStmt->bind_param("i", $proj['id']);
        $attStmt->execute();
        $attRes = $attStmt->get_result();
        $atts = [];
        while ($a = $attRes->fetch_assoc()) {
            $atts[] = $a;
        }
        $attStmt->close();

        $proj['logs'] = $logs;
        $proj['notifications'] = $notifs;
        $proj['attachments'] = $atts;

        $projects[] = $proj;
    }
}

echo json_encode(["success" => true, "data" => $projects], JSON_UNESCAPED_UNICODE);
$conn->close();
?>
