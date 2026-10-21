CREATE DATABASE IF NOT EXISTS habit_tracking
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE habit_tracking;

CREATE TABLE IF NOT EXISTS hobbies (
    hobbyID BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    hobby VARCHAR(255) NOT NULL,
    time_created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    time_checked TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (hobbyID)
);

CREATE TABLE IF NOT EXISTS hobby_check_history (
    checkID BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    hobbyID BIGINT UNSIGNED NOT NULL,
    hobby_name VARCHAR(255) NOT NULL,
    checked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (checkID),
    INDEX idx_hobby_check_history_checked_at (checked_at),
    INDEX idx_hobby_check_history_name_checked (hobby_name, checked_at)
);

CREATE TABLE IF NOT EXISTS memorable_moments (
    momentID BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    moment_date DATE NOT NULL DEFAULT (CURRENT_DATE),
    memorable_moment TEXT NOT NULL,
    time_created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (momentID),
    INDEX idx_memorable_moments_date_created (moment_date, time_created)
);

CREATE TABLE IF NOT EXISTS daily_scores (
    score_date DATE NOT NULL,
    sleep_start TIME NULL,
    wake_time TIME NULL,
    score DECIMAL(5,2) NOT NULL,
    time_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (score_date),
    CONSTRAINT chk_daily_scores_score_range CHECK (score > 0 AND score <= 24)
);

-- For an installation with the previous 1-to-10 daily_scores schema, run this
-- migration once. Existing daily score values and dates are preserved, but
-- rows without sleep_start and wake_time are excluded from the sleep-duration
-- graph until saved again with recorded sleep times.
-- ALTER TABLE daily_scores DROP CONSTRAINT chk_daily_scores_score_range;
-- ALTER TABLE daily_scores
--     MODIFY score DECIMAL(5,2) NOT NULL,
--     ADD COLUMN sleep_start TIME NULL AFTER score_date,
--     ADD COLUMN wake_time TIME NULL AFTER sleep_start,
--     ADD CONSTRAINT chk_daily_scores_score_range CHECK (score > 0 AND score <= 24);

-- For an existing installation, run this migration once before deploying the
-- updated API. It preserves history rows and copies the current hobby names.
-- ALTER TABLE hobby_check_history ADD COLUMN hobby_name VARCHAR(255) NULL AFTER hobbyID;
-- UPDATE hobby_check_history AS history
-- INNER JOIN hobbies AS hobby ON hobby.hobbyID = history.hobbyID
-- SET history.hobby_name = hobby.hobby
-- WHERE history.hobby_name IS NULL;
-- ALTER TABLE hobby_check_history
--     MODIFY hobby_name VARCHAR(255) NOT NULL,
--     DROP FOREIGN KEY fk_hobby_check_history_hobby,
--     DROP INDEX idx_hobby_check_history_hobby_checked,
--     ADD INDEX idx_hobby_check_history_name_checked (hobby_name, checked_at);
