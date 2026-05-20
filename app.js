// ─── API CONFIG ─────────────────────────────────────────────────────────────
const API = "api.php";

// ─── API HELPERS ────────────────────────────────────────────────────────────
async function apiGet(table, action = "get") {
    try {
        const res = await fetch(`${API}?table=${table}&action=${action}`);
        if (!res.ok) throw new Error("Network response error status");
        return await res.json();
    } catch (err) {
        showMessage("Server connection error", true);
        return [];
    }
}

async function apiPost(table, action, data) {
    try {
        const res = await fetch(`${API}?table=${table}&action=${action}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error("Network request execution failure");
        return await res.json();
    } catch (err) {
        showMessage("Request execution failed", true);
        return { error: "Request failed" };
    }
}

// ─── UI NOTIFICATIONS ────────────────────────────────────────────────────────
function showMessage(msg, isError = false) {
    let box = document.getElementById("msg-box");
    if (!box) {
        box = document.createElement("div");
        box.id = "msg-box";
        box.style.cssText = `
            position: fixed; top: 20px; right: 20px;
            padding: 12px 24px; border-radius: 6px;
            color: white; font-weight: 500; z-index: 9999;
            transition: all 0.3s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        document.body.appendChild(box);
    }
    box.textContent = msg;
    box.style.background = isError ? "#ef4444" : "#10b981";
    box.style.opacity = "1";
    setTimeout(() => box.style.opacity = "0", 3000);
}

// ─── UTILITIES ──────────────────────────────────────────────────────────────
function togglePwd(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === "password") {
        input.type = "text";
        btn.textContent = "Hide Password";
    } else {
        input.type = "password";
        btn.textContent = "Show Password";
    }
}

// Dynamic Selection Component Engine
async function populateDropdown(selectId, table, valueKey, labelKey, placeholder) {
    const el = document.getElementById(selectId);
    if (!el) return;

    const data = await apiGet(table, "get");
    el.innerHTML = `<option value="">-- Select ${placeholder} --</option>`;
    
    if (Array.isArray(data)) {
        data.forEach(row => {
            el.innerHTML += `<option value="${row[valueKey]}">${row[labelKey]}</option>`;
        });
    }
}

// ─── STUDENTS CONTROLLER ────────────────────────────────────────────────────
async function loadStudents() {
    const data = await apiGet("students");
    const tbody = document.getElementById("students-tbody");
    if (!tbody) return;

    tbody.innerHTML = "";
    if (data.error || !Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center">No student records found.</td></tr>`;
        return;
    }

    data.forEach(s => {
        tbody.innerHTML += `
        <tr>
            <td><strong>#${s.studentID}</strong></td>
            <td>${s.studentName}</td>
            <td>${s.email}</td>
            <td><span class="badge">${s.gender}</span></td>
            <td>${s.dob ?? "-"}</td>
            <td>${s.registrationDate ?? "-"}</td>
            <td>
                <button class="btn-action edit" onclick='editStudent(${JSON.stringify(s)})'>Edit</button>
                <button class="btn-action delete" onclick="deleteStudent(${s.studentID})">Delete</button>
            </td>
        </tr>`;
    });
}

async function submitStudentForm(e) {
    e.preventDefault();
    const id = document.getElementById("student-id").value;

    const data = {
        studentName: document.getElementById("student-name").value,
        email: document.getElementById("student-email").value,
        pwd: document.getElementById("student-pwd").value,
        dob: document.getElementById("student-dob").value || null,
        gender: document.getElementById("student-gender").value
    };

    const action = id ? "update" : "add";
    const payload = id ? { ...data, studentID: parseInt(id) } : data;

    const res = await apiPost("students", action, payload);
    if (res.error) return showMessage(res.error, true);
    
    showMessage(id ? "Student details updated successfully!" : "Student registered successfully!");
    e.target.reset();
    
    document.getElementById("student-id").value = "";
    loadStudents();
}

async function deleteStudent(id) {
    if (!confirm("Are you sure you want to completely remove this student record?")) return;
    const res = await apiPost("students", "delete", { studentID: id });
    if (res.error) return showMessage(res.error, true);
    showMessage("Record deleted.");
    loadStudents();
}

