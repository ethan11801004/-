<?php
// db.php - MySQL 連線設定 (XAMPP + PHP8)
$host = "localhost";
$user = "root";      // 若你有修改請改這裡
$pass = "11801004";          // 若有密碼請改這裡
$dbname = "project_manager";

$conn = new mysqli($host, $user, $pass, $dbname);
if ($conn->connect_error) {
    // 若在瀏覽器直接開 api，回傳 JSON 方便 debug
    header('Content-Type: application/json');
    echo json_encode(["success" => false, "message" => "DB connect error: " . $conn->connect_error]);
    exit;
}
$conn->set_charset("utf8mb4");
?>
