
CREATE TABLE public.app_settings (
  user_id uuid PRIMARY KEY,
  evolution_url text,
  evolution_api_key text,
  webhook_token text NOT NULL DEFAULT replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''),
  autopilot boolean NOT NULL DEFAULT false,
  delay_min int NOT NULL DEFAULT 45,
  delay_max int NOT NULL DEFAULT 90,
  night_pause boolean NOT NULL DEFAULT true,
  store_whatsapp text,
  message_template text NOT NULL DEFAULT E'📱 *{modelo}* {capacidade}\n🎨 Cor: {cor}\n🔋 Bateria: {bateria}\n✨ Estado: {condicao}\n{avisos}\n💰 *PIX: {preco_pix}*\n💳 Cartão 12x: {preco_cartao}\n\n👉 Reserve: {link_whatsapp}',
  card_rates jsonb NOT NULL DEFAULT '{"1":3.2,"2":4.5,"3":5.2,"4":5.9,"5":6.6,"6":7.3,"7":8.0,"8":8.6,"9":9.2,"10":9.8,"11":10.4,"12":11.0,"13":11.6,"14":12.2,"15":12.8,"16":13.4,"17":14.0,"18":14.6}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings select" ON public.app_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own settings insert" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own settings update" ON public.app_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('LISTENER','SENDER')),
  instance_name text NOT NULL UNIQUE,
  session_status text NOT NULL DEFAULT 'DISCONNECTED',
  phone_number text,
  profile_name text,
  profile_pic_url text,
  qr_code_base64 text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_instances TO authenticated;
GRANT ALL ON public.whatsapp_instances TO service_role;
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own instances" ON public.whatsapp_instances FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.whatsapp_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  instance_id uuid NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  group_jid text NOT NULL,
  name text NOT NULL,
  group_type text NOT NULL CHECK (group_type IN ('SOURCE','TARGET')),
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, group_jid)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_groups TO authenticated;
GRANT ALL ON public.whatsapp_groups TO service_role;
ALTER TABLE public.whatsapp_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own groups" ON public.whatsapp_groups FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.margin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category_name text NOT NULL CHECK (category_name IN ('IPHONE_11_12','IPHONE_13_15','PRO_SERIES','SEALED')),
  fixed_margin numeric(10,2) NOT NULL DEFAULT 0,
  round_to_90 boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (user_id, category_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.margin_settings TO authenticated;
GRANT ALL ON public.margin_settings TO service_role;
ALTER TABLE public.margin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own margins" ON public.margin_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.devices_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_group_jid text NOT NULL,
  source_group_name text,
  supplier_message_id text NOT NULL,
  supplier_sender_jid text NOT NULL,
  supplier_name text,
  raw_text text,
  model text NOT NULL,
  storage text NOT NULL,
  color text,
  battery_health int,
  condition_grade text,
  is_sealed boolean NOT NULL DEFAULT false,
  technical_alerts text[] NOT NULL DEFAULT '{}',
  media_urls text[] NOT NULL DEFAULT '{}',
  supplier_cost numeric(10,2) NOT NULL,
  margin_applied numeric(10,2) NOT NULL,
  final_price_pix numeric(10,2) NOT NULL,
  final_price_card_12x numeric(10,2),
  status text NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('PENDING_APPROVAL','AVAILABLE','RESERVED','SOLD','DISCARDED')),
  sold_detected_at timestamptz,
  sold_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, supplier_message_id)
);
CREATE INDEX devices_user_created_idx ON public.devices_catalog(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devices_catalog TO authenticated;
GRANT ALL ON public.devices_catalog TO service_role;
ALTER TABLE public.devices_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own devices" ON public.devices_catalog FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.dispatched_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id uuid NOT NULL REFERENCES public.devices_catalog(id) ON DELETE CASCADE,
  target_group_jid text NOT NULL,
  target_group_name text,
  sent_message_id text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','MARK_SOLD_REPLIED','DELETED')),
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX posts_device_idx ON public.dispatched_posts(device_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispatched_posts TO authenticated;
GRANT ALL ON public.dispatched_posts TO service_role;
ALTER TABLE public.dispatched_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own posts" ON public.dispatched_posts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.dispatch_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id uuid NOT NULL REFERENCES public.devices_catalog(id) ON DELETE CASCADE,
  target_group_jid text NOT NULL,
  target_group_name text,
  payload_caption text NOT NULL,
  media_url text,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','SENT','FAILED','CANCELLED')),
  error_message text,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX queue_due_idx ON public.dispatch_queue(status, scheduled_for);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispatch_queue TO authenticated;
GRANT ALL ON public.dispatch_queue TO service_role;
ALTER TABLE public.dispatch_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own queue" ON public.dispatch_queue FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id uuid REFERENCES public.devices_catalog(id) ON DELETE SET NULL,
  customer_name text,
  customer_phone text,
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','RESERVED','PAID','CANCELLED')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own leads" ON public.leads FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id uuid REFERENCES public.devices_catalog(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  description text NOT NULL,
  sale_price numeric(10,2) NOT NULL,
  cost numeric(10,2) NOT NULL,
  profit numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sales" ON public.sales FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user_setup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.app_settings(user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.margin_settings(user_id, category_name, fixed_margin) VALUES
    (NEW.id,'IPHONE_11_12',200),(NEW.id,'IPHONE_13_15',300),(NEW.id,'PRO_SERIES',450),(NEW.id,'SEALED',200)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created_setup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_setup();

ALTER PUBLICATION supabase_realtime ADD TABLE public.devices_catalog;
