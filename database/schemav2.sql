-- =============================================================================
-- MariaDB 11/12+ Database Schema v2 for Timetable and Substitution System
-- Designed for complete, lossless persistence of Indiware timetable data (output.json)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `timetable-v2` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `timetable-v2`;

-- =============================================================================
-- SECTION 1: System Metadata & Plan Provenance
-- =============================================================================

CREATE TABLE IF NOT EXISTS `import_batches` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `source_path` VARCHAR(255) NOT NULL,
    `sha256` CHAR(64) NOT NULL UNIQUE,
    `payload` JSON NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB;

-- Tracks source XML files processed, timestamps, and school metadata
CREATE TABLE IF NOT EXISTS `sources_metadata` (
    `id` MEDIUMINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `import_batch_id` BIGINT UNSIGNED NOT NULL,
    `file_name` VARCHAR(100) NOT NULL,
    `plan_type` VARCHAR(40) NULL,
    `plan_date_text` VARCHAR(64) NULL,
    `plan_date` DATE NULL,
    `generation_timestamp` TIMESTAMP NULL,
    `school_name` VARCHAR(128) NULL,
    `school_city` VARCHAR(64) NULL,
    `school_number` VARCHAR(32) NULL,
    `title` VARCHAR(128) NULL,
    `days_per_week` TINYINT UNSIGNED NULL,
    `school_week_number` TINYINT UNSIGNED NULL,
    `is_native` BOOLEAN NOT NULL DEFAULT 0,
    `valid_from` DATE NULL,
    `up_name` VARCHAR(64) NULL,
    `up_module` VARCHAR(32) NULL,
    `up_version` VARCHAR(20) NULL,
    `absent_teachers_raw` TEXT NULL,
    `changed_classes_raw` TEXT NULL,
    `changed_teachers_raw` TEXT NULL,
    `imported_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_sources_import_batch` FOREIGN KEY (`import_batch_id`)
        REFERENCES `import_batches` (`id`) ON DELETE CASCADE,
    UNIQUE KEY `uq_sources_batch_file` (`import_batch_id`, `file_name`),
    INDEX `idx_sources_file_name` (`file_name`),
    INDEX `idx_sources_plan_date` (`plan_date`),
    INDEX `idx_sources_gen_ts` (`generation_timestamp`)
) ENGINE = InnoDB;

-- Academic year / plan base configuration (Basisdaten)
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

-- =============================================================================
-- SECTION 2: Academic Calendar (Weeks & Holidays)
-- =============================================================================

-- Week rotation types (e.g. A-week, B-week)
CREATE TABLE IF NOT EXISTS `week_types` (
    `id` TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `code` VARCHAR(16) NOT NULL UNIQUE,
    `name` VARCHAR(32) NULL
) ENGINE = InnoDB;

-- School weeks mapping calendar weeks to week rotation and date ranges (Schulwochen)
CREATE TABLE IF NOT EXISTS `school_weeks` (
    `id` SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `import_batch_id` BIGINT UNSIGNED NULL,
    `source_id` MEDIUMINT UNSIGNED NULL,
    `school_week` SMALLINT UNSIGNED NOT NULL,
    `calendar_week` TINYINT UNSIGNED NOT NULL,
    `week_type_id` TINYINT UNSIGNED NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    CONSTRAINT `fk_sw_week_type` FOREIGN KEY (`week_type_id`) 
        REFERENCES `week_types` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_sw_import_batch` FOREIGN KEY (`import_batch_id`)
        REFERENCES `import_batches` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_sw_source` FOREIGN KEY (`source_id`)
        REFERENCES `sources_metadata` (`id`) ON DELETE SET NULL,
    CONSTRAINT `chk_sw_kw` CHECK (`calendar_week` BETWEEN 1 AND 53),
    CONSTRAINT `chk_sw_dates` CHECK (`end_date` >= `start_date`),
    UNIQUE KEY `uq_school_week_start` (`school_week`, `start_date`),
    INDEX `idx_school_weeks_dates` (`start_date`, `end_date`),
    INDEX `idx_school_weeks_kw` (`calendar_week`)
) ENGINE = InnoDB;

