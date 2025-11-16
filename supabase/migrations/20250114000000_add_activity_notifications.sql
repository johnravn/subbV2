-- Migration: Add notifications to matters inbox when someone likes or comments on a latest update
-- This creates matters with links to the activity when the creator receives likes/comments

-- Add metadata column to matters table if it doesn't exist
ALTER TABLE matters
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Function to create a matter notification for activity likes/comments
CREATE OR REPLACE FUNCTION notify_activity_creator()
RETURNS TRIGGER AS $$
DECLARE
  activity_creator_id UUID;
  activity_company_id UUID;
  activity_title TEXT;
  activity_metadata JSONB;
  actor_user_id UUID;
  notification_type TEXT;
  matter_title TEXT;
  matter_content TEXT;
  new_matter_id UUID;
  actor_display_name TEXT;
BEGIN
  -- Determine the actor (person who liked/commented) and notification type
  IF TG_TABLE_NAME = 'activity_likes' THEN
    actor_user_id := NEW.user_id;
    notification_type := 'like';
  ELSIF TG_TABLE_NAME = 'activity_comments' THEN
    actor_user_id := NEW.created_by_user_id;
    notification_type := 'comment';
  ELSE
    RETURN NEW;
  END IF;

  -- Get activity details
  SELECT 
    created_by_user_id,
    company_id,
    title,
    metadata
  INTO 
    activity_creator_id,
    activity_company_id,
    activity_title,
    activity_metadata
  FROM activity_log
  WHERE id = NEW.activity_id
    AND deleted = false;

  -- If activity not found or creator is the same as actor, don't create notification
  IF activity_creator_id IS NULL OR activity_creator_id = actor_user_id THEN
    RETURN NEW;
  END IF;

  -- Get actor's display name for the notification
  SELECT display_name INTO actor_display_name
  FROM profiles
  WHERE user_id = actor_user_id;
  
  -- Build notification title and content
  IF notification_type = 'like' THEN
    matter_title := COALESCE(actor_display_name, 'Someone') || ' liked your update';
    matter_content := 'Your latest update "' || COALESCE(activity_title, 'Untitled') || '" received a like.';
  ELSE -- comment
    matter_title := COALESCE(actor_display_name, 'Someone') || ' commented on your update';
    matter_content := 'Your latest update "' || COALESCE(activity_title, 'Untitled') || '" received a comment.';
  END IF;

  -- Create the matter
  INSERT INTO matters (
    company_id,
    created_by_user_id,
    matter_type,
    title,
    content,
    metadata
  ) VALUES (
    activity_company_id,
    actor_user_id, -- The person who liked/commented is the "creator" of the notification
    'chat',
    matter_title,
    matter_content,
    jsonb_build_object(
      'activity_id', NEW.activity_id,
      'notification_type', notification_type,
      'activity_title', activity_title
    )
  )
  RETURNING id INTO new_matter_id;

  -- Create matter recipient for the activity creator
  INSERT INTO matter_recipients (
    matter_id,
    user_id,
    status
  ) VALUES (
    new_matter_id,
    activity_creator_id,
    'pending'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for activity likes
DROP TRIGGER IF EXISTS trigger_notify_on_activity_like ON activity_likes;
CREATE TRIGGER trigger_notify_on_activity_like
  AFTER INSERT ON activity_likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_activity_creator();

-- Trigger for activity comments
DROP TRIGGER IF EXISTS trigger_notify_on_activity_comment ON activity_comments;
CREATE TRIGGER trigger_notify_on_activity_comment
  AFTER INSERT ON activity_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_activity_creator();

