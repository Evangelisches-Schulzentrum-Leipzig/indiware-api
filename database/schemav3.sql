-- MariaDB 12+
CREATE DATABASE IF NOT EXISTS `timetable-v3` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `timetable-v3`;

CREATE TABLE IF NOT EXISTS
	teachers (
		id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		short_name VARCHAR(10) NOT NULL UNIQUE
	) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS
	classes (
		id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		name VARCHAR(20) NOT NULL UNIQUE,
		is_group BOOLEAN NOT NULL DEFAULT 0
	) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS 
	courses (
		id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		short_name VARCHAR(10) NOT NULL UNIQUE,
		long_name VARCHAR(100) NULL,
		teacher_id SMALLINT UNSIGNED NOT NULL,
		class_id SMALLINT UNSIGNED NOT NULL,
		CONSTRAINT fk_course_teacher FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE CASCADE,
		CONSTRAINT fk_course_class FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE
	) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS
	subjects (
		id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		short_name VARCHAR(10) NOT NULL UNIQUE,
		long_name VARCHAR(100) NULL
	) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS
	buildings (
		id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		name VARCHAR(64) NOT NULL UNIQUE,
		address VARCHAR(255) NULL
	) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS
	building_levels (
		id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		building_id TINYINT UNSIGNED NOT NULL,
		level_name VARCHAR(16) NOT NULL,
		CONSTRAINT fk_building_level_building FOREIGN KEY (building_id) REFERENCES buildings (id) ON DELETE CASCADE
	) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS
	rooms (
		id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		name VARCHAR(20) NOT NULL,
		building_level SMALLINT UNSIGNED NOT NULL,
		CONSTRAINT fk_room_building_level FOREIGN KEY (building_level) REFERENCES building_levels (id) ON DELETE CASCADE,
		UNIQUE KEY uq_room_loc (name, building_level)
	) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS
	periods (
		id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		number TINYINT UNSIGNED NOT NULL,
		start_time TIME NOT NULL,
		end_time TIME NOT NULL,
		UNIQUE KEY uq_period_number (number, start_time, end_time)
	) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS
	class_periods (
		id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		class_id SMALLINT UNSIGNED NOT NULL,
		period_id TINYINT UNSIGNED NOT NULL,
		CONSTRAINT fk_class_period_class FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE,
		CONSTRAINT fk_class_period_period FOREIGN KEY (period_id) REFERENCES periods (id) ON DELETE CASCADE
	) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS
	teacher_periods (
		id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		teacher_id SMALLINT UNSIGNED NOT NULL,
		period_id TINYINT UNSIGNED NOT NULL,
		CONSTRAINT fk_teacher_period_teacher FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE CASCADE,
		CONSTRAINT fk_teacher_period_period FOREIGN KEY (period_id) REFERENCES periods (id) ON DELETE CASCADE
	) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS
	room_periods (
		id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		room_id SMALLINT UNSIGNED NOT NULL,
		period_id TINYINT UNSIGNED NOT NULL,
		CONSTRAINT fk_room_period_room FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE,
		CONSTRAINT fk_room_period_period FOREIGN KEY (period_id) REFERENCES periods (id) ON DELETE CASCADE
	) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS
	week_types (
		id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		name VARCHAR(20) NOT NULL UNIQUE
	) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS
	weeks (
		id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		school_week SMALLINT UNSIGNED NOT NULL,
		calendar_week SMALLINT UNSIGNED NOT NULL,
		week_type_id TINYINT UNSIGNED NOT NULL,
		start_date DATE NOT NULL UNIQUE,
		end_date DATE NOT NULL UNIQUE,
		CONSTRAINT fk_week_week_type FOREIGN KEY (week_type_id) REFERENCES week_types (id) ON DELETE RESTRICT
	) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS
	holidays (
		id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		date DATE NOT NULL UNIQUE,
		is_festivity TINYINT(1) NOT NULL DEFAULT 0,
		name VARCHAR(64) NOT NULL UNIQUE
	) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS
	plan_type (
		id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		name VARCHAR(5) NOT NULL UNIQUE
	) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS
	query_batches (
		id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		hash CHAR(64) NOT NULL UNIQUE,
		created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
	) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS
	query_metadata (
		id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		file_name VARCHAR(100) NOT NULL,
		plan_type VARCHAR(40) NULL,
		plan_date DATE NULL,
		generation_timestamp TIMESTAMP NULL,
		school_name VARCHAR(128) NULL,
		school_city VARCHAR(64) NULL,
		school_number VARCHAR(32) NULL,
		title VARCHAR(128) NULL,
		days_per_week TINYINT UNSIGNED NULL,
		school_week_number TINYINT UNSIGNED NULL,
		is_native BOOLEAN NOT NULL DEFAULT 0,
		valid_from DATE NULL,
		up_name VARCHAR(64) NULL,
		up_module VARCHAR(32) NULL,
		up_version VARCHAR(20) NULL,
		absent_teachers_raw TEXT NULL,
		changed_classes_raw TEXT NULL,
		changed_teachers_raw TEXT NULL,
		query_batch_id SMALLINT UNSIGNED NOT NULL,
		CONSTRAINT fk_metadata_plan_type FOREIGN KEY (plan_type) REFERENCES plan_type (id) ON DELETE RESTRICT,
		CONSTRAINT fk_metadata_query_batch FOREIGN KEY (query_batch_id) REFERENCES query_batches (id) ON DELETE RESTRICT
	) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS `academic_base_data` (
    `id` MEDIUMINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `import_batch_id` BIGINT UNSIGNED NULL,
    `source_id` MEDIUMINT UNSIGNED NULL,
    `valid_from` DATE NULL,
    `valid_to` DATE NULL,
    `school_week_from` SMALLINT UNSIGNED NULL,
    `school_week_to` SMALLINT UNSIGNED NULL,
    `days_per_week` TINYINT UNSIGNED NOT NULL DEFAULT 5,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_base_data_import_batch` FOREIGN KEY (`import_batch_id`)
        REFERENCES `import_batches` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_base_data_source` FOREIGN KEY (`source_id`)
        REFERENCES `sources_metadata` (`id`) ON DELETE SET NULL
) ENGINE = InnoDB;