-- Calendar weeks overview (Kalenderwochen)
CREATE TABLE IF NOT EXISTS `calendar_weeks` (
    `id` SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `import_batch_id` BIGINT UNSIGNED NULL,
    `source_id` MEDIUMINT UNSIGNED NULL,
    `calendar_week` TINYINT UNSIGNED NOT NULL,
    `week_type_id` TINYINT UNSIGNED NULL,
    `start_date` DATE NULL,
    `end_date` DATE NULL,
    CONSTRAINT `fk_cw_week_type` FOREIGN KEY (`week_type_id`) 
        REFERENCES `week_types` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_cw_import_batch` FOREIGN KEY (`import_batch_id`)
        REFERENCES `import_batches` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_cw_source` FOREIGN KEY (`source_id`)
        REFERENCES `sources_metadata` (`id`) ON DELETE SET NULL,
    CONSTRAINT `chk_cw_kw` CHECK (`calendar_week` BETWEEN 1 AND 53),
    UNIQUE KEY `uq_calendar_week` (`calendar_week`, `start_date`, `end_date`, `week_type_id`),
    INDEX `idx_calendar_weeks_dates` (`start_date`, `end_date`)
) ENGINE = InnoDB;

-- Holidays, free days and festivities (FreieTage)
CREATE TABLE IF NOT EXISTS `holidays` (
    `id` SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `date` DATE NOT NULL UNIQUE,
    `raw_code` CHAR(6) NULL,
    `is_festivity` BOOLEAN NOT NULL DEFAULT 0,
    `name` VARCHAR(64) NULL,
    INDEX `idx_holidays_date` (`date`)
) ENGINE = InnoDB;

-- =============================================================================
-- SECTION 3: School Master Entities (Teachers, Classes, Subjects, Rooms, Periods)
-- =============================================================================

-- Teachers master data
CREATE TABLE IF NOT EXISTS `teachers` (
    `id` SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `short_name` VARCHAR(32) NOT NULL UNIQUE,
    `first_name` VARCHAR(50) NULL,
    `last_name` VARCHAR(50) NULL,
    `email` VARCHAR(100) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT 1,
    INDEX `idx_teachers_short_name` (`short_name`)
) ENGINE = InnoDB;

-- Classes and student cohort groups
CREATE TABLE IF NOT EXISTS `classes` (
    `id` SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(64) NOT NULL UNIQUE,
    `grade_level` VARCHAR(10) NULL,
    `is_group` BOOLEAN NOT NULL DEFAULT 0,
    INDEX `idx_classes_name` (`name`),
    INDEX `idx_classes_grade` (`grade_level`)
) ENGINE = InnoDB;

-- Subjects catalog
CREATE TABLE IF NOT EXISTS `subjects` (
    `id` SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `short_name` VARCHAR(20) NOT NULL UNIQUE,
    `long_name` VARCHAR(100) NULL,
    INDEX `idx_subjects_short_name` (`short_name`)
) ENGINE = InnoDB;

-- Physical school buildings
CREATE TABLE IF NOT EXISTS `buildings` (
    `id` TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(64) NOT NULL UNIQUE,
    `address` VARCHAR(255) NULL
) ENGINE = InnoDB;

-- Building levels / floors
CREATE TABLE IF NOT EXISTS `building_levels` (
    `id` SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `building_id` TINYINT UNSIGNED NOT NULL,
    `level_name` VARCHAR(32) NOT NULL,
    CONSTRAINT `fk_bl_building` FOREIGN KEY (`building_id`) 
        REFERENCES `buildings` (`id`) ON DELETE CASCADE,
    UNIQUE KEY `uq_building_level` (`building_id`, `level_name`)
) ENGINE = InnoDB;

