<?php
// ───────────────── HEADERS & CORS CONFIG ─────────────────
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ───────────────── DATABASE CONNECTION ─────────────────
$host = "localhost";
$user = "root";
$pass = "";
$db   = "Stem_Course_Platform";

$conn = mysqli_connect($host, $user, $pass, $db);

if (!$conn) {
    http_response_code(500);
    echo json_encode(["error" => "Database link broke: " . mysqli_connect_error()]);
    exit;
}

// ───────────────── PARAMETERS & INPUT PARSING ─────────────────
$action = $_GET['action'] ?? '';
$table  = $_GET['table']  ?? '';
$body   = json_decode(file_get_contents("php://input"), true) ?? [];

function respond($data) {
    echo json_encode($data);
    exit;
}

// Automatically recalculates completion % and average grade for a specific enrollment
function recalculateEnrollment($conn, $enrollmentID) {
    $enrollmentID = intval($enrollmentID);

    // 1. Get the courseCode for this enrollment
    $cQuery = mysqli_query($conn, "SELECT courseCode FROM enrollments WHERE enrollmentID = $enrollmentID");
    if (!$cQuery) return;
    $cRow = mysqli_fetch_assoc($cQuery);
    if (!$cRow) return;
    $courseCode = mysqli_real_escape_string($conn, $cRow['courseCode']);

    // 2. Count total lessons available for this specific course
    $totalQuery = mysqli_query($conn, "SELECT COUNT(*) as total FROM lessons WHERE courseCode = '$courseCode'");
    $totalRow = mysqli_fetch_assoc($totalQuery);
    $totalLessons = intval($totalRow['total']);

    // 3. Count how many lessons this student has marked completed in this enrollment
    $compQuery = mysqli_query($conn, "SELECT COUNT(*) as done FROM lessonProgress WHERE enrollmentID = $enrollmentID AND isCompleted = 1");
    $compRow = mysqli_fetch_assoc($compQuery);
    $completedLessons = intval($compRow['done']);

    // 4. Calculate average score across ALL tracked lessons for this specific enrollment
    $scoreQuery = mysqli_query($conn, "SELECT AVG(score) as avgScore FROM lessonProgress WHERE enrollmentID = $enrollmentID");
    $scoreRow = mysqli_fetch_assoc($scoreQuery);
    $averageGrade = isset($scoreRow['avgScore']) ? floatval($scoreRow['avgScore']) : 0.00;

    // 5. Compute completion percentage
    $completionPercentage = 0.00;
    if ($totalLessons > 0) {
        $completionPercentage = ($completedLessons / $totalLessons) * 100;
    }
    if ($completionPercentage > 100) $completionPercentage = 100;

    // 6. Strict Status Logic to satisfy chkCompletion and chkInProgress database constraints!
    if ($completionPercentage >= 100.00) {
        $status = "Completed";
        $completionPercentage = 100.00; 
    } elseif ($completionPercentage > 0.00) {
        $status = "In Progress";
    } else {
        $status = "Enrolled";
        $completionPercentage = 0.00;
    }

    // 7. Update the main enrollments table records with precise variables
    $updateStmt = mysqli_prepare($conn, "UPDATE enrollments SET completionStatus=?, completionPercentage=?, finalGrade=? WHERE enrollmentID=?");
    mysqli_stmt_bind_param($updateStmt, "sddi", $status, $completionPercentage, $averageGrade, $enrollmentID);
    mysqli_stmt_execute($updateStmt);
}

// Normalize matching parameter in case your JS requests just "table=dashboard" without an action parameter
$routeKey = "$table:$action";
if ($table === 'dashboard' && empty($action)) {
    $routeKey = "dashboard:metrics";
}