-- ===========================================
-- 2. Couplings (teacher-subject, [teacher-subject]-room, lesson, class-lesson)
-- ===========================================
CREATE TABLE IF NOT EXISTS
	teacher_subject (
		id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		teacher_id SMALLINT UNSIGNED NOT NULL,
		subject_id SMALLINT UNSIGNED NOT NULL,
		CONSTRAINT fk_ts_teacher FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE CASCADE,
		CONSTRAINT fk_ts_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE,
		UNIQUE KEY uq_teacher_subject (teacher_id, subject_id)
	) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS
	teacher_subject_room (
		id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		teacher_subject_id SMALLINT UNSIGNED NOT NULL,
		room_id SMALLINT UNSIGNED NOT NULL,
		CONSTRAINT fk_tsr_ts FOREIGN KEY (teacher_subject_id) REFERENCES teacher_subject (id) ON DELETE CASCADE,
		CONSTRAINT fk_tsr_room FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE,
		UNIQUE KEY uq_teacher_subject_room (teacher_subject_id, room_id)
	) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS
	lessons (
		id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		week_type_id TINYINT UNSIGNED NOT NULL,
		day_of_week TINYINT UNSIGNED NOT NULL,
		teacher_subject_room_id SMALLINT UNSIGNED NOT NULL,
		CONSTRAINT fk_lesson_week_type FOREIGN KEY (week_type_id) REFERENCES week_types (id) ON DELETE RESTRICT,
		CONSTRAINT fk_lesson_tsr FOREIGN KEY (teacher_subject_room_id) REFERENCES teacher_subject_room (id)
	) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS
	lesson_class_period (
		id MEDIUMINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		class_id SMALLINT UNSIGNED,
		course_id SMALLINT UNSIGNED,
		lesson_id SMALLINT UNSIGNED NOT NULL,
		period_id TINYINT UNSIGNED NOT NULL,
		CONSTRAINT fk_cl_class FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE,
		CONSTRAINT fk_cl_lesson FOREIGN KEY (lesson_id) REFERENCES lessons (id),
		CONSTRAINT fk_cl_course FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
		CONSTRAINT fk_cl_period FOREIGN KEY (period_id) REFERENCES periods (id) ON DELETE RESTRICT,
		UNIQUE KEY uq_lesson_class (class_id, lesson_id, period_id)
	) ENGINE = InnoDB;

-- ==========================================
-- 3. Scheduling (changes)
-- ==========================================
-- cancelled etc.
CREATE TABLE IF NOT EXISTS
	change_states (
		id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		name VARCHAR(20) NOT NULL UNIQUE
	) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS
	changes (
		id MEDIUMINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		date DATE NOT NULL,
		original_lesson_class_period_id MEDIUMINT UNSIGNED NOT NULL,
		state TINYINT UNSIGNED NOT NULL,
		info_text VARCHAR(255) NULL,
		CONSTRAINT fk_change_lesson_class_period FOREIGN KEY (original_lesson_class_period_id) REFERENCES lesson_class_period (id) ON DELETE CASCADE,
		CONSTRAINT fk_change_state FOREIGN KEY (state) REFERENCES change_states (id) ON DELETE CASCADE
	) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS
	teacher_changes (
		id MEDIUMINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		change_id MEDIUMINT UNSIGNED NOT NULL,
		teacher_id SMALLINT UNSIGNED NOT NULL,
		CONSTRAINT fk_teacher_change FOREIGN KEY (change_id) REFERENCES changes (id) ON DELETE CASCADE,
		CONSTRAINT fk_teacher_change_teacher FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE CASCADE
	) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS
	room_changes (
		id MEDIUMINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		change_id MEDIUMINT UNSIGNED NOT NULL,
		room_id SMALLINT UNSIGNED NOT NULL,
		CONSTRAINT fk_room_change FOREIGN KEY (change_id) REFERENCES changes (id) ON DELETE CASCADE,
		CONSTRAINT fk_room_change_room FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE
	) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS
	subject_changes (
		id MEDIUMINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		change_id MEDIUMINT UNSIGNED NOT NULL,
		subject_id SMALLINT UNSIGNED NOT NULL,
		CONSTRAINT fk_subject_change FOREIGN KEY (change_id) REFERENCES changes (id) ON DELETE CASCADE,
		CONSTRAINT fk_subject_change_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
	) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS
	break_supervisions (
		id MEDIUMINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		break_id MEDIUMINT UNSIGNED NOT NULL,
		teacher_id SMALLINT UNSIGNED NOT NULL,
		location VARCHAR(255) NULL,
		-- Continue here
		CONSTRAINT fk_break_supervision_break FOREIGN KEY (break_id) REFERENCES breaks (id) ON DELETE CASCADE,
		CONSTRAINT fk_break_supervision_teacher FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE CASCADE
	) ENGINE = InnoDB;