-- Rooms and teaching spaces
CREATE TABLE IF NOT EXISTS `rooms` (
    `id` SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(32) NOT NULL UNIQUE,
    `building_id` TINYINT UNSIGNED NULL,
    `building_level_id` SMALLINT UNSIGNED NULL,
    `capacity` SMALLINT UNSIGNED NULL,
    CONSTRAINT `fk_room_building` FOREIGN KEY (`building_id`) 
        REFERENCES `buildings` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_room_building_level` FOREIGN KEY (`building_level_id`) 
        REFERENCES `building_levels` (`id`) ON DELETE SET NULL,
    INDEX `idx_rooms_name` (`name`)
) ENGINE = InnoDB;

-- Standard period timetable slots (Stunden)
CREATE TABLE IF NOT EXISTS `periods` (
    `id` SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `period_number` TINYINT UNSIGNED NOT NULL,
    `start_time` TIME NULL,
    `end_time` TIME NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT 1,
    CONSTRAINT `chk_period_range` CHECK (`period_number` BETWEEN 0 AND 20),
    UNIQUE KEY `uq_period_slot` (`period_number`, `start_time`, `end_time`),
    INDEX `idx_periods_number` (`period_number`)
) ENGINE = InnoDB;

-- Entity-specific period timing overrides (per class, teacher or room)
CREATE TABLE IF NOT EXISTS `entity_periods` (
    `id` MEDIUMINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `source_id` MEDIUMINT UNSIGNED NULL,
    `entity_type` ENUM('CLASS', 'TEACHER', 'ROOM') NOT NULL DEFAULT 'CLASS',
    `class_id` SMALLINT UNSIGNED NULL,
    `teacher_id` SMALLINT UNSIGNED NULL,
    `room_id` SMALLINT UNSIGNED NULL,
    `period_number` TINYINT UNSIGNED NOT NULL,
    `start_time` TIME NULL,
    `end_time` TIME NULL,
    CONSTRAINT `fk_ep_class` FOREIGN KEY (`class_id`) 
        REFERENCES `classes` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ep_teacher` FOREIGN KEY (`teacher_id`) 
        REFERENCES `teachers` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ep_room` FOREIGN KEY (`room_id`) 
        REFERENCES `rooms` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ep_source` FOREIGN KEY (`source_id`)
        REFERENCES `sources_metadata` (`id`) ON DELETE SET NULL,
    UNIQUE KEY `uq_entity_period` (`entity_type`, `class_id`, `teacher_id`, `room_id`, `period_number`, `start_time`, `end_time`),
    INDEX `idx_ep_class_period` (`class_id`, `period_number`),
    INDEX `idx_ep_teacher_period` (`teacher_id`, `period_number`)
) ENGINE = InnoDB;

-- =============================================================================
-- SECTION 4: Academic Curriculum Structure (Courses & Teaching Units)
-- =============================================================================

-- Courses offering catalog (Kurse)
CREATE TABLE IF NOT EXISTS `courses` (
    `id` SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `source_id` MEDIUMINT UNSIGNED NULL,
    `code` VARCHAR(30) NOT NULL,
    `teacher_id` SMALLINT UNSIGNED NULL,
    `class_id` SMALLINT UNSIGNED NULL,
    CONSTRAINT `fk_course_teacher` FOREIGN KEY (`teacher_id`) 
        REFERENCES `teachers` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_course_class` FOREIGN KEY (`class_id`) 
        REFERENCES `classes` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_course_source` FOREIGN KEY (`source_id`)
        REFERENCES `sources_metadata` (`id`) ON DELETE SET NULL,
    UNIQUE KEY `uq_course_code_class_teacher` (`code`, `class_id`, `teacher_id`),
    INDEX `idx_courses_code` (`code`)
) ENGINE = InnoDB;

