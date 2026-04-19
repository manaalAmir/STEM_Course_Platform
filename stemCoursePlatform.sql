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
        
    
    
 
    

