-- Permite que cada usuário exclua (ocultar) suas próprias notificações da Diretoria
-- sem apagar o comunicado original, que continua visível para os demais destinatários.
CREATE TABLE IF NOT EXISTS public.director_notification_dismissals (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('message', 'alert')),
  item_id uuid NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS director_notification_dismissals_user_idx
  ON public.director_notification_dismissals (user_id, item_type);

ALTER TABLE public.director_notification_dismissals ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.director_notification_dismissals TO authenticated;

CREATE POLICY "Users manage their own notification dismissals"
  ON public.director_notification_dismissals
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
