<?php
header("Content-Type: application/json; charset=utf-8");
include "db.php";

$id = $_POST['id'] ?? 0;
$id = intval($id);

if ($id <= 0) {
    echo json_encode(["success" => false, "message" => "無效的回報 ID"]);
    exit;
}

try {
    // 確認回報存在，並取得專案狀態
    $stmt = $pdo->prepare("
        SELECT l.id, p.status 
        FROM logs l 
        JOIN projects p ON l.project_id = p.id 
        WHERE l.id = ?
    ");
    $stmt->execute([$id]);
    $log = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$log) {
        echo json_encode(["success" => false, "message" => "找不到回報 ID {$id}"]);
        exit;
    }

    // 檢查專案狀態
    if ($log['status'] === "已結案") {
        echo json_encode(["success" => false, "message" => "專案已結案，不能刪除回報"]);
        exit;
    }

    // 刪除紀錄
    $stmt = $pdo->prepare("DELETE FROM logs WHERE id = ?");
    $stmt->execute([$id]);

    echo json_encode(["success" => true, "message" => "回報紀錄已刪除"]);
} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => "刪除失敗：" . $e->getMessage()]);
}
