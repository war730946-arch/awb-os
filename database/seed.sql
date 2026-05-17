-- Seed data for demo
-- Run after schema.sql

-- Insert a demo admin user (password: admin123)
INSERT INTO users (email, password_hash, full_name)
VALUES ('admin@awb-os.com', '$2a$10$dummyhashfordemopurposes1234567890abcdef', 'Admin User')
ON CONFLICT (email) DO NOTHING;

-- Insert sample business
INSERT INTO businesses (user_id, name, type, description, location, working_hours, services, faqs)
SELECT 
  id,
  'Green Leaf Clinic',
  'clinic',
  'A multi-specialty clinic offering general medicine, dental, and eye care services.',
  'Mumbai, India',
  '9:00 AM - 8:00 PM',
  '[
    {"name": "General Checkup", "price": 30, "description": "Full body checkup"},
    {"name": "Dental Cleaning", "price": 25, "description": "Professional teeth cleaning"},
    {"name": "Eye Exam", "price": 20, "description": "Complete eye examination"}
  ]',
  '[
    {"question": "What are your working hours?", "answer": "We are open 9 AM to 8 PM, Monday to Saturday."},
    {"question": "Do you accept insurance?", "answer": "Yes, we accept all major insurance providers."},
    {"question": "How do I book an appointment?", "answer": "Just send us a message with your preferred date and time!"}
  ]'
FROM users WHERE email = 'admin@awb-os.com'
ON CONFLICT DO NOTHING;
