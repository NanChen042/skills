-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS ai_skills;
USE ai_skills;

-- Create skills_log table
CREATE TABLE IF NOT EXISTS skills_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_prompt TEXT NOT NULL,
    ai_response TEXT,
    tool_calls JSON,
    tool_results JSON,
    total_tokens INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ensure root user has access (already done manually but good for completeness)
CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY 'a123456b';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;
