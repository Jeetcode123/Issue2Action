-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. users table
-- ==========================================
CREATE TYPE user_role AS ENUM ('citizen', 'authority', 'admin');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    phone VARCHAR,
    ward VARCHAR,
    city VARCHAR DEFAULT 'Kolkata',
    role user_role DEFAULT 'citizen',
    civic_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 2. issues table
-- ==========================================
CREATE TYPE issue_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE issue_status AS ENUM ('reported', 'verified', 'assigned', 'in_progress', 'resolved', 'closed');

CREATE TABLE issues (
    id VARCHAR PRIMARY KEY, -- format: I2A-YYYY-XXXX
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    type VARCHAR, -- AI classified
    priority issue_priority,
    department VARCHAR, -- AI assigned
    status issue_status DEFAULT 'reported',
    location_text VARCHAR,
    latitude DECIMAL,
    longitude DECIMAL,
    ward VARCHAR,
    upvotes INTEGER DEFAULT 0,
    ai_summary TEXT,
    ai_confidence INTEGER,
    estimated_resolution VARCHAR,
    image_urls JSONB,
    is_duplicate BOOLEAN DEFAULT false,
    parent_issue_id VARCHAR REFERENCES issues(id) ON DELETE SET NULL,
    master_issue_id VARCHAR REFERENCES issues(id) ON DELETE SET NULL,
    total_reports INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 3. timeline_events table
-- ==========================================
CREATE TYPE timeline_event_type AS ENUM ('created', 'verified', 'assigned', 'updated', 'resolved');

CREATE TABLE timeline_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id VARCHAR REFERENCES issues(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    event_type timeline_event_type,
    created_by VARCHAR, -- 'system', 'authority', or user name
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 4. upvotes table
-- ==========================================
CREATE TABLE upvotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id VARCHAR REFERENCES issues(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (issue_id, user_id)
);

-- ==========================================
-- Indexes
-- ==========================================
-- Indexes for issues table (most queried fields)
CREATE INDEX idx_issues_user_id ON issues(user_id);
CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_ward ON issues(ward);
CREATE INDEX idx_issues_location ON issues(latitude, longitude);
CREATE INDEX idx_issues_created_at ON issues(created_at);

-- Additional useful indexes for foreign keys and creation dates
CREATE INDEX idx_timeline_events_issue_id ON timeline_events(issue_id);
CREATE INDEX idx_upvotes_issue_id ON upvotes(issue_id);
CREATE INDEX idx_upvotes_user_id ON upvotes(user_id);