-- Teaching units curriculum definitions (Unterricht)
CREATE TABLE IF NOT EXISTS `teaching_units` (
    `id` MEDIUMINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `source_id` MEDIUMINT UNSIGNED NULL,
    `lesson_number` VARCHAR(10) NOT NULL,
    `subject_id` SMALLINT UNSIGNED NOT NULL,
    `teacher_id` SMALLINT UNSIGNED NULL,
    `class_id` SMALLINT UNSIGNED NULL,
    `group_name` VARCHAR(30) NULL,
    CONSTRAINT `fk_tu_subject` FOREIGN KEY (`subject_id`) 
        REFERENCES `subjects` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_tu_teacher` FOREIGN KEY (`teacher_id`) 
        REFERENCES `teachers` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_tu_class` FOREIGN KEY (`class_id`) 
        REFERENCES `classes` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_tu_source` FOREIGN KEY (`source_id`)
        REFERENCES `sources_metadata` (`id`) ON DELETE SET NULL,
    UNIQUE KEY `uq_teaching_unit` (`lesson_number`, `class_id`, `subject_id`, `teacher_id`, `group_name`),
    INDEX `idx_tu_lesson_number` (`lesson_number`),
    INDEX `idx_tu_class` (`class_id`),
    INDEX `idx_tu_teacher` (`teacher_id`)
) ENGINE = InnoDB;

-- =============================================================================
-- SECTION 5: Timetable Schedules (Weekly Base Plans & Daily Instances)
-- =============================================================================

-- Normalized recurring teacher-subject-room coupling
CREATE TABLE IF NOT EXISTS `teacher_subject_room` (
    `id` SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `teacher_id` SMALLINT UNSIGNED NOT NULL,
    `subject_id` SMALLINT UNSIGNED NOT NULL,
    `room_id` SMALLINT UNSIGNED NULL,
    CONSTRAINT `fk_tsr_teacher` FOREIGN KEY (`teacher_id`) 
        REFERENCES `teachers` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_tsr_subject` FOREIGN KEY (`subject_id`) 
        REFERENCES `subjects` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_tsr_room` FOREIGN KEY (`room_id`) 
        REFERENCES `rooms` (`id`) ON DELETE SET NULL,
    UNIQUE KEY `uq_tsr` (`teacher_id`, `subject_id`, `room_id`)
) ENGINE = InnoDB;

-- Recurring weekly timetable plans (WeeklyData.plan)
CREATE TABLE IF NOT EXISTS `weekly_timetable_plans` (
    `id` MEDIUMINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `source_id` MEDIUMINT UNSIGNED NULL,
    `entity_type` ENUM('CLASS', 'TEACHER', 'ROOM') NOT NULL DEFAULT 'CLASS',
    `entity_name` VARCHAR(64) NOT NULL,
    `school_week` SMALLINT UNSIGNED NULL,
    `week_type_id` TINYINT UNSIGNED NULL,
    `day_of_week` TINYINT UNSIGNED NULL,
    `period_number` TINYINT UNSIGNED NOT NULL,
    `class_id` SMALLINT UNSIGNED NULL,
    `teacher_id` SMALLINT UNSIGNED NULL,
    `subject_id` SMALLINT UNSIGNED NULL,
    `room_id` SMALLINT UNSIGNED NULL,
    `course_id` SMALLINT UNSIGNED NULL,
    `lesson_number` VARCHAR(10) NULL,
    `raw_class` VARCHAR(64) NULL,
    `raw_teacher` VARCHAR(32) NULL,
    `raw_subject` VARCHAR(20) NULL,
    `raw_room` VARCHAR(32) NULL,
    `info` VARCHAR(500) NULL,
    `import_batch_id` BIGINT UNSIGNED NULL,
    CONSTRAINT `fk_wtp_week_type` FOREIGN KEY (`week_type_id`) 
        REFERENCES `week_types` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_wtp_class` FOREIGN KEY (`class_id`) 
        REFERENCES `classes` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_wtp_teacher` FOREIGN KEY (`teacher_id`) 
        REFERENCES `teachers` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_wtp_subject` FOREIGN KEY (`subject_id`) 
        REFERENCES `subjects` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_wtp_room` FOREIGN KEY (`room_id`) 
        REFERENCES `rooms` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_wtp_course` FOREIGN KEY (`course_id`) 
        REFERENCES `courses` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_wtp_import_batch` FOREIGN KEY (`import_batch_id`)
        REFERENCES `import_batches` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_wtp_source` FOREIGN KEY (`source_id`)
        REFERENCES `sources_metadata` (`id`) ON DELETE SET NULL,
    CONSTRAINT `chk_wtp_dow` CHECK (`day_of_week` IS NULL OR `day_of_week` BETWEEN 1 AND 7),
    INDEX `idx_wtp_class_dow_period` (`class_id`, `day_of_week`, `period_number`),
    INDEX `idx_wtp_teacher_dow_period` (`teacher_id`, `day_of_week`, `period_number`),
    INDEX `idx_wtp_room_dow_period` (`room_id`, `day_of_week`, `period_number`),
    INDEX `idx_wtp_lesson_number` (`lesson_number`),
    INDEX `idx_wtp_entity` (`entity_name`, `day_of_week`, `period_number`)
) ENGINE = InnoDB;

