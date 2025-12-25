-- MariaDB 11/12+ Optimized Schema
CREATE DATABASE IF NOT EXISTS school_timetable_v2 
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;

USE school_timetable_v2;

-- ==========================================
-- 1. STATIC METADATA (Lookups)
-- ==========================================

CREATE TABLE teachers (
    id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    short_name VARCHAR(10) NOT NULL UNIQUE
) ENGINE=InnoDB PAGE_COMPRESSED=1;

CREATE TABLE subjects (
    id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    short_name VARCHAR(10) NOT NULL UNIQUE,
    long_name VARCHAR(100) NULL
) ENGINE=InnoDB;

CREATE TABLE buildings (
    id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE,       -- e.g., "Main Building"
    address VARCHAR(255) NULL,              -- e.g., "123 School Lane"
) ENGINE=InnoDB PAGE_COMPRESSED=1;

CREATE TABLE rooms (
    id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(20) NOT NULL,
    building_id SMALLINT UNSIGNED NOT NULL,
    level VARCHAR(16) NULL, 
    CONSTRAINT fk_room_building FOREIGN KEY (building_id) 
        REFERENCES buildings(id) ON DELETE CASCADE,
    UNIQUE KEY uq_room_loc (name, building_id)
) ENGINE=InnoDB;

CREATE TABLE classes (
    id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(20) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE periods (
    number TINYINT UNSIGNED PRIMARY KEY,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL
) ENGINE=InnoDB;

-- ==========================================
-- 2. DEFINITIONS (Structural Data)
-- ==========================================

CREATE TABLE lesson_definitions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    subject_id SMALLINT UNSIGNED NOT NULL,
    teacher_id SMALLINT UNSIGNED NOT NULL,
    room_id SMALLINT UNSIGNED NOT NULL,
    CONSTRAINT fk_def_sub FOREIGN KEY (subject_id) REFERENCES subjects(id),
    CONSTRAINT fk_def_tea FOREIGN KEY (teacher_id) REFERENCES teachers(id),
    CONSTRAINT fk_def_roo FOREIGN KEY (room_id) REFERENCES rooms(id),
    UNIQUE KEY uq_def (subject_id, teacher_id, room_id)
) ENGINE=InnoDB;

CREATE TABLE lesson_classes (
    definition_id INT UNSIGNED NOT NULL,
    class_id SMALLINT UNSIGNED NOT NULL,
    PRIMARY KEY (definition_id, class_id),
    CONSTRAINT fk_lc_def FOREIGN KEY (definition_id) REFERENCES lesson_definitions(id) ON DELETE CASCADE,
    CONSTRAINT fk_lc_cla FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==========================================
-- 3. VERSIONED & PARTITIONED DATA (The "Hot" Plan)
-- ==========================================

-- This table tracks every change automatically via System Versioning
-- It is partitioned by year to keep queries fast as history grows
CREATE TABLE timetable_instances (
    id INT UNSIGNED NOT NULL,
    date DATE NOT NULL,
    period_number TINYINT UNSIGNED NOT NULL,
    definition_id INT UNSIGNED NOT NULL,
    status ENUM('scheduled', 'substituted', 'cancelled', 'time_change', 'room_change') DEFAULT 'scheduled',
    
    -- Invisible columns for internal auditing without polluting API responses
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP INVISIBLE,
    
    -- Optimization: Virtual column for Day of Week (0 space usage)
    day_of_week TINYINT AS (DAYOFWEEK(date)) VIRTUAL,

    -- Optimization: PK flipped to (date, id) for physical data locality
    PRIMARY KEY (date, id, period_number), 
    CONSTRAINT fk_ti_per FOREIGN KEY (period_number) REFERENCES periods(number),    
    CONSTRAINT fk_ti_def FOREIGN KEY (definition_id) REFERENCES lesson_definitions(id)
) 
ENGINE=InnoDB 
WITH SYSTEM VERSIONING -- Optimization: Auto-track substitutions history
-- AUTOMATION: This creates a new partition for every 1 year automatically
PARTITION BY RANGE (YEAR(date)) 
INTERVAL (1) FIRST PARTITION START ('2024-01-01') LAST PARTITION END ('2026-01-01');

-- Separate table for extra substitution info, also versioned
CREATE TABLE substitution_details (
    instance_id INT UNSIGNED NOT NULL,
    instance_date DATE NOT NULL,
    original_teacher_id SMALLINT UNSIGNED NULL,
    original_room_id SMALLINT UNSIGNED NULL,
    change_reason VARCHAR(255) COMPRESSED=zstd NULL,
    notes TEXT COMPRESSED=zstd NULL,
    
    PRIMARY KEY (instance_date, instance_id),
    CONSTRAINT fk_sub_inst FOREIGN KEY (instance_date, instance_id) 
        REFERENCES timetable_instances(date, id) ON DELETE CASCADE
) 
ENGINE=InnoDB 
WITH SYSTEM VERSIONING 
PAGE_COMPRESSED=1; -- Optimization: Compress notes/reasons on disk

-- ==========================================
-- 4. UTILITY TABLES
-- ==========================================

CREATE TABLE plan_metadata (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reference_date DATE UNIQUE NOT NULL, -- Date this plan is valid for
    generated_at TIMESTAMP NOT NULL, -- When this plan was generated
    plan_type VARCHAR(50)
) ENGINE=InnoDB;

CREATE TABLE holidays (
    id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL
) ENGINE=InnoDB;