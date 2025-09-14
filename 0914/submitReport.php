<?php
// submitReport.php
header("Content-Type: application/json");
include "db.php";

$project_id = isset($_POST['project_id']) ? intval($_POST['project_id']) : 0;
$content = isset($_POST['content']) ? trim($_POST['content']) : "";
$expected_date = isset($_POST['expected_date']) && $_POST['expected_date'] !== "" ? $_POST['expected_date'] : null;

if ($project_id <= 0 || ($content === "" && $expected_date === null)) {
    echo json_encode(["success" => false, "message" => "缺少 project_id 或回報內容/預計完成日"]);
    exit;
}

// 儲存 log（report）
$created = round(microtime(true) * 1000);
$stmt = $conn->prepare("INSERT INTO project_logs (project_id, log_type, content, is_supervisor, created) VALUES (?, 'report', ?, 0, ?)");
$stmt->bind_param("isi", $project_id, $content, $created);

if ($stmt->execute()) {
    // 若有 expected_date，更新 projects.expected_date
    if ($expected_date !== null) {
        $u = $conn->prepare("UPDATE projects SET expected_date = ? WHERE id = ?");
        $u->bind_param("si", $expected_date, $project_id);
        $u->execute();
        $u->close();
    }
    echo json_encode(["success" => true, "message" => "回報已儲存"]);
} else {
    echo json_encode(["success" => false, "message" => "DB error: " . $conn->error]);
}
$stmt->close();
$conn->close();
?>