-- Concrete daily timetable entries / snapshot instances (DayData.plan)
CREATE TABLE IF NOT EXISTS `daily_timetable_entries` (
    `id` MEDIUMINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `source_id` MEDIUMINT UNSIGNED NULL,
    `plan_date` DATE NOT NULL,
    `entity_type` ENUM('CLASS', 'TEACHER', 'ROOM') NOT NULL DEFAULT 'CLASS',
    `entity_name` VARCHAR(64) NOT NULL,
    `period_number` TINYINT UNSIGNED NOT NULL,
    `start_time` TIME NULL,
    `end_time` TIME NULL,
    `class_id` SMALLINT UNSIGNED NULL,
    `teacher_id` SMALLINT UNSIGNED NULL,
    `subject_id` SMALLINT UNSIGNED NULL,
    `room_id` SMALLINT UNSIGNED NULL,
    `course_id` SMALLINT UNSIGNED NULL,
    `lesson_number` VARCHAR(10) NULL,
    `raw_class` VARCHAR(64) NULL,
    `raw_teacher` VARCHAR(32) NULL,
    `raw_subject` VARCHAR(20) NULL,
    `raw_room` VARCHAR(32) NULL,
    `info` TEXT NULL,
    `is_cancelled` BOOLEAN NOT NULL DEFAULT 0,
    `import_batch_id` BIGINT UNSIGNED NULL,
    CONSTRAINT `fk_dte_class` FOREIGN KEY (`class_id`) 
        REFERENCES `classes` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_dte_teacher` FOREIGN KEY (`teacher_id`) 
        REFERENCES `teachers` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_dte_subject` FOREIGN KEY (`subject_id`) 
        REFERENCES `subjects` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_dte_room` FOREIGN KEY (`room_id`) 
        REFERENCES `rooms` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_dte_course` FOREIGN KEY (`course_id`) 
        REFERENCES `courses` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_dte_import_batch` FOREIGN KEY (`import_batch_id`)
        REFERENCES `import_batches` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_dte_source` FOREIGN KEY (`source_id`)
        REFERENCES `sources_metadata` (`id`) ON DELETE SET NULL,
    INDEX `idx_dte_date_class` (`plan_date`, `class_id`, `period_number`),
    INDEX `idx_dte_date_teacher` (`plan_date`, `teacher_id`, `period_number`),
    INDEX `idx_dte_date_room` (`plan_date`, `room_id`, `period_number`),
    INDEX `idx_dte_lesson_number` (`lesson_number`),
    INDEX `idx_dte_entity` (`plan_date`, `entity_name`, `period_number`)
) ENGINE = InnoDB;

-- =============================================================================
-- SECTION 6: Substitutions & Change Management
-- =============================================================================

-- Change state classifications
CREATE TABLE IF NOT EXISTS `change_states` (
    `id` TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(32) NOT NULL UNIQUE
) ENGINE = InnoDB;

