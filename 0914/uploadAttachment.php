<?php
// uploadAttachment.php
header("Content-Type: application/json");
include "db.php";

if (!isset($_POST['project_id']) || !isset($_FILES['file'])) {
    echo json_encode(["success" => false, "message" => "缺少 project_id 或 file"]);
    exit;
}

$project_id = intval($_POST['project_id']);
$file = $_FILES['file'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(["success" => false, "message" => "上傳錯誤 code: " . $file['error']]);
    exit;
}

$uploadDir = __DIR__ . "/uploads/";
if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);

$originalName = basename($file['name']);
$safeName = preg_replace('/[^A-Za-z0-9_\.\-]/', '_', $originalName);
$saveName = time() . "_" . $safeName;
$targetPath = $uploadDir . $saveName;

if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
    echo json_encode(["success" => false, "message" => "move_uploaded_file 失敗"]);
    exit;
}

// web 可存取路徑 (相對)
$webPath = "uploads/" . $saveName;
$fileType = mime_content_type($targetPath);
$uploaded = round(microtime(true) * 1000);

$stmt = $conn->prepare("INSERT INTO attachments (project_id, file_name, file_type, file_path, uploaded) VALUES (?, ?, ?, ?, ?)");
$stmt->bind_param("isssi", $project_id, $originalName, $fileType, $webPath, $uploaded);

if ($stmt->execute()) {
    $id = $stmt->insert_id;
    echo json_encode(["success" => true, "id" => $id, "file_name" => $originalName, "file_type" => $fileType, "path" => $webPath, "uploaded" => $uploaded]);
} else {
    echo json_encode(["success" => false, "message" => "DB error: " . $conn->error]);
}
$stmt->close();
$conn->close();
?>