// ───────────────── REQUEST ROUTER ─────────────────
switch ($routeKey) {

    // ================= STUDENTS MODULE =================
    case "students:get":
        $res = mysqli_query($conn, "SELECT studentID, studentName, email, dob, gender, registrationDate FROM students ORDER BY studentID ASC");
        respond(mysqli_fetch_all($res, MYSQLI_ASSOC));
        break;

    case "students:add":
        if (empty($body['studentName']) || empty($body['email']) || empty($body['pwd'])) {
            respond(["error" => "Required fields (Name, Email, and Password) cannot be left empty."]);
        }
        $stmt = mysqli_prepare($conn, "INSERT INTO students (studentName, email, pwd, dob, gender) VALUES (?, ?, ?, ?, ?)");
        mysqli_stmt_bind_param($stmt, "sssss", $body['studentName'], $body['email'], $body['pwd'], $body['dob'], $body['gender']);
        if (mysqli_stmt_execute($stmt)) {
            respond(["success" => true, "id" => mysqli_insert_id($conn)]);
        } else {
            respond(["error" => "Execution failed: " . mysqli_error($conn)]);
        }
        break;

    case "students:update":
        if (!empty($body['pwd'])) {
            $stmt = mysqli_prepare($conn, "UPDATE students SET studentName=?, email=?, pwd=?, dob=?, gender=? WHERE studentID=?");
            mysqli_stmt_bind_param($stmt, "sssssi", $body['studentName'], $body['email'], $body['pwd'], $body['dob'], $body['gender'], $body['studentID']);
        } else {
            $stmt = mysqli_prepare($conn, "UPDATE students SET studentName=?, email=?, dob=?, gender=? WHERE studentID=?");
            mysqli_stmt_bind_param($stmt, "ssssi", $body['studentName'], $body['email'], $body['dob'], $body['gender'], $body['studentID']);
        }
        
        if (mysqli_stmt_execute($stmt)) {
            respond(["success" => true]);
        } else {
            respond(["error" => "Update failure: " . mysqli_error($conn)]);
        }
        break;

    case "students:delete":
        $stmt = mysqli_prepare($conn, "DELETE FROM students WHERE studentID=?");
        mysqli_stmt_bind_param($stmt, "i", $body['studentID']);
        if (mysqli_stmt_execute($stmt)) {
            respond(["success" => true]);
        } else {
            respond(["error" => "Deletion safety constraint block: " . mysqli_error($conn)]);
        }
        break;

    // ================= TEACHERS MODULE =================
    case "teachers:get":
        $res = mysqli_query($conn, "SELECT teacherID, teacherName, email, subjectName, hireDate FROM teachers ORDER BY teacherID ASC");
        respond(mysqli_fetch_all($res, MYSQLI_ASSOC));
        break;

    case "teachers:add":
        if (empty($body['teacherName']) || empty($body['email']) || empty($body['pwd'])) {
            respond(["error" => "Required identification details (Name, Email, Password) cannot be left blank."]);
        }
        $stmt = mysqli_prepare($conn, "INSERT INTO teachers (teacherName, email, pwd, subjectName, hireDate) VALUES (?, ?, ?, ?, ?)");
        mysqli_stmt_bind_param($stmt, "sssss", $body['teacherName'], $body['email'], $body['pwd'], $body['subjectName'], $body['hireDate']);
        if (mysqli_stmt_execute($stmt)) {
            respond(["success" => true, "id" => mysqli_insert_id($conn)]);
        } else {
            respond(["error" => "Database write validation failure: " . mysqli_error($conn)]);
        }
        break;

    case "teachers:update":
        if (!empty($body['pwd'])) {
            $stmt = mysqli_prepare($conn, "UPDATE teachers SET teacherName=?, email=?, pwd=?, subjectName=?, hireDate=? WHERE teacherID=?");
            mysqli_stmt_bind_param($stmt, "sssssi", $body['teacherName'], $body['email'], $body['pwd'], $body['subjectName'], $body['hireDate'], $body['teacherID']);
        } else {
            $stmt = mysqli_prepare($conn, "UPDATE teachers SET teacherName=?, email=?, subjectName=?, hireDate=? WHERE teacherID=?");
            mysqli_stmt_bind_param($stmt, "ssssi", $body['teacherName'], $body['email'], $body['subjectName'], $body['hireDate'], $body['teacherID']);
        }

        if (mysqli_stmt_execute($stmt)) {
            respond(["success" => true]);
        } else {
            respond(["error" => "Update operational error execution failure: " . mysqli_error($conn)]);
        }
        break;

    case "teachers:delete":
        $stmt = mysqli_prepare($conn, "DELETE FROM teachers WHERE teacherID=?");
        mysqli_stmt_bind_param($stmt, "i", $body['teacherID']);
        if (mysqli_stmt_execute($stmt)) {
            respond(["success" => true]);
        } else {
            respond(["error" => "Foreign Key dependency constraint blocked deletion: " . mysqli_error($conn)]);
        }
        break;

    // ================= ADMINS MODULE =================
    case "admins:get":
        $res = mysqli_query($conn, "SELECT adminID, adminName, email, accessLevel, createdAt FROM administrators ORDER BY adminID ASC");
        if (!$res) {
            respond(["error" => "Database Query Failed: " . mysqli_error($conn)]);
        }
        respond(mysqli_fetch_all($res, MYSQLI_ASSOC));
        break;

    case "admins:add":
        if (empty($body['adminName']) || empty($body['email']) || empty($body['pwd']) || empty($body['accessLevel'])) {
            respond(["error" => "Required input fields (Name, Email, Password, Access Level) cannot be blank."]);
        }
        $stmt = mysqli_prepare($conn, "INSERT INTO administrators (adminName, email, pwd, accessLevel) VALUES (?, ?, ?, ?)");
        mysqli_stmt_bind_param($stmt, "ssss", $body['adminName'], $body['email'], $body['pwd'], $body['accessLevel']);
        if (mysqli_stmt_execute($stmt)) {
            respond(["success" => true, "id" => mysqli_insert_id($conn)]);
        } else {
            respond(["error" => "Database insert exception: " . mysqli_error($conn)]);
        }
        break;
        
    case "admins:update":
        if (!empty($body['pwd'])) {
            $stmt = mysqli_prepare($conn, "UPDATE administrators SET adminName=?, email=?, pwd=?, accessLevel=? WHERE adminID=?");
            mysqli_stmt_bind_param($stmt, "ssssi", $body['adminName'], $body['email'], $body['pwd'], $body['accessLevel'], $body['adminID']);
        } else {
            $stmt = mysqli_prepare($conn, "UPDATE administrators SET adminName=?, email=?, accessLevel=? WHERE adminID=?");
            mysqli_stmt_bind_param($stmt, "sssi", $body['adminName'], $body['email'], $body['accessLevel'], $body['adminID']);
        }

        if (mysqli_stmt_execute($stmt)) {
            respond(["success" => true]);
        } else {
            respond(["error" => "Update failure: " . mysqli_error($conn)]);
        }
        break;

    case "admins:delete":
        $stmt = mysqli_prepare($conn, "DELETE FROM administrators WHERE adminID=?");
        mysqli_stmt_bind_param($stmt, "i", $body['adminID']);
        if (mysqli_stmt_execute($stmt)) {
            respond(["success" => true]);
        } else {
            respond(["error" => "Deletion failure: " . mysqli_error($conn)]);
        }
        break;

    // ================= COURSES MODULE =================
    case "courses:get":

        $res = mysqli_query($conn, "
            SELECT 
                c.courseCode,
                c.title,
                c.descriptions,
                c.category,
                c.difficulty,
                c.durationInMinutes,
                c.startDate,
                c.endDate,
                c.maxStudents,
                c.passingGrade,
                c.teacherID,
                c.adminID,
                t.teacherName
            FROM courses c
            LEFT JOIN teachers t
                ON c.teacherID = t.teacherID
            ORDER BY c.courseCode ASC
        ");
    
        if (!$res) {
            respond([
                "error" => mysqli_error($conn)
            ]);
        }
    
        respond(mysqli_fetch_all($res, MYSQLI_ASSOC));
    
        break;
    case "courses:add":
        $stmt = mysqli_prepare($conn, "INSERT INTO courses (courseCode, title, descriptions, category, difficulty, durationInMinutes, startDate, endDate, maxStudents, passingGrade, teacherID, adminID) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        mysqli_stmt_bind_param($stmt, "sssssissidii", 
            $body['courseCode'], $body['title'], $body['descriptions'], $body['category'], $body['difficulty'],
            $body['durationInMinutes'], $body['startDate'], $body['endDate'], $body['maxStudents'], $body['passingGrade'],
            $body['teacherID'], $body['adminID']
        );
        respond(mysqli_stmt_execute($stmt) ? ["success" => true] : ["error" => mysqli_error($conn)]);
        break;

    case "courses:update":
        if (empty($body['courseCode']) || empty($body['title'])) {
            respond(["error" => "Course identifier code and title parameters required."]);
        }

        $stmt = mysqli_prepare($conn, "UPDATE courses SET title=?, descriptions=?, category=?, difficulty=?, durationInMinutes=?, startDate=?, endDate=?, maxStudents=?, passingGrade=?, teacherID=?, adminID=? WHERE courseCode=?");
        mysqli_stmt_bind_param($stmt, "ssssissidiis", 
            $body['title'], $body['descriptions'], $body['category'], $body['difficulty'],
            $body['durationInMinutes'], $body['startDate'], $body['endDate'], $body['maxStudents'], $body['passingGrade'],
            $body['teacherID'], $body['adminID'], $body['courseCode']
        );

        if (mysqli_stmt_execute($stmt)) {
            respond(["success" => true]);
        } else {
            respond(["error" => "Failed to update course configurations: " . mysqli_error($conn)]);
        }
        break;

    case "courses:delete":
        $stmt = mysqli_prepare($conn, "DELETE FROM courses WHERE courseCode=?");
        mysqli_stmt_bind_param($stmt, "s", $body['courseCode']);
        respond(mysqli_stmt_execute($stmt) ? ["success" => true] : ["error" => mysqli_error($conn)]);
        break;

    // ================= LESSONS MODULE =================
    case "lessons:get":
        $res = mysqli_query($conn, "
            SELECT l.lessonID, l.lessonNum, l.lessonTitle, l.lessonDescription, l.contentType, l.durationInMinutes, l.courseCode, c.title AS courseTitle 
            FROM lessons l 
            LEFT JOIN courses c ON l.courseCode = c.courseCode 
            ORDER BY l.lessonID ASC
        ");
        if (!$res) {
            respond(["error" => "Failed to fetch lessons: " . mysqli_error($conn)]);
        }
        respond(mysqli_fetch_all($res, MYSQLI_ASSOC));
        break;

    case "lessons:add":
        if (empty($body['lessonNum']) || empty($body['lessonTitle']) || empty($body['courseCode'])) {
            respond(["error" => "Lesson Number, Title, and Parent Course are required fields."]);
        }
        $stmt = mysqli_prepare($conn, "INSERT INTO lessons (lessonNum, lessonTitle, lessonDescription, contentType, durationInMinutes, courseCode) VALUES (?, ?, ?, ?, ?, ?)");
        mysqli_stmt_bind_param($stmt, "isssis", 
            $body['lessonNum'], $body['lessonTitle'], $body['lessonDescription'], $body['contentType'], $body['durationInMinutes'], $body['courseCode']
        );
        if (mysqli_stmt_execute($stmt)) {
            $courseCode = mysqli_real_escape_string($conn, $body['courseCode']);
            $findEnrollments = mysqli_query($conn, "SELECT enrollmentID FROM enrollments WHERE courseCode = '$courseCode'");
            while ($enrollmentRow = mysqli_fetch_assoc($findEnrollments)) {
                recalculateEnrollment($conn, $enrollmentRow['enrollmentID']);
            }
            respond(["success" => true, "id" => mysqli_insert_id($conn)]);
        } else {
            respond(["error" => "Failed to save lesson: " . mysqli_error($conn)]);
        }
        break;

    case "lessons:update":
        if (empty($body['lessonID']) || empty($body['lessonNum']) || empty($body['lessonTitle']) || empty($body['courseCode'])) {
            respond(["error" => "Missing parameters necessary for modification workflow."]);
        }
        $stmt = mysqli_prepare($conn, "UPDATE lessons SET lessonNum=?, lessonTitle=?, lessonDescription=?, contentType=?, durationInMinutes=?, courseCode=? WHERE lessonID=?");
        mysqli_stmt_bind_param($stmt, "isssisi", 
            $body['lessonNum'], $body['lessonTitle'], $body['lessonDescription'], $body['contentType'], $body['durationInMinutes'], $body['courseCode'], $body['lessonID']
        );
        if (mysqli_stmt_execute($stmt)) {
            $courseCode = mysqli_real_escape_string($conn, $body['courseCode']);
            $findEnrollments = mysqli_query($conn, "SELECT enrollmentID FROM enrollments WHERE courseCode = '$courseCode'");
            while ($enrollmentRow = mysqli_fetch_assoc($findEnrollments)) {
                recalculateEnrollment($conn, $enrollmentRow['enrollmentID']);
            }
            respond(["success" => true]);
        } else {
            respond(["error" => "Failed to update lesson records: " . mysqli_error($conn)]);
        }
        break;

    case "lessons:delete":
        if (empty($body['lessonID'])) {
            respond(["error" => "Missing unique lessonID identifier for record deletion."]);
        }
        $lessonID = intval($body['lessonID']);

        $lessonQuery = mysqli_query($conn, "SELECT courseCode FROM lessons WHERE lessonID = $lessonID");
        $lessonRow = mysqli_fetch_assoc($lessonQuery);

        $stmt = mysqli_prepare($conn, "DELETE FROM lessons WHERE lessonID=?");
        mysqli_stmt_bind_param($stmt, "i", $lessonID);
        if (mysqli_stmt_execute($stmt)) {
            if ($lessonRow) {
                $courseCode = mysqli_real_escape_string($conn, $lessonRow['courseCode']);
                $findEnrollments = mysqli_query($conn, "SELECT enrollmentID FROM enrollments WHERE courseCode = '$courseCode'");
                while ($enrollmentRow = mysqli_fetch_assoc($findEnrollments)) {
                    recalculateEnrollment($conn, $enrollmentRow['enrollmentID']);
                }
            }
            respond(["success" => true]);
        } else {
            respond(["error" => "Deletion process failed: " . mysqli_error($conn)]);
        }
        break;

    // ================= ENROLLMENTS MODULE =================
    case "enrollments:get":

        $res = mysqli_query($conn, "

            SELECT e.enrollmentID, e.studentID, e.courseCode, e.completionStatus, e.completionPercentage, e.finalGrade, e.enrollmentDate,

                   s.studentName, c.title AS courseTitle

            FROM enrollments e

            LEFT JOIN students s ON e.studentID = s.studentID

            LEFT JOIN courses c ON e.courseCode = c.courseCode

            ORDER BY e.enrollmentID ASC

        ");

        if (!$res) {

            respond(["error" => "Failed to fetch enrollments: " . mysqli_error($conn)]);

        }

        respond(mysqli_fetch_all($res, MYSQLI_ASSOC));

        break; 


    case "enrollments:add":
        if (empty($body['studentID']) || empty($body['courseCode'])) {
            respond(["error" => "Both Student and Course selection parameters are required."]);
        }
        $status = "Enrolled";
        $pct = 0.00;
        $grade = 0.00;

        $stmt = mysqli_prepare($conn, "INSERT INTO enrollments (studentID, courseCode, completionStatus, completionPercentage, finalGrade) VALUES (?, ?, ?, ?, ?)");
        mysqli_stmt_bind_param($stmt, "issdd", $body['studentID'], $body['courseCode'], $status, $pct, $grade);
        if (mysqli_stmt_execute($stmt)) {
            respond(["success" => true, "id" => mysqli_insert_id($conn)]);
        } else {
            respond(["error" => "Database insertion failed (User may already be enrolled): " . mysqli_error($conn)]);
        }
        break;

    case "enrollments:update":
        if (empty($body['enrollmentID']) || empty($body['completionStatus'])) {
            respond(["error" => "Missing required identifiers to execute configuration update workflow."]);
        }
        $stmt = mysqli_prepare($conn, "UPDATE enrollments SET completionStatus=?, completionPercentage=?, finalGrade=? WHERE enrollmentID=?");
        mysqli_stmt_bind_param($stmt, "sddi", 
            $body['completionStatus'], $body['completionPercentage'], $body['finalGrade'], $body['enrollmentID']
        );
        if (mysqli_stmt_execute($stmt)) {
            respond(["success" => true]);
        } else {
            respond(["error" => "Failed to save parameter updates: " . mysqli_error($conn)]);
        }
        break;

    case "enrollments:delete":
        $stmt = mysqli_prepare($conn, "DELETE FROM enrollments WHERE enrollmentID=?");
        mysqli_stmt_bind_param($stmt, "i", $body['enrollmentID']);
        if (mysqli_stmt_execute($stmt)) {
            respond(["success" => true]);
        } else {
            respond(["error" => "Failed to drop enrollment record entry: " . mysqli_error($conn)]);
        }
        break;

    // ================= LESSON PROGRESS MODULE =================
    case "progress:get":
        $res = mysqli_query($conn, "
            SELECT p.progressID, p.isCompleted, p.completedAt, p.score, p.timeSpentMinutes, p.enrollmentID, p.lessonID,
                   s.studentName, l.lessonTitle
            FROM lessonProgress p
            LEFT JOIN enrollments e ON p.enrollmentID = e.enrollmentID
            LEFT JOIN students s ON e.studentID = s.studentID
            LEFT JOIN lessons l ON p.lessonID = l.lessonID
            ORDER BY p.progressID ASC
        ");
        if (!$res) {
            respond(["error" => "Failed to fetch lesson progress records: " . mysqli_error($conn)]);
        }
        respond(mysqli_fetch_all($res, MYSQLI_ASSOC));
        break;

    case "progress:add":
        if (empty($body['enrollmentID']) || empty($body['lessonID'])) {
            respond(["error" => "Both Enrollment record and Lesson choice are required parameters."]);
        }
        $isComp = !empty($body['isCompleted']) ? 1 : 0;
        $compAt = ($isComp == 1) ? date('Y-m-d H:i:s') : null; 

        $stmt = mysqli_prepare($conn, "INSERT INTO lessonProgress (isCompleted, completedAt, score, timeSpentMinutes, enrollmentID, lessonID) VALUES (?, ?, ?, ?, ?, ?)");
        mysqli_stmt_bind_param($stmt, "isddii", $isComp, $compAt, $body['score'], $body['timeSpentMinutes'], $body['enrollmentID'], $body['lessonID']);
        if (mysqli_stmt_execute($stmt)) {
            recalculateEnrollment($conn, $body['enrollmentID']);
            respond(["success" => true, "id" => mysqli_insert_id($conn)]);
        } else {
            respond(["error" => "Failed to record lesson progress: " . mysqli_error($conn)]);
        }
        break;

    case "progress:update":
        if (empty($body['progressID']) || empty($body['enrollmentID']) || empty($body['lessonID'])) {
            respond(["error" => "Missing required identifiers for checking metric synchronization states."]);
        }
        $isComp = !empty($body['isCompleted']) ? 1 : 0;
        $compAt = ($isComp == 1) ? date('Y-m-d H:i:s') : null;

        $stmt = mysqli_prepare($conn, "UPDATE lessonProgress SET isCompleted=?, completedAt=?, score=?, timeSpentMinutes=?, enrollmentID=?, lessonID=? WHERE progressID=?");
        mysqli_stmt_bind_param($stmt, "isddiii", $isComp, $compAt, $body['score'], $body['timeSpentMinutes'], $body['enrollmentID'], $body['lessonID'], $body['progressID']);
        if (mysqli_stmt_execute($stmt)) {
            recalculateEnrollment($conn, $body['enrollmentID']);
            respond(["success" => true]);
        } else {
            respond(["error" => "Failed to update tracking parameters: " . mysqli_error($conn)]);
        }
        break;

    case "progress:delete":
        if (empty($body['progressID'])) {
            respond(["error" => "Missing unique progressID identifier for record deletion."]);
        }
        $progressID = intval($body['progressID']);

        $findQuery = mysqli_query($conn, "SELECT enrollmentID FROM lessonProgress WHERE progressID = $progressID");
        $findRow = mysqli_fetch_assoc($findQuery);
        if ($findRow) {
            $enrollmentID = intval($findRow['enrollmentID']);
            $stmt = mysqli_prepare($conn, "DELETE FROM lessonProgress WHERE progressID = ?");
            mysqli_stmt_bind_param($stmt, "i", $progressID);
            if (mysqli_stmt_execute($stmt)) {
                recalculateEnrollment($conn, $enrollmentID);
                respond(["success" => true]);
            } else {
                respond(["error" => "Failed to drop progress log instance: " . mysqli_error($conn)]);
            }
        } else {
            respond(["error" => "Progress record not found."]);
        }
        break;

    // ================= CERTIFICATES MODULE =================
    case "certificates:get":
        $res = mysqli_query($conn, "
            SELECT 
                cert.certificateID, 
                cert.certificateNumber, 
                cert.issueDate,
                cert.studentID,
                cert.courseCode,
                cert.adminID,
                s.studentName, 
                c.title AS courseTitle,
                a.adminName
            FROM certificates cert
            LEFT JOIN students s ON cert.studentID = s.studentID
            LEFT JOIN courses c ON cert.courseCode = c.courseCode
            LEFT JOIN administrators a ON cert.adminID = a.adminID
            ORDER BY cert.certificateID ASC
        ");

        if (!$res) {
            respond(["error" => "Database Query Syntax Mismatch: " . mysqli_error($conn)]);
        }
        respond(mysqli_fetch_all($res, MYSQLI_ASSOC));
        break;

        case "certificates:add":

            if (
                empty($body['certificateNumber']) ||
                empty($body['studentID']) ||
                empty($body['courseCode']) ||
                empty($body['enrollmentID'])
            ) {
                respond([
                    "error" => "All relation keys (Number, Student, Enrollment, Course) are strictly required."
                ]);
            }
        
            // CHECK ENROLLMENT COMPLETION %
            $enrollmentID = intval($body['enrollmentID']);
        
            $checkQuery = mysqli_query(
                $conn,
                "SELECT completionPercentage FROM enrollments WHERE enrollmentID = $enrollmentID"
            );
        
            $checkRow = mysqli_fetch_assoc($checkQuery);
        
            if (!$checkRow) {
                respond(["error" => "Enrollment record not found."]);
            }
        
            if (floatval($checkRow['completionPercentage']) < 100) {
                respond([
                    "error" => "Certificate can only be issued when course completion is 100%."
                ]);
            }
        
            // INSERT CERTIFICATE
            $stmt = mysqli_prepare(
                $conn,
                "INSERT INTO certificates (certificateNumber, studentID, enrollmentID, courseCode, adminID)
                 VALUES (?, ?, ?, ?, ?)"
            );
        
            mysqli_stmt_bind_param(
                $stmt,
                "siisi",
                $body['certificateNumber'],
                $body['studentID'],
                $body['enrollmentID'],
                $body['courseCode'],
                $body['adminID']
            );
        
            if (mysqli_stmt_execute($stmt)) {
                respond([
                    "success" => true,
                    "id" => mysqli_insert_id($conn)
                ]);
            } else {
                respond([
                    "error" => "Manual certificate issue operation rejected: " . mysqli_error($conn)
                ]);
            }
        
            break;

    case "certificates:delete":
        if (empty($body['certificateID'])) {
            respond(["error" => "Unique certificate reference ID missing from payload."]);
        }
        $stmt = mysqli_prepare($conn, "DELETE FROM certificates WHERE certificateID = ?");
        mysqli_stmt_bind_param($stmt, "i", $body['certificateID']);
        respond(mysqli_stmt_execute($stmt) ? ["success" => true] : ["error" => mysqli_error($conn)]);
        break;

    // ================= DASHBOARD SUMMARY MODULE =================
    case "dashboard:metrics":
        // 1. Fetch total item count statistics (Fixed: Included missing teachers entity tally)
        $studentsQuery     = mysqli_query($conn, "SELECT COUNT(*) AS total FROM students");
        $coursesQuery      = mysqli_query($conn, "SELECT COUNT(*) AS total FROM courses");
        $teachersQuery     = mysqli_query($conn, "SELECT COUNT(*) AS total FROM teachers");
        $enrollmentsQuery  = mysqli_query($conn, "SELECT COUNT(*) AS total FROM enrollments");
        $certificatesQuery = mysqli_query($conn, "SELECT COUNT(*) AS total FROM certificates");

        $studentsRow     = mysqli_fetch_assoc($studentsQuery);
        $coursesRow      = mysqli_fetch_assoc($coursesQuery);
        $teachersRow     = mysqli_fetch_assoc($teachersQuery);
        $enrollmentsRow  = mysqli_fetch_assoc($enrollmentsQuery);
        $certificatesRow = mysqli_fetch_assoc($certificatesQuery);

        // 2. Fetch the 5 most recent platform activities (Fixed: Grabbed selection datetime)
        $activityFeed = mysqli_query($conn, "
            SELECT e.enrollmentID, e.enrollmentDate, s.studentName, c.title AS courseTitle 
            FROM enrollments e
            LEFT JOIN students s ON e.studentID = s.studentID
            LEFT JOIN courses c ON e.courseCode = c.courseCode
            ORDER BY e.enrollmentID DESC 
            LIMIT 5
        ");
        
        $recentActivityList = mysqli_fetch_all($activityFeed, MYSQLI_ASSOC);

        // 3. Dispatch unified dashboard data packet match (Fixed key string mapping mismatch)
        respond([
            "counts" => [
                "students"     => intval($studentsRow['total']),
                "courses"      => intval($coursesRow['total']),
                "teachers"     => intval($teachersRow['total']),
                "enrollments"  => intval($enrollmentsRow['total']),
                "certificates" => intval($certificatesRow['total'])
            ],
            "recentEnrollments" => $recentActivityList ? $recentActivityList : []
        ]);
        break;

    // ================= GLOBAL FALLBACK ROUTE =================
    default:
        http_response_code(400);
        respond(["error" => "Requested component connection route target invalid: $table:$action"]);
        break;
}

mysqli_close($conn);
?>