-- Sau khi merge origin/develop: 20261029000000_business_rule_hardening đã tạo
-- "class_one_primary_coach" và "feedback_one_generic_member_coach". Hai index cùng chức năng
-- do 20261029120000 / 20261029130000 tạo lại là thừa ⇒ gỡ. IF EXISTS để chạy an toàn trên mọi DB.
DROP INDEX IF EXISTS "ClassMember_one_primary_per_class";
DROP INDEX IF EXISTS "CoachFeedback_general_unique";
