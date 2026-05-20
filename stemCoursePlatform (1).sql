DROP DATABASE IF EXISTS Stem_Course_Platform;
CREATE DATABASE Stem_Course_Platform;
USE Stem_Course_Platform;

CREATE TABLE students (
	studentID INT AUTO_INCREMENT,
    studentName VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    pwd CHAR(8) NOT NULL,
    dob DATE,
    gender ENUM('Male','Female') NOT NULL,
    registrationDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY(studentID)
);

CREATE TABLE teachers (
	teacherID INT AUTO_INCREMENT,
    teacherName VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    pwd CHAR(8) NOT NULL,
    subjectName VARCHAR(50),
    hireDate DATE,
    
    PRIMARY KEY(teacherID)
);

CREATE TABLE administrators (
	adminID INT AUTO_INCREMENT,
    adminName VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    pwd CHAR(8) NOT NULL,
    accessLevel ENUM('Owner','Editor','Viewer') DEFAULT 'Owner',
    isActive BOOLEAN DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY(adminID)
);

CREATE TABLE courses (
	courseCode VARCHAR(15),
    title VARCHAR(50) NOT NULL,
    descriptions TEXT,
    category ENUM('Science','Technology','Mathematics','Engineering') NOT NULL,
    difficulty ENUM('Beginner','Intermediate','Advanced') DEFAULT 'Beginner' NOT NULL,
    durationInMinutes INT CHECK(durationInMinutes>0),
    startDate DATE,
    endDate DATE,
    maxStudents INT CHECK(maxStudents>0),
    passingGrade DECIMAL(5,2) DEFAULT 50.00 CHECK(passingGrade BETWEEN 0 AND 100),
    teacherID INT,
    adminID INT NOT NULL,
    
    PRIMARY KEY(courseCode),
    FOREIGN KEY(teacherID) REFERENCES teachers(teacherID)
		ON DELETE SET NULL
        ON UPDATE CASCADE,
	FOREIGN KEY(adminID) REFERENCES administrators(adminID)
		ON DELETE RESTRICT
		ON UPDATE CASCADE
);

CREATE TABLE lessons (
	lessonID INT AUTO_INCREMENT,
    lessonNum INT NOT NULL  DEFAULT 1 CHECK(lessonNum>0),
    lessonTitle  VARCHAR(50) NOT NULL,
    lessonDescription TEXT,
    contentType ENUM('Video','Reading','Quiz','Lab','Assignment') NOT NULL,
    durationInMinutes INT CHECK(durationInMinutes>0),
    courseCode VARCHAR(15),
    
    PRIMARY KEY(lessonID),
    CONSTRAINT lessonNumber UNIQUE(courseCode,lessonNum),
    FOREIGN KEY(courseCode) REFERENCES courses(courseCode)
		ON DELETE CASCADE
		ON UPDATE CASCADE
);

