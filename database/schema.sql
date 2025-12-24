-- Optional: create and use a database (adjust name if needed)
CREATE DATABASE IF NOT EXISTS timetable CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE timetable;

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- Classes (must be created before foreign key references)
CREATE TABLE IF NOT EXISTS classes (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(32)  NOT NULL,         -- e.g. "10A"
  UNIQUE KEY uq_classes_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Class groups (self-referencing many-to-many)
CREATE TABLE IF NOT EXISTS class_groups_fk (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    parent_class_id BIGINT UNSIGNED NOT NULL,
    child_class_id  BIGINT UNSIGNED NOT NULL,
    UNIQUE KEY uq_class_groups_fk (parent_class_id, child_class_id),
    CONSTRAINT fk_class_groups_parent
        FOREIGN KEY (parent_class_id) REFERENCES classes(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_class_groups_child
        FOREIGN KEY (child_class_id) REFERENCES classes(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Subjects (must be created before foreign key references)
CREATE TABLE IF NOT EXISTS subjects (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  short_name   VARCHAR(32)  NOT NULL,       -- e.g. "MA"
  long_name    VARCHAR(128) NULL,           -- e.g. "Mathematics"
  UNIQUE KEY uq_subjects_short_name (short_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Subject groups (self-referencing many-to-many)
CREATE TABLE IF NOT EXISTS subject_groups_fk (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    parent_subject_id BIGINT UNSIGNED NOT NULL,
    child_subject_id  BIGINT UNSIGNED NOT NULL,
    UNIQUE KEY uq_subject_groups_fk (parent_subject_id, child_subject_id),
    CONSTRAINT fk_subject_groups_parent
        FOREIGN KEY (parent_subject_id) REFERENCES subjects(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_subject_groups_child
        FOREIGN KEY (child_subject_id) REFERENCES subjects(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Teachers
CREATE TABLE IF NOT EXISTS teachers (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  short_name   VARCHAR(32)  NOT NULL,       -- e.g. "SMI"
  UNIQUE KEY uq_teachers_short_name (short_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rooms
CREATE TABLE IF NOT EXISTS rooms (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(128) NOT NULL,       -- e.g. "3.12"
  description  VARCHAR(255) NULL,           -- e.g. "Physics Lab"
  building     VARCHAR(64)  NULL,           -- e.g. "Main Building"
  level        VARCHAR(64)  NULL,           -- e.g. "1", "Ground"
  address      VARCHAR(255) NULL,
  capacity     INT UNSIGNED NULL,
  features     JSON NULL,                   -- optional: equipment/features
  UNIQUE KEY uq_rooms_name (name, building, level),
  KEY          idx_rooms_building (building)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Periods (lesson slots)
CREATE TABLE IF NOT EXISTS periods (
  number       INT UNSIGNED PRIMARY KEY,    -- 1,2,3,...
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  KEY          idx_periods_times (start_time, end_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Holidays
CREATE TABLE IF NOT EXISTS holidays (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(128) NOT NULL,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  KEY          idx_holidays_range (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Timetable entries (daily schedule)
CREATE TABLE IF NOT EXISTS timetable_entries (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  day            DATE NOT NULL,
  period_number  INT UNSIGNED NOT NULL,
  class_id       BIGINT UNSIGNED NOT NULL,
  subject_id     BIGINT UNSIGNED NULL,
  teacher_id     BIGINT UNSIGNED NULL,
  room_id        BIGINT UNSIGNED NULL,

  -- Substitution details (OpenAPI substitutionInfo)
  original_teacher_id BIGINT UNSIGNED NULL,  -- Teacher originally planned
  original_room_id    BIGINT UNSIGNED NULL,  -- Room originally planned
  change_reason       VARCHAR(255) NULL,     -- Reason for change
  substitution_notes  VARCHAR(255) NULL,     -- Notes specific to substitution

  status         ENUM('scheduled','substituted','cancelled','time_change','room_change') NOT NULL DEFAULT 'scheduled',
  notes          VARCHAR(255) NULL,

  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_entries_unique (day, period_number, class_id),

  KEY idx_entries_day_class (day, class_id),
  KEY idx_entries_day_teacher (day, teacher_id),
  KEY idx_entries_day_room (day, room_id),
  KEY idx_entries_day (day),
  KEY idx_entries_original_teacher (original_teacher_id),
  KEY idx_entries_original_room (original_room_id),

  CONSTRAINT fk_entries_period
    FOREIGN KEY (period_number) REFERENCES periods(number)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_entries_class
    FOREIGN KEY (class_id) REFERENCES classes(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_entries_subject
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_entries_teacher
    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_entries_room
    FOREIGN KEY (room_id) REFERENCES rooms(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_entries_original_teacher
    FOREIGN KEY (original_teacher_id) REFERENCES teachers(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_entries_original_room
    FOREIGN KEY (original_room_id) REFERENCES rooms(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;