-- Daily substitutions and schedule changes (Changes)
CREATE TABLE IF NOT EXISTS `changes` (
    `id` MEDIUMINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `source_id` MEDIUMINT UNSIGNED NULL,
    `change_date` DATE NULL,
    `import_batch_id` BIGINT UNSIGNED NULL,
    `raw_period` VARCHAR(10) NOT NULL,
    `period_start` TINYINT UNSIGNED NULL,
    `period_end` TINYINT UNSIGNED NULL,
    `class_id` SMALLINT UNSIGNED NULL,
    `raw_class` VARCHAR(64) NOT NULL,
    `current_subject_id` SMALLINT UNSIGNED NULL,
    `raw_current_subject` VARCHAR(20) NULL,
    `original_subject_id` SMALLINT UNSIGNED NULL,
    `raw_original_subject` VARCHAR(20) NULL,
    `is_subject_changed` BOOLEAN NOT NULL DEFAULT 0,
    `current_teacher_id` SMALLINT UNSIGNED NULL,
    `raw_current_teacher` VARCHAR(32) NULL,
    `original_teacher_id` SMALLINT UNSIGNED NULL,
    `raw_original_teacher` VARCHAR(32) NULL,
    `is_teacher_changed` BOOLEAN NOT NULL DEFAULT 0,
    `room_id` SMALLINT UNSIGNED NULL,
    `raw_room` VARCHAR(32) NULL,
    `original_room_id` SMALLINT UNSIGNED NULL,
    `raw_original_room` VARCHAR(32) NULL,
    `is_room_changed` BOOLEAN NOT NULL DEFAULT 0,
    `state_id` TINYINT UNSIGNED NULL,
    `info` VARCHAR(255) NULL,
    CONSTRAINT `fk_change_import_batch` FOREIGN KEY (`import_batch_id`)
        REFERENCES `import_batches` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_change_source` FOREIGN KEY (`source_id`)
        REFERENCES `sources_metadata` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_change_class` FOREIGN KEY (`class_id`) 
        REFERENCES `classes` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_change_curr_subj` FOREIGN KEY (`current_subject_id`) 
        REFERENCES `subjects` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_change_orig_subj` FOREIGN KEY (`original_subject_id`) 
        REFERENCES `subjects` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_change_curr_teach` FOREIGN KEY (`current_teacher_id`) 
        REFERENCES `teachers` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_change_orig_teach` FOREIGN KEY (`original_teacher_id`) 
        REFERENCES `teachers` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_change_room` FOREIGN KEY (`room_id`) 
        REFERENCES `rooms` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_change_original_room` FOREIGN KEY (`original_room_id`)
        REFERENCES `rooms` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_change_state` FOREIGN KEY (`state_id`) 
        REFERENCES `change_states` (`id`) ON DELETE SET NULL,
    INDEX `idx_changes_date_class` (`change_date`, `class_id`),
    INDEX `idx_changes_date_teacher` (`change_date`, `current_teacher_id`),
    INDEX `idx_changes_orig_teacher` (`change_date`, `original_teacher_id`),
    INDEX `idx_changes_raw_class` (`raw_class`)
) ENGINE = InnoDB;

-- =============================================================================
-- SECTION 7: Duties, Exams, Blocked Periods & Remarks
-- =============================================================================

-- Break supervision duties and coverage changes (Aufsichten)
CREATE TABLE IF NOT EXISTS `break_supervisions` (
    `id` MEDIUMINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `duty_date` DATE NULL,
    `source_id` MEDIUMINT UNSIGNED NULL,
    `import_batch_id` BIGINT UNSIGNED NULL,
    `teacher_id` SMALLINT UNSIGNED NULL,
    `raw_teacher` VARCHAR(32) NULL,
    `day_of_week` TINYINT UNSIGNED NULL,
    `preceding_period` TINYINT UNSIGNED NULL,
    `duty_time` TIME NULL,
    `slot_name` VARCHAR(32) NULL,
    `location` VARCHAR(64) NULL,
    `change_type` VARCHAR(32) NULL,
    `substitute_for_teacher_id` SMALLINT UNSIGNED NULL,
    `substitute_for_raw` VARCHAR(32) NULL,
    `info` VARCHAR(100) NULL,
    `raw_text` TEXT NULL,
    CONSTRAINT `fk_bs_teacher` FOREIGN KEY (`teacher_id`) 
        REFERENCES `teachers` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_bs_sub_teacher` FOREIGN KEY (`substitute_for_teacher_id`) 
        REFERENCES `teachers` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_bs_import_batch` FOREIGN KEY (`import_batch_id`)
        REFERENCES `import_batches` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_bs_source` FOREIGN KEY (`source_id`)
        REFERENCES `sources_metadata` (`id`) ON DELETE SET NULL,
    CONSTRAINT `chk_bs_dow` CHECK (`day_of_week` IS NULL OR `day_of_week` BETWEEN 1 AND 7),
    INDEX `idx_bs_teacher_day` (`teacher_id`, `day_of_week`),
    INDEX `idx_bs_date_teacher` (`duty_date`, `teacher_id`),
    INDEX `idx_bs_location` (`location`)
) ENGINE = InnoDB;