CREATE TABLE enrollments (
	enrollmentID INT AUTO_INCREMENT,
    enrollmentDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completionStatus ENUM('Enrolled','In Progress','Completed','Dropped') DEFAULT 'Enrolled',
    completionPercentage DECIMAL(5,2) DEFAULT 0.00 CHECK(completionPercentage BETWEEN 0 AND 100),
    finalGrade DECIMAL(5,2) DEFAULT 0.00 CHECK(finalGrade BETWEEN 0 AND 100),
    studentID INT,
    courseCode VARCHAR(15),
    
    PRIMARY KEY(enrollmentID),
    CONSTRAINT uniqueEnrollment UNIQUE(studentID,courseCode),
    CONSTRAINT chkCompletion CHECK((completionStatus='Completed' AND completionPercentage=100.00) OR completionStatus !='Completed'),
    CONSTRAINT chkInProgress CHECK((completionStatus='In Progress' AND completionPercentage>0.00) OR completionStatus !='In Progress'),
    FOREIGN KEY(studentID) REFERENCES students(studentID)
		ON DELETE CASCADE
        ON UPDATE CASCADE,
	FOREIGN KEY(courseCode) REFERENCES courses(courseCode)
		ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE lessonProgress (
	progressID INT AUTO_INCREMENT,
    isCompleted BOOLEAN DEFAULT FALSE,
    completedAt TIMESTAMP NULL,
    score DECIMAL(5,2) DEFAULT 0.00 CHECK(score BETWEEN 0 AND 100),
    timeSpentMinutes INT DEFAULT 0 CHECK(timeSpentMinutes>=0),
    enrollmentID INT,
    lessonID INT,
    
    PRIMARY KEY(progressID),
    CONSTRAINT uniqueLessonProgress UNIQUE(enrollmentID,lessonID),
    FOREIGN KEY(enrollmentID) REFERENCES enrollments(enrollmentID)
		ON DELETE CASCADE
        ON UPDATE CASCADE,
	FOREIGN KEY(lessonID) REFERENCES lessons(lessonID)
		ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE certificates (
	certificateID INT AUTO_INCREMENT,
    certificateNumber  VARCHAR(50) UNIQUE NOT NULL,
    issueDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    studentID INT,
    enrollmentID INT,
    courseCode VARCHAR(15),
    adminID INT,
    
    PRIMARY KEY(certificateID),
    CONSTRAINT uniqueStudentCertificate UNIQUE(studentID,courseCode),
    FOREIGN KEY(studentID) REFERENCES students(studentID)
		ON DELETE CASCADE
        ON UPDATE CASCADE,
	FOREIGN KEY(courseCode) REFERENCES courses(courseCode)
		ON DELETE CASCADE
        ON UPDATE CASCADE,
	FOREIGN KEY(enrollmentID) REFERENCES enrollments(enrollmentID)
		ON DELETE CASCADE
        ON UPDATE CASCADE,
	FOREIGN KEY(adminID) REFERENCES administrators(adminID)
		ON DELETE SET NULL
		ON UPDATE CASCADE
);

-- ─────────────────────────────────────────────────────────────
-- AUTOMATED SYSTEM TRIGGERS FOR PROGRESS CALCULATIONS
-- ─────────────────────────────────────────────────────────────

DELIMITER $$

CREATE TRIGGER trg_AfterProgressInsert
AFTER INSERT ON lessonProgress
FOR EACH ROW
BEGIN

    DECLARE totalLessons INT DEFAULT 0;
    DECLARE completedLessons INT DEFAULT 0;
    DECLARE completionPct DECIMAL(5,2) DEFAULT 0.00;
    DECLARE avgGrade DECIMAL(5,2) DEFAULT 0.00;
    DECLARE statusValue VARCHAR(20);

    -- TOTAL LESSONS IN COURSE
    SELECT COUNT(*)
    INTO totalLessons
    FROM lessons l
    JOIN enrollments e
        ON l.courseCode = e.courseCode
    WHERE e.enrollmentID = NEW.enrollmentID;

    -- COMPLETED LESSONS
    SELECT COUNT(*)
    INTO completedLessons
    FROM lessonProgress
    WHERE enrollmentID = NEW.enrollmentID
    AND isCompleted = 1;

    -- AVERAGE GRADE
    SELECT COALESCE(AVG(score),0)
    INTO avgGrade
    FROM lessonProgress
    WHERE enrollmentID = NEW.enrollmentID;

    -- PERCENTAGE
    IF totalLessons > 0 THEN
        SET completionPct = (completedLessons / totalLessons) * 100;
    END IF;

    -- STATUS
    IF completionPct >= 100 THEN
        SET statusValue = 'Completed';
        SET completionPct = 100;
    ELSEIF completionPct > 0 THEN
        SET statusValue = 'In Progress';
    ELSE
        SET statusValue = 'Enrolled';
    END IF;

    -- UPDATE ENROLLMENT
    UPDATE enrollments
    SET
        completionPercentage = completionPct,
        finalGrade = avgGrade,
        completionStatus = statusValue
    WHERE enrollmentID = NEW.enrollmentID;

END$$

DELIMITER ;

-- 2. Run automation the millisecond an existing progress record is edited
DELIMITER $$

CREATE TRIGGER trg_AfterProgressUpdate
AFTER UPDATE ON lessonProgress
FOR EACH ROW
BEGIN

    DECLARE totalLessons INT DEFAULT 0;
    DECLARE completedLessons INT DEFAULT 0;
    DECLARE completionPct DECIMAL(5,2) DEFAULT 0.00;
    DECLARE avgGrade DECIMAL(5,2) DEFAULT 0.00;
    DECLARE statusValue VARCHAR(20);

    SELECT COUNT(*)
    INTO totalLessons
    FROM lessons l
    JOIN enrollments e
        ON l.courseCode = e.courseCode
    WHERE e.enrollmentID = NEW.enrollmentID;

    SELECT COUNT(*)
    INTO completedLessons
    FROM lessonProgress
    WHERE enrollmentID = NEW.enrollmentID
    AND isCompleted = 1;

    SELECT COALESCE(AVG(score),0)
    INTO avgGrade
    FROM lessonProgress
    WHERE enrollmentID = NEW.enrollmentID;

    IF totalLessons > 0 THEN
        SET completionPct = (completedLessons / totalLessons) * 100;
    END IF;

    IF completionPct >= 100 THEN
        SET statusValue = 'Completed';
        SET completionPct = 100;
    ELSEIF completionPct > 0 THEN
        SET statusValue = 'In Progress';
    ELSE
        SET statusValue = 'Enrolled';
    END IF;

    UPDATE enrollments
    SET
        completionPercentage = completionPct,
        finalGrade = avgGrade,
        completionStatus = statusValue
    WHERE enrollmentID = NEW.enrollmentID;

END$$

DELIMITER ;
        
    
-- ─────────────────────────────────────────────────────────────
-- AUTOMATED CERTIFICATE GENERATION TRIGGER
-- ─────────────────────────────────────────────────────────────

DELIMITER $$

DROP TRIGGER IF EXISTS trg_AutoIssueCertificate$$

CREATE TRIGGER trg_AutoIssueCertificate
AFTER UPDATE ON enrollments
FOR EACH ROW
BEGIN

    IF NEW.completionStatus = 'Completed'
    AND NEW.completionPercentage = 100.00
    AND OLD.completionStatus != 'Completed' THEN

        IF NOT EXISTS (
            SELECT 1
            FROM certificates
            WHERE enrollmentID = NEW.enrollmentID
        ) THEN

            INSERT INTO certificates
            (
                certificateNumber,
                studentID,
                enrollmentID,
                courseCode,
                adminID
            )
            VALUES
            (
                CONCAT(
                    'CERT-',
                    NEW.courseCode,
                    '-',
                    NEW.studentID,
                    '-',
                    UNIX_TIMESTAMP()
                ),
                NEW.studentID,
                NEW.enrollmentID,
                NEW.courseCode,
                (
                    SELECT adminID
                    FROM administrators
                    WHERE isActive = 1
                    LIMIT 1
                )
            );

        END IF;

    END IF;

END$$

DELIMITER ;