function editStudent(s) {
    document.getElementById("student-id").value = s.studentID;
    document.getElementById("student-name").value = s.studentName;
    document.getElementById("student-email").value = s.email;
    document.getElementById("student-dob").value = s.dob ?? "";
    document.getElementById("student-gender").value = s.gender;
    document.getElementById("student-pwd").value = "";
    document.getElementById("student-pwd").removeAttribute("required");

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── TEACHERS CONTROLLER ────────────────────────────────────────────────────
async function loadTeachers() {
    const data = await apiGet("teachers");
    const tbody = document.getElementById("teachers-tbody");
    if (!tbody) return;

    tbody.innerHTML = "";
    if (data.error || !Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center">No teacher records found.</td></tr>`;
        return;
    }

    data.forEach(t => {
        tbody.innerHTML += `
        <tr>
            <td><strong>#${t.teacherID}</strong></td>
            <td>${t.teacherName}</td>
            <td>${t.email}</td>
            <td>${t.subjectName ?? "-"}</td>
            <td>${t.hireDate ?? "-"}</td>
            <td>
                <button class="btn-action edit" onclick='editTeacher(${JSON.stringify(t)})'>Edit</button>
                <button class="btn-action delete" onclick="deleteTeacher(${t.teacherID})">Delete</button>
            </td>
        </tr>`;
    });
}

async function submitTeacherForm(e) {
    e.preventDefault();
    const id = document.getElementById("teacher-id").value;

    const data = {
        teacherName: document.getElementById("teacher-name").value,
        email: document.getElementById("teacher-email").value,
        pwd: document.getElementById("teacher-pwd").value,
        subjectName: document.getElementById("teacher-subject").value || null,
        hireDate: document.getElementById("teacher-hiredate").value || null
    };

    const action = id ? "update" : "add";
    const payload = id ? { ...data, teacherID: parseInt(id) } : data;

    const res = await apiPost("teachers", action, payload);
    if (res.error) return showMessage(res.error, true);
    
    showMessage(id ? "Teacher profile details saved!" : "New teacher record successfully added.");
    e.target.reset();
    
    document.getElementById("teacher-id").value = "";
    document.getElementById("teacher-pwd").removeAttribute("required");
    loadTeachers();
}

function editTeacher(t) {
    document.getElementById("teacher-id").value = t.teacherID;
    document.getElementById("teacher-name").value = t.teacherName;
    document.getElementById("teacher-email").value = t.email;
    document.getElementById("teacher-subject").value = t.subjectName ?? "";
    document.getElementById("teacher-hiredate").value = t.hireDate ?? "";
    document.getElementById("teacher-pwd").value = "";
    document.getElementById("teacher-pwd").removeAttribute("required");

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteTeacher(id) {
    if (!confirm("Are you certain you want to completely erase this teacher's system profile?")) return;
    const res = await apiPost("teachers", "delete", { teacherID: id });
    if (res.error) return showMessage(res.error, true);
    showMessage("Teacher record deleted successfully.");
    loadTeachers();
}

// ─── ADMINS CONTROLLER MANAGEMENT MODULE ───────────────────────────────────
async function loadAdmins() {
    const data = await apiGet("admins");
    const tbody = document.getElementById("admins-tbody"); // Matches your HTML
    if (!tbody) return;

    tbody.innerHTML = "";
    data.forEach(a => {
        // Stringify and escape quotes to keep the onclick valid
        const safeData = JSON.stringify(a).replace(/"/g, '&quot;');
        
        tbody.innerHTML += `
        <tr>
            <td>#${a.adminID}</td>
            <td>${a.adminName}</td>
            <td>${a.email}</td>
            <td>${a.accessLevel}</td>
            <td>Active</td>
            <td>${a.createdAt ?? "-"}</td>
            <td>
                <button class="btn-action edit" onclick='editAdmin(${safeData})'>Edit</button>
                <button class="btn-action delete" onclick="deleteAdmin(${a.adminID})">Delete</button>
            </td>
        </tr>`;
    });
}

async function submitAdminForm(e) {
    e.preventDefault();
    const id = document.getElementById("admin-id").value;
    const data = {
        adminName: document.getElementById("admin-name").value,
        email: document.getElementById("admin-email").value,
        pwd: document.getElementById("admin-pwd").value,
        // MUST match the ID in your HTML <select id="admin-access">
        accessLevel: document.getElementById("admin-access").value 
    };

    const action = id ? "update" : "add";
    const payload = id ? { ...data, adminID: parseInt(id) } : data;

    const res = await apiPost("admins", action, payload);
    if (res.error) return showMessage(res.error, true);
    
    showMessage(id ? "Administrator configurations updated successfully!" : "New Administrator successfully registered!");
    e.target.reset();
    
    document.getElementById("admin-id").value = "";
    document.getElementById("admin-pwd").removeAttribute("required");
    loadAdmins();
}

function editAdmin(a) {
    document.getElementById("admin-id").value = a.adminID;
    document.getElementById("admin-name").value = a.adminName;
    document.getElementById("admin-email").value = a.email;
    document.getElementById("admin-access").value = a.accessLevel;
    document.getElementById("admin-pwd").value = "";
    document.getElementById("admin-pwd").removeAttribute("required");

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteAdmin(id) {
    if (!confirm("Are you sure you want to completely remove this administrator access level?")) return;
    const res = await apiPost("admins", "delete", { adminID: id });
    if (res.error) return showMessage(res.error, true);
    showMessage("Administrator access privileges removed.");
    loadAdmins();
}

// ─── COURSES CONTROLLER ─────────────────────────────────────────────────────
async function loadCourses() {
    const data = await apiGet("courses");
    const tbody = document.getElementById("courses-tbody");
    if (!tbody) return;

    tbody.innerHTML = "";
    if (data.error || !Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center">No courses found sitting in the registry.</td></tr>`;
        return;
    }

    data.forEach(c => {
        tbody.innerHTML += `
        <tr>
            <td><strong>${c.courseCode}</strong></td>
            <td>${c.title}</td>
            <td><span class="badge" style="background: #f1f5f9; color: #000; font-weight:600; padding: 4px 8px; border-radius:4px;">${c.category}</span></td>
            <td>${c.difficulty}</td>
            <td>${c.teacherName ?? "<em>Unassigned</em>"}</td>
            <td>
                <button class="btn-action edit" onclick='editCourse(${JSON.stringify(c).replace(/"/g, '&quot;')})'>Edit</button>
                <button class="btn-action delete" onclick="deleteCourse('${c.courseCode}')">Delete</button>
            </td>
        </tr>`;
    });
}

async function submitCourseForm(e) {

    e.preventDefault();

    const originalCode =
        document.getElementById("course-code-hidden").value;

    const data = {

        courseCode:
            document.getElementById("course-code").value,

        title:
            document.getElementById("course-title").value,

        descriptions:
            document.getElementById("course-desc").value,

        category:
            document.getElementById("course-category").value,

        difficulty:
            document.getElementById("course-difficulty").value,

        durationInMinutes:
            parseInt(document.getElementById("course-duration").value) || 0,

        startDate:
            document.getElementById("course-start").value || null,

        endDate:
            document.getElementById("course-end").value || null,

        maxStudents:
            parseInt(document.getElementById("course-max").value) || 0,

        passingGrade:
            parseFloat(document.getElementById("course-grade").value) || 50,

        teacherID:
            parseInt(document.getElementById("course-teacher").value) || null,

        adminID:
            parseInt(document.getElementById("course-admin").value) || null
    };

    const action = originalCode ? "update" : "add";

    const res = await apiPost("courses", action, data);

    if (res.error) {
        return showMessage(res.error, true);
    }

    showMessage(
        originalCode
        ? "Course updated successfully!"
        : "Course added successfully!"
    );

    loadCourses();

    e.target.reset();

    document.getElementById("course-code-hidden").value = "";

    document.getElementById("course-code")
        .removeAttribute("disabled");
}
function editCourse(course) {

    // Main identifiers
    document.getElementById("course-code").value =
        course.courseCode ?? "";

    document.getElementById("course-code-hidden").value =
        course.courseCode ?? "";

    // Basic info
    document.getElementById("course-title").value =
        course.title ?? "";

    document.getElementById("course-desc").value =
        course.descriptions ?? "";

    // Dropdowns
    document.getElementById("course-category").value =
        course.category ?? "Science";

    document.getElementById("course-difficulty").value =
        course.difficulty ?? "Beginner";

    // Numbers
    document.getElementById("course-duration").value =
        course.durationInMinutes ?? "";

    document.getElementById("course-max").value =
        course.maxStudents ?? "";

    document.getElementById("course-grade").value =
        course.passingGrade ?? "";

    // Dates
    document.getElementById("course-start").value =
        course.startDate ?? "";

    document.getElementById("course-end").value =
        course.endDate ?? "";

    // Foreign keys
    document.getElementById("course-teacher").value =
        course.teacherID ?? "";

    document.getElementById("course-admin").value =
        course.adminID ?? "";

    // Prevent editing course code
    document.getElementById("course-code")
        .setAttribute("disabled", "true");

    // Scroll to top smoothly
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    // Optional success message
    showMessage("Editing course...");
}

async function deleteCourse(code) {
    if (!confirm(`Are you absolutely certain you want to remove course code ${code}?`)) return;
    const res = await apiPost("courses", "delete", { courseCode: code });
    if (res.error) return showMessage(res.error, true);
    showMessage("Course record dropped.");
    loadCourses();
}

// ─── LESSONS CONTROLLER ─────────────────────────────────────────────────────
async function loadLessons() {
    const data = await apiGet("lessons");
    const tbody = document.getElementById("lessons-tbody");
    if (!tbody) return;

    tbody.innerHTML = "";
    if (data.error || !Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center">No structural lesson items currently assigned to curriculum.</td></tr>`;
        return;
    }

    data.forEach(l => {
        tbody.innerHTML += `
        <tr>
            <td><strong>#${l.lessonID}</strong></td>
            <td>L${l.lessonNum}</td>
            <td>${l.lessonTitle}</td>
            <td><span class="badge" style="background: #f1f5f9; color: #000; font-weight:600; padding: 4px 8px; border-radius:4px;">${l.contentType}</span></td>
            <td>${l.courseTitle ?? "<em>Unassigned Course</em>"} (${l.courseCode})</td>
            <td>
                <button class="btn-action edit" onclick='editLesson(${JSON.stringify(l)})'>Edit</button>
                <button class="btn-action delete" onclick="deleteLesson(${l.lessonID})">Delete</button>
            </td>
        </tr>`;
    });
}

async function submitLessonForm(e) {
    e.preventDefault();
    const id = document.getElementById("lesson-id").value;

    const data = {
        lessonNum: parseInt(document.getElementById("lesson-num").value),
        lessonTitle: document.getElementById("lesson-title").value,
        lessonDescription: document.getElementById("lesson-desc").value || null,
        contentType: document.getElementById("lesson-type").value,
        durationInMinutes: parseInt(document.getElementById("lesson-duration").value) || 0,
        courseCode: document.getElementById("lesson-course").value
    };

    const action = id ? "update" : "add";
    const payload = id ? { ...data, lessonID: parseInt(id) } : data;

    const res = await apiPost("lessons", action, payload);
    if (res.error) return showMessage(res.error, true);

    showMessage(id ? "Lesson parameters updated smoothly!" : "New learning lesson modular component appended successfully.");
    e.target.reset();
    document.getElementById("lesson-id").value = "";
    loadLessons();
}

function editLesson(l) {
    document.getElementById("lesson-id").value = l.lessonID;
    document.getElementById("lesson-num").value = l.lessonNum;
    document.getElementById("lesson-title").value = l.lessonTitle;
    document.getElementById("lesson-desc").value = l.lessonDescription ?? "";
    document.getElementById("lesson-type").value = l.contentType;
    document.getElementById("lesson-duration").value = l.durationInMinutes ?? "";
    document.getElementById("lesson-course").value = l.courseCode;

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteLesson(id) {
    if (!confirm("Are you completely sure you want to drop this curriculum lesson entity?")) return;
    const res = await apiPost("lessons", "delete", { lessonID: id });
    if (res.error) return showMessage(res.error, true);
    showMessage("Lesson entry eliminated.");
    loadLessons();
}

// ─── ENROLLMENTS CONTROLLER ──────────────────────────────────────────────────
async function loadEnrollments() {
    const data = await apiGet("enrollments");
    const tbody = document.getElementById("enrollments-tbody");
    if (!tbody) return;

    tbody.innerHTML = "";
    
    data.forEach(e => {
        // Build the row with the missing percentage and grade fields
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>#${e.enrollmentID}</td>
            <td>${e.studentName || 'N/A'}</td>
            <td>${e.courseTitle || 'N/A'}</td>
            <td>${e.completionStatus || 'Enrolled'}</td>
            <td>${e.completionPercentage || 0}%</td>
            <td>${e.finalGrade || 0}</td>
            <td>${e.enrollmentDate || '-'}</td>
            <td>
                <button class="btn-action edit" onclick='editEnrollment(${JSON.stringify(e).replace(/"/g, '&quot;')})'>Edit</button>
                <button class="btn-action delete" onclick="deleteEnrollment(${e.enrollmentID})">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function submitEnrollmentForm(event) {
    event.preventDefault();
    const id = document.getElementById("enrollment-id").value;

    let data = {
        studentID: parseInt(document.getElementById("enrollment-student").value),
        courseCode: document.getElementById("enrollment-course").value
    };

    const action = id ? "update" : "add";
    
    if (id) {
        data = {
            enrollmentID: parseInt(id),
            completionStatus: document.getElementById("enrollment-status").value,
            completionPercentage: parseFloat(document.getElementById("enrollment-percent").value) || 0,
            finalGrade: parseFloat(document.getElementById("enrollment-grade").value) || 0
        };
    }

    const res = await apiPost("enrollments", action, data);
    if (res.error) return showMessage(res.error, true);

    showMessage(id ? "Student curriculum logs adjusted successfully." : "Student registered to course itinerary safely!");
    
    event.target.reset();
    document.getElementById("enrollment-id").value = "";
    document.getElementById("enrollment-student").removeAttribute("disabled");
    document.getElementById("enrollment-course").removeAttribute("disabled");
    document.getElementById("update-fields").style.display = "none";
    
    loadEnrollments();
}

function editEnrollment(e) {
    document.getElementById("enrollment-id").value = e.enrollmentID;
    document.getElementById("enrollment-student").value = e.studentID;
    document.getElementById("enrollment-course").value = e.courseCode;

    document.getElementById("enrollment-student").setAttribute("disabled", "true");
    document.getElementById("enrollment-course").setAttribute("disabled", "true");

    document.getElementById("update-fields").style.display = "block";
    document.getElementById("enrollment-status").value = e.completionStatus;
    document.getElementById("enrollment-percent").value = e.completionPercentage;
    document.getElementById("enrollment-grade").value = e.finalGrade;

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteEnrollment(id) {
    if (!confirm("Are you completely certain you want to remove this student registration profile?")) return;
    const res = await apiPost("enrollments", "delete", { enrollmentID: id });
    if (res.error) return showMessage(res.error, true);
    showMessage("Enrollment link cleared from registry catalog.");
    loadEnrollments();
}

// ─── LESSON PROGRESS CONTROLLER ──────────────────────────────────────────────
async function loadLessonProgress() {
    const data = await apiGet("progress");
    const tbody = document.getElementById("progress-tbody");
    if (!tbody) return;

    tbody.innerHTML = "";
    if (data.error || !Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center">No structural lesson tracking metrics found in database rows.</td></tr>`;
        return;
    }

    data.forEach(p => {
        const isDone = parseInt(p.isCompleted) !== 0;
        const completeBadge = isDone
            ? `<span class="badge" style="background:#d1fae5; color:#065f46; padding:4px 8px; border-radius:4px; font-weight:600;">Yes</span>`
            : `<span class="badge" style="background:#fee2e2; color:#991b1b; padding:4px 8px; border-radius:4px; font-weight:600;">No</span>`;

        tbody.innerHTML += `
        <tr>
            <td><strong>#${p.progressID}</strong></td>
            <td>${p.studentName ?? "<em>Unknown</em>"} (E-ID: ${p.enrollmentID})</td>
            <td>${p.lessonTitle ?? "<em>Deleted Lesson</em>"} (L-ID: ${p.lessonID})</td>
            <td>${completeBadge}</td>
            <td>${parseFloat(p.score).toFixed(1)}</td>
            <td>${p.timeSpentMinutes} mins</td>
            <td>
                <button class="btn-action edit" onclick='editProgress(${JSON.stringify(p)})'>Edit</button>
                <button class="btn-action delete" onclick="deleteProgress(${p.progressID})">Delete</button>
            </td>
        </tr>`;
    });
}

async function submitProgressForm(event) {
    event.preventDefault();
    const id = document.getElementById("progress-id").value;

    const data = {
        enrollmentID: parseInt(document.getElementById("progress-enrollment").value),
        lessonID: parseInt(document.getElementById("progress-lesson").value),
        score: parseFloat(document.getElementById("progress-score").value) || 0.00,
        timeSpentMinutes: parseInt(document.getElementById("progress-time").value) || 0,
        isCompleted: document.getElementById("progress-completed").checked ? 1 : 0
    };

    const action = id ? "update" : "add";
    const payload = id ? { ...data, progressID: parseInt(id) } : data;

    const res = await apiPost("progress", action, payload);
    if (res.error) return showMessage(res.error, true);

    showMessage(id ? "Student lesson parameters updated!" : "New progress item tracked smoothly.");
    event.target.reset();
    document.getElementById("progress-id").value = "";
    loadLessonProgress();
}

function editProgress(p) {
    document.getElementById("progress-id").value = p.progressID;
    document.getElementById("progress-enrollment").value = p.enrollmentID;
    document.getElementById("progress-lesson").value = p.lessonID;
    document.getElementById("progress-score").value = p.score;
    document.getElementById("progress-time").value = p.timeSpentMinutes;
    document.getElementById("progress-completed").checked = parseInt(p.isCompleted) !== 0;

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteProgress(id) {
    if (!confirm("Are you completely sure you want to scrub this lesson metrics entry?")) return;
    const res = await apiPost("progress", "delete", { progressID: id });
    if (res.error) return showMessage(res.error, true);
    showMessage("Progress entry purged from data registry.");
    loadLessonProgress();
}

async function populateEnrollmentDropdown(selectId) {
    const el = document.getElementById(selectId);
    if (!el) return;
    const data = await apiGet("enrollments");
    el.innerHTML = `<option value="">-- Select Enrollment --</option>`;
    if (!data.error && Array.isArray(data)) {
        data.forEach(item => {
            el.innerHTML += `<option value="${item.enrollmentID}">E-#${item.enrollmentID}: ${item.studentName} [${item.courseCode}]</option>`;
        });
    }
}

// ─── CERTIFICATES CONTROLLER (DATA VIEW ONLY) ───────────────────────────────
async function loadCertificates() {
    const data = await apiGet("certificates", "get");
    const tbody = document.getElementById("certificates-tbody");
    if (!tbody) return;

    tbody.innerHTML = "";
    
    if (!data || data.error) {
        console.error("API error log description:", data ? data.error : "No data received");
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444;">Failed to fetch certificate register entries from server.</td></tr>`;
        return;
    }

    if (!Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No certificates currently issued on the platform.</td></tr>`;
        return;
    }

    data.forEach(c => {
        const sName = c.studentName || "Unknown Student";
        const sID = c.studentID || "N/A";
        const cTitle = c.courseTitle || "Unknown Course";
        const cCode = c.courseCode || "N/A";
        const aName = c.adminName || "System Auto";
        const aID = c.adminID;

        const studentDisplay = `${sName} (ID: ${sID})`;
        const courseDisplay = `${cTitle} (${cCode})`;
        const adminDisplay = aID ? `${aName} (ID: ${aID})` : `<span style="color: #94a3b8; font-style: italic;">${aName}</span>`;

        tbody.innerHTML += `
        <tr>
            <td><strong>#${c.certificateID}</strong></td>
            <td><code>${c.certificateNumber}</code></td>
            <td>${studentDisplay}</td>
            <td>${courseDisplay}</td>
            <td><span class="badge" style="background: #1e293b; color: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;">${adminDisplay}</span></td>
            <td>${c.issueDate}</td>
            <td>
                <button class="btn-action delete" style="background: #ef4444; color: #fff; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;" onclick="deleteCertificate(${c.certificateID})">Revoke</button>
            </td>
        </tr>`;
    });
}

async function deleteCertificate(id) {
    if (!confirm("Are you entirely sure you want to permanently revoke this certificate row?")) return;
    const res = await apiPost("certificates", "delete", { certificateID: id });
    if (res.error) return showMessage(res.error, true);
    showMessage("Certificate successfully revoked.");
    loadCertificates();
}

// ─── DASHBOARD CONTROLLER ───────────────────────────────────────────────────
// ─── SAFE DASHBOARD CONTROLLER ───────────────────────────────────────────────
async function loadDashboardMetrics() {
    const response = await apiGet("dashboard", "metrics");
    
    if (!response || response.error) {
        const errorRow = `<tr><td colspan="3" style="text-align: center; color: #ef4444;">Error fetching system dashboard states.</td></tr>`;
        const recentList = document.getElementById("recent-enrollments-list");
        if (recentList) recentList.innerHTML = errorRow;
        return;
    }

    // Defensive Check: Only update elements if they exist in the current HTML file
    const studentCard     = document.getElementById("stat-students");
    const courseCard      = document.getElementById("stat-courses");
    const enrollmentCard  = document.getElementById("stat-enrollments");
    const certificateCard = document.getElementById("stat-certificates");

    if (studentCard)     studentCard.textContent     = response.counts.students ?? "0";
    if (courseCard)      courseCard.textContent      = response.counts.courses ?? "0";
    if (enrollmentCard)  enrollmentCard.textContent  = response.counts.enrollments ?? "0";
    if (certificateCard) certificateCard.textContent = response.counts.certificates ?? "0";

    const recentList = document.getElementById("recent-enrollments-list");
    if (!recentList) return;

    recentList.innerHTML = "";
    
    // Check both variations of the backend response array key to maintain complete compatibility
    const activityData = response.recentEnrollments || response.recentActivity;

    if (!activityData || activityData.length === 0) {
        recentList.innerHTML = `<tr><td colspan="3" class="text-center" style="color: #94a3b8;">No recent enrollments logged today.</td></tr>`;
        return;
    }

    activityData.forEach(item => {
        const shortDate = item.enrollmentDate ? item.enrollmentDate.split(' ')[0] : "Recent";
        
        recentList.innerHTML += `
        <tr>
            <td><strong>${item.studentName ?? "Unknown Student"}</strong></td>
            <td>${item.courseTitle ?? "Unknown Course"}</td>
            <td><span class="badge-date" style="color: #64748b; font-size: 0.9em;">${shortDate}</span></td>
        </tr>`;
    });
}

// ─── CENTRAL ROUTED PAGE INITIALIZATION ENTRY POINT ─────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;
    console.log("System Router Booted. Current Page Key:", page);

    switch (page) {
        case "dashboard":
            loadDashboardMetrics();
            break;

        case "students":
            loadStudents();
            document.getElementById("student-form")?.addEventListener("submit", submitStudentForm);
            break;

        case "teachers":
            loadTeachers();
            document.getElementById("teacher-form")?.addEventListener("submit", submitTeacherForm);
            break;

        case "admins":
            loadAdmins();
            document.getElementById("admin-form")?.addEventListener("submit", submitAdminForm);
            break;

        case "courses":
            loadCourses();
            populateDropdown("course-teacher", "teachers", "teacherID", "teacherName", "Teacher");
            populateDropdown("course-admin", "admins", "adminID", "adminName", "Admin");
            document.getElementById("course-form")?.addEventListener("submit", submitCourseForm);
            break;

        case "lessons":
            loadLessons();
            populateDropdown("lesson-course", "courses", "courseCode", "title", "Course");
            document.getElementById("lesson-form")?.addEventListener("submit", submitLessonForm);
            break;

        case "enrollments":
            loadEnrollments();
            populateDropdown("enrollment-student", "students", "studentID", "studentName", "Student");
            populateDropdown("enrollment-course", "courses", "courseCode", "title", "Course");
            document.getElementById("enrollment-form")?.addEventListener("submit", submitEnrollmentForm);
            break;

        case "progress":
            loadLessonProgress();
            populateEnrollmentDropdown("progress-enrollment");
            populateDropdown("progress-lesson", "lessons", "lessonID", "lessonTitle", "Lesson");
            document.getElementById("progress-form")?.addEventListener("submit", submitProgressForm);
            break;

        case "certificates": 
            loadCertificates();
            break;

        default:
            console.warn("Router Warning: No valid matching data-page attribute found on the body tag.");
            break;
    }
});