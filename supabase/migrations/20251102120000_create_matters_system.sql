-- Create matter_type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'matter_type') THEN
    CREATE TYPE matter_type AS ENUM ('crew_invite', 'vote', 'announcement', 'chat');
  END IF;
END $$;

-- Create matter_status enum for recipients
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'matter_recipient_status') THEN
    CREATE TYPE matter_recipient_status AS ENUM ('pending', 'sent', 'viewed', 'responded', 'declined', 'accepted');
  END IF;
END $$;

-- Create matters table
CREATE TABLE IF NOT EXISTS public.matters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  matter_type matter_type NOT NULL DEFAULT 'announcement',
  title TEXT NOT NULL,
  content TEXT,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  time_period_id UUID REFERENCES public.time_periods(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create matter_recipients table
CREATE TABLE IF NOT EXISTS public.matter_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  status matter_recipient_status NOT NULL DEFAULT 'pending',
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(matter_id, user_id)
);

-- Create matter_responses table (for votes/polls)
CREATE TABLE IF NOT EXISTS public.matter_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  response TEXT NOT NULL, -- 'approved', 'rejected', or custom response text
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(matter_id, user_id)
);

-- Create matter_messages table (for chat)
CREATE TABLE IF NOT EXISTS public.matter_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_matters_company_id ON public.matters(company_id);
CREATE INDEX IF NOT EXISTS idx_matters_created_by_user_id ON public.matters(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_matters_job_id ON public.matters(job_id);
CREATE INDEX IF NOT EXISTS idx_matters_time_period_id ON public.matters(time_period_id);
CREATE INDEX IF NOT EXISTS idx_matters_type ON public.matters(matter_type);
CREATE INDEX IF NOT EXISTS idx_matter_recipients_matter_id ON public.matter_recipients(matter_id);
CREATE INDEX IF NOT EXISTS idx_matter_recipients_user_id ON public.matter_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_matter_recipients_status ON public.matter_recipients(status);
CREATE INDEX IF NOT EXISTS idx_matter_responses_matter_id ON public.matter_responses(matter_id);
CREATE INDEX IF NOT EXISTS idx_matter_responses_user_id ON public.matter_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_matter_messages_matter_id ON public.matter_messages(matter_id);
CREATE INDEX IF NOT EXISTS idx_matter_messages_user_id ON public.matter_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_matter_messages_created_at ON public.matter_messages(created_at DESC);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_matters_updated_at
  BEFORE UPDATE ON public.matters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matter_responses_updated_at
  BEFORE UPDATE ON public.matter_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matter_messages_updated_at
  BEFORE UPDATE ON public.matter_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.matters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matter_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matter_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matter_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for matters
-- Users can see matters for their company
CREATE POLICY "Users can view matters for their company"
  ON public.matters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users
      WHERE company_users.user_id = auth.uid()
        AND company_users.company_id = matters.company_id
    )
  );

-- Users can create matters for their company
CREATE POLICY "Users can create matters for their company"
  ON public.matters FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_users
      WHERE company_users.user_id = auth.uid()
        AND company_users.company_id = matters.company_id
    )
    AND created_by_user_id = auth.uid()
  );

-- Users can update matters they created
CREATE POLICY "Users can update matters they created"
  ON public.matters FOR UPDATE
  USING (created_by_user_id = auth.uid())
  WITH CHECK (created_by_user_id = auth.uid());

-- Users can delete matters they created
CREATE POLICY "Users can delete matters they created"
  ON public.matters FOR DELETE
  USING (created_by_user_id = auth.uid());

-- RLS Policies for matter_recipients
-- Users can view recipients for matters they can see
CREATE POLICY "Users can view matter recipients"
  ON public.matter_recipients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matters
      WHERE matters.id = matter_recipients.matter_id
        AND EXISTS (
          SELECT 1 FROM public.company_users
          WHERE company_users.user_id = auth.uid()
            AND company_users.company_id = matters.company_id
        )
    )
  );

-- System can insert recipients (will be handled via service role)
CREATE POLICY "System can insert matter recipients"
  ON public.matter_recipients FOR INSERT
  WITH CHECK (true);

-- Recipients can update their own status
CREATE POLICY "Recipients can update their own status"
  ON public.matter_recipients FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for matter_responses
-- Users can view responses for matters they can see
CREATE POLICY "Users can view matter responses"
  ON public.matter_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matters
      WHERE matters.id = matter_responses.matter_id
        AND EXISTS (
          SELECT 1 FROM public.company_users
          WHERE company_users.user_id = auth.uid()
            AND company_users.company_id = matters.company_id
        )
    )
  );

-- Users can insert their own responses
CREATE POLICY "Users can insert their own responses"
  ON public.matter_responses FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own responses
CREATE POLICY "Users can update their own responses"
  ON public.matter_responses FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for matter_messages
-- Users can view messages for matters they can see
CREATE POLICY "Users can view matter messages"
  ON public.matter_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matters
      WHERE matters.id = matter_messages.matter_id
        AND EXISTS (
          SELECT 1 FROM public.company_users
          WHERE company_users.user_id = auth.uid()
            AND company_users.company_id = matters.company_id
        )
    )
  );

-- Users can insert messages for matters they can see
CREATE POLICY "Users can insert matter messages"
  ON public.matter_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.matters
      WHERE matters.id = matter_messages.matter_id
        AND EXISTS (
          SELECT 1 FROM public.company_users
          WHERE company_users.user_id = auth.uid()
            AND company_users.company_id = matters.company_id
        )
    )
  );

-- Users can update their own messages
CREATE POLICY "Users can update their own messages"
  ON public.matter_messages FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

