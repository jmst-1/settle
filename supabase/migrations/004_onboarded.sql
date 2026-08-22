alter table user_profiles
  add column if not exists onboarded_at timestamptz;