-- Exams and tests schedule (Klausuren)
CREATE TABLE IF NOT EXISTS `exams` (
    `id` MEDIUMINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `exam_date` DATE NULL,
    `source_id` MEDIUMINT UNSIGNED NULL,
    `import_batch_id` BIGINT UNSIGNED NULL,
    `grade_level` VARCHAR(16) NULL,
    `course_code` VARCHAR(32) NULL,
    `course_id` SMALLINT UNSIGNED NULL,
    `teacher_id` SMALLINT UNSIGNED NULL,
    `raw_teacher` VARCHAR(32) NULL,
    `period_number` TINYINT UNSIGNED NULL,
    `start_time` TIME NULL,
    `duration_minutes` SMALLINT UNSIGNED NULL,
    `info` VARCHAR(255) NULL,
    CONSTRAINT `fk_exam_course` FOREIGN KEY (`course_id`) 
        REFERENCES `courses` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_exam_teacher` FOREIGN KEY (`teacher_id`) 
        REFERENCES `teachers` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_exam_import_batch` FOREIGN KEY (`import_batch_id`)
        REFERENCES `import_batches` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_exam_source` FOREIGN KEY (`source_id`)
        REFERENCES `sources_metadata` (`id`) ON DELETE SET NULL,
    INDEX `idx_exams_date` (`exam_date`),
    INDEX `idx_exams_grade` (`grade_level`),
    INDEX `idx_exams_teacher` (`teacher_id`)
) ENGINE = InnoDB;

-- Blocked unavailable periods for classes, teachers, rooms (Sperrungen)
CREATE TABLE IF NOT EXISTS `blocked_periods` (
    `id` MEDIUMINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `source_id` MEDIUMINT UNSIGNED NULL,
    `import_batch_id` BIGINT UNSIGNED NULL,
    `entity_type` ENUM('TEACHER', 'CLASS', 'ROOM') NOT NULL,
    `entity_name` VARCHAR(32) NOT NULL,
    `teacher_id` SMALLINT UNSIGNED NULL,
    `class_id` SMALLINT UNSIGNED NULL,
    `room_id` SMALLINT UNSIGNED NULL,
    `day_of_week` TINYINT UNSIGNED NOT NULL,
    `period_number` TINYINT UNSIGNED NOT NULL,
    `reason` VARCHAR(100) NULL,
    CONSTRAINT `fk_bp_teacher` FOREIGN KEY (`teacher_id`) 
        REFERENCES `teachers` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_bp_class` FOREIGN KEY (`class_id`) 
        REFERENCES `classes` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_bp_room` FOREIGN KEY (`room_id`) 
        REFERENCES `rooms` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_bp_source` FOREIGN KEY (`source_id`)
        REFERENCES `sources_metadata` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_bp_import_batch` FOREIGN KEY (`import_batch_id`)
        REFERENCES `import_batches` (`id`) ON DELETE SET NULL,
    CONSTRAINT `chk_bp_dow` CHECK (`day_of_week` BETWEEN 1 AND 7),
    CONSTRAINT `chk_bp_period` CHECK (`period_number` BETWEEN 0 AND 20),
    UNIQUE KEY `uq_blocked_period` (`entity_type`, `entity_name`, `day_of_week`, `period_number`),
    INDEX `idx_bp_day_period` (`day_of_week`, `period_number`)
) ENGINE = InnoDB;

-- Timetable notes and remarks (Planinfo)
CREATE TABLE IF NOT EXISTS `plan_notes` (
    `id` MEDIUMINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `entity_type` ENUM('TEACHER', 'CLASS', 'ROOM') NOT NULL DEFAULT 'TEACHER',
    `entity_name` VARCHAR(32) NOT NULL,
    `teacher_id` SMALLINT UNSIGNED NULL,
    `class_id` SMALLINT UNSIGNED NULL,
    `room_id` SMALLINT UNSIGNED NULL,
    `day_of_week` TINYINT UNSIGNED NOT NULL,
    `period_number` TINYINT UNSIGNED NOT NULL,
    `note_text` VARCHAR(255) NOT NULL,
    `plan_date` DATE NULL,
    `source_id` MEDIUMINT UNSIGNED NULL,
    `import_batch_id` BIGINT UNSIGNED NULL,
    CONSTRAINT `fk_pn_teacher` FOREIGN KEY (`teacher_id`) 
        REFERENCES `teachers` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_pn_class` FOREIGN KEY (`class_id`) 
        REFERENCES `classes` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_pn_room` FOREIGN KEY (`room_id`) 
        REFERENCES `rooms` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_pn_import_batch` FOREIGN KEY (`import_batch_id`)
        REFERENCES `import_batches` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_pn_source` FOREIGN KEY (`source_id`)
        REFERENCES `sources_metadata` (`id`) ON DELETE SET NULL,
    CONSTRAINT `chk_pn_dow` CHECK (`day_of_week` BETWEEN 1 AND 7),
    CONSTRAINT `chk_pn_period` CHECK (`period_number` BETWEEN 0 AND 20),
    INDEX `idx_pn_entity_day_period` (`entity_name`, `day_of_week`, `period_number`),
    INDEX `idx_pn_teacher` (`teacher_id`)
) ENGINE = InnoDB;

-- =============================================================================
-- SECTION 8: Analytical & Operational Views
-- =============================================================================

-- View: Unified daily timetable with joined entity names and locations
CREATE OR REPLACE VIEW `v_daily_schedule` AS
SELECT 
    d.id,
    d.plan_date,
    d.period_number,
    d.start_time,
    d.end_time,
    COALESCE(c.name, d.raw_class, d.entity_name) AS class_name,
    COALESCE(s.short_name, d.raw_subject) AS subject_name,
    s.long_name AS subject_full_name,
    COALESCE(t.short_name, d.raw_teacher) AS teacher_name,
    COALESCE(r.name, d.raw_room) AS room_name,
    b.name AS building_name,
    bl.level_name AS building_level,
    b.address AS building_address,
    d.lesson_number,
    d.info,
    d.is_cancelled
FROM `daily_timetable_entries` d
LEFT JOIN `classes` c ON d.class_id = c.id
LEFT JOIN `subjects` s ON d.subject_id = s.id
LEFT JOIN `teachers` t ON d.teacher_id = t.id
LEFT JOIN `rooms` r ON d.room_id = r.id
LEFT JOIN `buildings` b ON r.building_id = b.id
LEFT JOIN `building_levels` bl ON r.building_level_id = bl.id;

-- View: Unified recurring weekly schedule
CREATE OR REPLACE VIEW `v_weekly_timetable` AS
SELECT 
    w.id,
    w.school_week,
    wt.code AS week_type,
    w.day_of_week,
    w.period_number,
    COALESCE(c.name, w.raw_class, w.entity_name) AS class_name,
    COALESCE(s.short_name, w.raw_subject) AS subject_name,
    s.long_name AS subject_full_name,
    COALESCE(t.short_name, w.raw_teacher) AS teacher_name,
    COALESCE(r.name, w.raw_room) AS room_name,
    b.name AS building_name,
    w.lesson_number,
    w.info
FROM `weekly_timetable_plans` w
LEFT JOIN `week_types` wt ON w.week_type_id = wt.id
LEFT JOIN `classes` c ON w.class_id = c.id
LEFT JOIN `subjects` s ON w.subject_id = s.id
LEFT JOIN `teachers` t ON w.teacher_id = t.id
LEFT JOIN `rooms` r ON w.room_id = r.id
LEFT JOIN `buildings` b ON r.building_id = b.id;

-- View: Daily substitutions overview
CREATE OR REPLACE VIEW `v_daily_substitutions` AS
SELECT 
    ch.id,
    ch.change_date,
    ch.raw_period,
    COALESCE(c.name, ch.raw_class) AS class_name,
    COALESCE(curr_s.short_name, ch.raw_current_subject) AS current_subject,
    COALESCE(orig_s.short_name, ch.raw_original_subject) AS original_subject,
    ch.is_subject_changed,
    COALESCE(curr_t.short_name, ch.raw_current_teacher) AS current_teacher,
    COALESCE(orig_t.short_name, ch.raw_original_teacher) AS original_teacher,
    ch.is_teacher_changed,
    COALESCE(rm.name, ch.raw_room) AS replacement_room,
    COALESCE(orig_rm.name, ch.raw_original_room) AS original_room,
    ch.is_room_changed,
    cs.name AS change_state,
    ch.info
FROM `changes` ch
LEFT JOIN `classes` c ON ch.class_id = c.id
LEFT JOIN `subjects` curr_s ON ch.current_subject_id = curr_s.id
LEFT JOIN `subjects` orig_s ON ch.original_subject_id = orig_s.id
LEFT JOIN `teachers` curr_t ON ch.current_teacher_id = curr_t.id
LEFT JOIN `teachers` orig_t ON ch.original_teacher_id = orig_t.id
LEFT JOIN `rooms` rm ON ch.room_id = rm.id
LEFT JOIN `rooms` orig_rm ON ch.original_room_id = orig_rm.id
LEFT JOIN `change_states` cs ON ch.state_id = cs.id;
