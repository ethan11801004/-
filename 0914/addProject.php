<?php
// addProject.php
header("Content-Type: application/json");
include "db.php";

// 產生下一個 project_code (10 位數流水)
function getNextProjectCode($conn) {
    $res = $conn->query("SELECT MAX(CAST(project_code AS UNSIGNED)) AS maxCode FROM projects");
    if ($res && $row = $res->fetch_assoc()) {
        $max = intval($row['maxCode']);
        $next = $max + 1;
        return str_pad((string)$next, 10, "0", STR_PAD_LEFT);
    }
    return "0000000001";
}

$name = isset($_POST['name']) ? trim($_POST['name']) : "";
$assignee = isset($_POST['assignee']) ? trim($_POST['assignee']) : "";
$department = isset($_POST['department']) ? trim($_POST['department']) : "";
$supervisor = isset($_POST['supervisor']) ? trim($_POST['supervisor']) : "未指派";
$expected_date = isset($_POST['expected_date']) && $_POST['expected_date'] !== "" ? $_POST['expected_date'] : null;

if ($name === "" || $assignee === "" || $department === "") {
    echo json_encode(["success" => false, "message" => "缺少必要欄位(name/assignee/department)"]);
    exit;
}

$project_code = getNextProjectCode($conn);
$created = round(microtime(true) * 1000);

$sql = "INSERT INTO projects (project_code, name, assignee, department, supervisor, created, expected_date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, '未開始')";
$stmt = $conn->prepare($sql);
$stmt->bind_param("sssssis", $project_code, $name, $assignee, $department, $supervisor, $created, $expected_date);

if ($stmt->execute()) {
    $insertId = $stmt->insert_id;
    echo json_encode(["success" => true, "id" => $insertId, "project_code" => $project_code]);
} else {
    echo json_encode(["success" => false, "message" => "DB error: " . $conn->error]);
}
$stmt->close();
$conn->close();
?>
