-- AWB-OS Database Schema (Supabase PostgreSQL)
-- Multi-tenant WhatsApp AI SaaS Platform

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE (Admin accounts)
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================
-- BUSINESSES TABLE (Multi-tenant)
-- ============================================
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL DEFAULT 'general',
  phone_number VARCHAR(50) UNIQUE,
  whatsapp_connected BOOLEAN DEFAULT FALSE,
  whatsapp_qr TEXT DEFAULT '',
  description TEXT DEFAULT '',
  location TEXT DEFAULT '',
  working_hours TEXT DEFAULT '9:00 AM - 6:00 PM',
  services JSONB DEFAULT '[]',
  faqs JSONB DEFAULT '[]',
  ai_active BOOLEAN DEFAULT TRUE,
  settings_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- ============================================
-- AI SETTINGS TABLE (Personality & Rules)
-- ============================================
CREATE TABLE ai_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID UNIQUE NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  personality TEXT DEFAULT 'professional',
  tone TEXT DEFAULT 'polite',
  language VARCHAR(50) DEFAULT 'auto',
  custom_rules TEXT DEFAULT '',
  greeting_message TEXT DEFAULT 'Hello! How can I help you today?',
  response_length VARCHAR(20) DEFAULT 'short',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CUSTOMERS TABLE
-- ============================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  phone VARCHAR(50) NOT NULL,
  name VARCHAR(255) DEFAULT '',
  total_chats INT DEFAULT 0,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, phone)
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- ============================================
-- MESSAGES TABLE (Chat History)
-- ============================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  user_number VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  response TEXT NOT NULL DEFAULT '',
  intent VARCHAR(50) DEFAULT 'inquiry',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_business_id ON messages(business_id);
CREATE INDEX idx_messages_user_number ON messages(user_number);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID UNIQUE NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plan VARCHAR(50) DEFAULT 'trial',
  status VARCHAR(50) DEFAULT 'trial',
  trial_start_date TIMESTAMPTZ DEFAULT NOW(),
  trial_end_date TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  current_period_start TIMESTAMPTZ DEFAULT NOW(),
  current_period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  stripe_customer_id VARCHAR(255) DEFAULT '',
  stripe_subscription_id VARCHAR(255) DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- LEADS TABLE
-- ============================================
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  phone VARCHAR(50) NOT NULL,
  name VARCHAR(255) DEFAULT '',
  interest VARCHAR(255) DEFAULT '',
  status VARCHAR(50) DEFAULT 'new',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Users can only see their own data
CREATE POLICY user_isolation ON users
  USING (id = auth.uid());

-- Businesses belong to users
CREATE POLICY business_owner ON businesses
  USING (user_id = auth.uid());

-- AI settings belong to user's businesses
CREATE POLICY ai_settings_owner ON ai_settings
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

-- Customers belong to user's businesses
CREATE POLICY customer_owner ON customers
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

-- Messages belong to user's businesses
CREATE POLICY message_owner ON messages
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

-- Subscriptions belong to user's businesses
CREATE POLICY subscription_owner ON subscriptions
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

-- Leads belong to user's businesses
CREATE POLICY lead_owner ON leads
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

-- ============================================
-- TRIGGERS (auto-update updated_at)
-- ============================================
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_users BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_businesses BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_ai_settings BEFORE UPDATE ON ai_settings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_subscriptions BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
