-- MariaDB 12+
CREATE DATABASE IF NOT EXISTS timetable_v2 
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;

USE timetable_v2;

-- ==========================================
-- 1. STATIC METADATA (Lookups)
-- ==========================================

CREATE TABLE IF NOT EXISTS teachers (
    id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    short_name VARCHAR(10) NOT NULL UNIQUE
) ENGINE=InnoDB PAGE_COMPRESSED=1;

CREATE TABLE IF NOT EXISTS subjects (
    id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    short_name VARCHAR(10) NOT NULL UNIQUE,
    long_name VARCHAR(100) NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS buildings (
    id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE,
    address VARCHAR(255) NULL
) ENGINE=InnoDB PAGE_COMPRESSED=1;

CREATE TABLE IF NOT EXISTS rooms (
    id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(20) NOT NULL,
    building_id SMALLINT UNSIGNED NULL,
    level VARCHAR(16) NULL, 
    CONSTRAINT fk_room_building FOREIGN KEY (building_id) 
        REFERENCES buildings(id) ON DELETE CASCADE,
    UNIQUE KEY uq_room_loc (name, building_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS classes (
    id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(20) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS periods (
    number TINYINT UNSIGNED PRIMARY KEY,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL
) ENGINE=InnoDB;

-- ==========================================
-- 2. DEFINITIONS (Structural Data)
-- ==========================================

CREATE TABLE IF NOT EXISTS lesson_definitions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    subject_id SMALLINT UNSIGNED NOT NULL,
    teacher_id SMALLINT UNSIGNED NOT NULL,
    room_id SMALLINT UNSIGNED NOT NULL,
    CONSTRAINT fk_def_sub FOREIGN KEY (subject_id) REFERENCES subjects(id),
    CONSTRAINT fk_def_tea FOREIGN KEY (teacher_id) REFERENCES teachers(id),
    CONSTRAINT fk_def_roo FOREIGN KEY (room_id) REFERENCES rooms(id),
    UNIQUE KEY uq_def (subject_id, teacher_id, room_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lesson_classes (
    definition_id INT UNSIGNED NOT NULL,
    class_id SMALLINT UNSIGNED NOT NULL,
    PRIMARY KEY (definition_id, class_id),
    CONSTRAINT fk_lc_def FOREIGN KEY (definition_id) REFERENCES lesson_definitions(id) ON DELETE CASCADE,
    CONSTRAINT fk_lc_cla FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==========================================
-- 3. PLAN DATA (The "Hot" Tables)
-- ==========================================

CREATE TABLE IF NOT EXISTS timetable_instances (
    id INT UNSIGNED NOT NULL,
    date DATE NOT NULL,
    period_number TINYINT UNSIGNED NOT NULL,
    definition_id INT UNSIGNED NOT NULL,
    status ENUM('scheduled', 'substituted', 'cancelled', 'time_change', 'room_change', 'exam') DEFAULT 'scheduled',
    
    -- Invisible columns for internal auditing without polluting API responses
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP INVISIBLE,
    day_of_week TINYINT AS (DAYOFWEEK(date)) VIRTUAL,

    PRIMARY KEY (date, id, period_number), 
    INDEX idx_lookup_date_class (date, period_number), -- Faster daily plan lookups
    CONSTRAINT fk_ti_per FOREIGN KEY (period_number) REFERENCES periods(number),    
    CONSTRAINT fk_ti_def FOREIGN KEY (definition_id) REFERENCES lesson_definitions(id)
) 
ENGINE=InnoDB 
WITH SYSTEM VERSIONING 
PAGE_COMPRESSED=1;
-- PARTITION BY RANGE (YEAR(date)) (
--     PARTITION p2024 VALUES LESS THAN (2025),
--     PARTITION p2025 VALUES LESS THAN (2026),
--     PARTITION p2026 VALUES LESS THAN (2027),
--     PARTITION p_future VALUES LESS THAN MAXVALUE
-- );

-- Separate table for extra substitution info
CREATE TABLE IF NOT EXISTS substitution_details (
    instance_id INT UNSIGNED NOT NULL,
    instance_date DATE NOT NULL,
    original_teacher_id SMALLINT UNSIGNED NULL,
    original_room_id SMALLINT UNSIGNED NULL,
    change_reason VARCHAR(255) NULL,
    notes TEXT NULL,
    
    PRIMARY KEY (instance_date, instance_id),
    CONSTRAINT fk_det_inst FOREIGN KEY (instance_date, instance_id) 
        REFERENCES timetable_instances(date, id) ON DELETE CASCADE
) ENGINE=InnoDB WITH SYSTEM VERSIONING PAGE_COMPRESSED=1;

CREATE TABLE IF NOT EXISTS supervisions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    teacher_id SMALLINT UNSIGNED NOT NULL,
    location VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    info_text VARCHAR(255) NULL,
    
    UNIQUE KEY uq_date_id (date, id),
    CONSTRAINT fk_sup_tea FOREIGN KEY (teacher_id) REFERENCES teachers(id)
) ENGINE=InnoDB 
WITH SYSTEM VERSIONING 
PAGE_COMPRESSED=1;
-- PARTITION BY RANGE (YEAR(date)) (
--     PARTITION p2024 VALUES LESS THAN (2025),
--     PARTITION p2025 VALUES LESS THAN (2026),
--     PARTITION p2026 VALUES LESS THAN (2027),
--     PARTITION p_future VALUES LESS THAN MAXVALUE
-- );

-- ==========================================
-- 4. UTILITY & HOLIDAYS
-- ==========================================

CREATE TABLE IF NOT EXISTS plan_metadata (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reference_date DATE UNIQUE NOT NULL, -- Date this plan is valid for
    generated_at TIMESTAMP NOT NULL, -- When this plan was generated
    plan_type VARCHAR(50)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS holidays (
    id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    INDEX idx_holiday_range (start_date, end_date)
) ENGINE=InnoDB;