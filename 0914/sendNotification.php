<?php
// sendNotification.php
header("Content-Type: application/json");
include "db.php";

$project_id = isset($_POST['project_id']) ? intval($_POST['project_id']) : 0;
$message = isset($_POST['message']) ? trim($_POST['message']) : "";
$supervisor = isset($_POST['supervisor']) ? trim($_POST['supervisor']) : "主管";

if ($project_id <= 0 || $message === "") {
    echo json_encode(["success" => false, "message" => "缺少 project_id 或 message"]);
    exit;
}

$created = round(microtime(true) * 1000);

// notifications 表
$ns = $conn->prepare("INSERT INTO notifications (project_id, text, created) VALUES (?, ?, ?)");
$ns->bind_param("isi", $project_id, $message, $created);

if (!$ns->execute()) {
    echo json_encode(["success" => false, "message" => "通知寫入失敗: " . $conn->error]);
    $ns->close();
    $conn->close();
    exit;
}
$ns->close();

// 也寫一筆 project_logs，標註為主管意見
$logStmt = $conn->prepare("INSERT INTO project_logs (project_id, log_type, content, is_supervisor, created) VALUES (?, 'notif', ?, 1, ?)");
$logStmt->bind_param("isi", $project_id, $message, $created);
$ok = $logStmt->execute();
$logStmt->close();

if ($ok) {
    echo json_encode(["success" => true, "message" => "通知已送出"]);
} else {
    echo json_encode(["success" => false, "message" => "寫入 project_logs 失敗: " . $conn->error]);
}

$conn->close();
?>
