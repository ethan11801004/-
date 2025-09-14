<?php
header("Content-Type: application/json; charset=utf-8");
include "db.php"; // 連線

$id = $_POST['id'] ?? 0;
$id = intval($id);

if ($id <= 0) {
    echo json_encode(["success" => false, "message" => "無效的附件 ID"]);
    exit;
}

try {
    // 找檔案
    $stmt = $pdo->prepare("SELECT file_path FROM attachments WHERE id = ?");
    $stmt->execute([$id]);
    $file = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$file) {
        echo json_encode(["success" => false, "message" => "找不到附件 ID {$id}"]);
        exit;
    }

    // 先刪除檔案（處理相對路徑）
    $fullPath = __DIR__ . "/" . $file['file_path'];
    if ($file['file_path'] && file_exists($fullPath)) {
        unlink($fullPath);
    }

    // 再刪除資料
    $stmt = $pdo->prepare("DELETE FROM attachments WHERE id = ?");
    $stmt->execute([$id]);

    echo json_encode(["success" => true, "message" => "附件已刪除"]);
} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => "刪除失敗：" . $e->getMessage()]);
}
