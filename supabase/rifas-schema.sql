-- ═══════════════════════════════════════════════════════════════════════════════
-- SISTEMA DE GESTIÓN DE RIFAS
-- Ejecuta este script en Supabase > SQL Editor > New Query
-- ═══════════════════════════════════════════════════════════════════════════════

-- 0. PERFILES DE USUARIO — extiende auth.users con nombre y rol
-- ─────────────────────────────────────────────────────────────
-- auth.users es gestionada automáticamente por Supabase Auth.
-- Esta tabla solo agrega los campos extra que la app necesita.
CREATE TABLE IF NOT EXISTS perfiles (
  id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL DEFAULT '',
  rol    text NOT NULL DEFAULT 'viewer'
               CHECK (rol IN ('admin', 'viewer'))
);

-- Crea automáticamente un perfil "viewer" al registrar un nuevo usuario
-- (descomenta cuando quieras activar el auto-registro de perfiles)
-- CREATE OR REPLACE FUNCTION fn_crear_perfil()
-- RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
-- BEGIN
--   INSERT INTO public.perfiles (id, nombre, rol)
--   VALUES (
--     NEW.id,
--     COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
--     'viewer'
--   )
--   ON CONFLICT (id) DO NOTHING;
--   RETURN NEW;
-- END;
-- $$;
--
-- DROP TRIGGER IF EXISTS trg_crear_perfil ON auth.users;
-- CREATE TRIGGER trg_crear_perfil
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION fn_crear_perfil();

-- RLS: cada usuario solo puede leer y actualizar su propio perfil
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perfiles_select_own" ON perfiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "perfiles_update_own" ON perfiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────

-- 1. CAMPAÑAS — agrupa varios sorteos bajo un mismo paraguas
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campanas (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text        NOT NULL,
  descripcion text,
  activa      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. RIFAS — sorteo específico dentro de una campaña
-- ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rifas (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  campana_id       uuid          NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
  nombre_premio    text          NOT NULL,
  descripcion      text,
  precio_boleto    numeric(10,2) NOT NULL DEFAULT 0,
  cantidad_boletos int           NOT NULL DEFAULT 100,
  fecha_sorteo     date,
  estatus          text          NOT NULL DEFAULT 'Activa'
                                 CHECK (estatus IN ('Activa','Finalizada','Cancelada')),
  horas_expiracion int           NOT NULL DEFAULT 24,
  ganadores        jsonb         NOT NULL DEFAULT '[]'::jsonb,
  created_at       timestamptz   NOT NULL DEFAULT now()
);

-- 3. GRUPOS SOCIALES — categorías libres para clasificar participantes
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grupos (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text        NOT NULL UNIQUE,
  color      text        NOT NULL DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. PARTICIPANTES — perfil del comprador (uno por número de teléfono)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS participantes (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_completo   text        NOT NULL,
  telefono_whatsapp text,
  email             text,
  grupo_id          uuid        REFERENCES grupos(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- 4. BOLETOS — entradas individuales, pre-generadas al crear la rifa
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS boletos (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rifa_id              uuid        NOT NULL REFERENCES rifas(id) ON DELETE CASCADE,
  participante_id      uuid        REFERENCES participantes(id) ON DELETE SET NULL,
  nombre_participante  text,                     -- Desnormalizado: persiste aunque se elimine el participante
  numero_asignado      int         NOT NULL,
  estatus              text        NOT NULL DEFAULT 'Disponible'
                                   CHECK (estatus IN ('Disponible','Apartado','Liquidado','Vencido')),
  fecha_apartado       timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rifa_id, numero_asignado)
);

-- 5. HISTORIAL DE PAGOS POR BOLETO
-- ─────────────────────────────────
CREATE TABLE IF NOT EXISTS historial_pagos_rifa (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  boleto_id       uuid          NOT NULL REFERENCES boletos(id) ON DELETE CASCADE,
  monto           numeric(10,2) NOT NULL,
  fecha           date          NOT NULL DEFAULT current_date,
  metodo_pago     text          NOT NULL DEFAULT 'Efectivo',
  comprobante_url text,
  created_at      timestamptz   NOT NULL DEFAULT now()
);

-- ── ÍNDICES DE RENDIMIENTO ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_boletos_rifa     ON boletos(rifa_id);
CREATE INDEX IF NOT EXISTS idx_boletos_part     ON boletos(participante_id);
CREATE INDEX IF NOT EXISTS idx_boletos_estatus  ON boletos(estatus);
CREATE INDEX IF NOT EXISTS idx_rifas_campana    ON rifas(campana_id);
CREATE INDEX IF NOT EXISTS idx_pagos_boleto     ON historial_pagos_rifa(boleto_id);
CREATE INDEX IF NOT EXISTS idx_participantes_grupo ON participantes(grupo_id);

-- ── VISTA: saldo calculado por boleto ───────────────────────────────────────
CREATE OR REPLACE VIEW vista_saldo_boletos AS
SELECT
  b.id,
  b.rifa_id,
  b.participante_id,
  b.numero_asignado,
  b.estatus,
  b.fecha_apartado,
  COALESCE(b.nombre_participante, p.nombre_completo) AS nombre_completo,
  p.telefono_whatsapp,
  p.email,
  p.grupo_id,
  g.nombre  AS grupo_nombre,
  g.color   AS grupo_color,
  r.precio_boleto,
  r.nombre_premio,
  r.campana_id,
  r.fecha_sorteo,
  r.cantidad_boletos,
  COALESCE(SUM(hp.monto), 0)                    AS total_pagado,
  r.precio_boleto - COALESCE(SUM(hp.monto), 0)  AS saldo_pendiente
FROM      boletos               b
JOIN      rifas                 r  ON r.id  = b.rifa_id
LEFT JOIN participantes         p  ON p.id  = b.participante_id
LEFT JOIN grupos                g  ON g.id  = p.grupo_id
LEFT JOIN historial_pagos_rifa  hp ON hp.boleto_id = b.id
GROUP BY
  b.id, b.rifa_id, b.participante_id, b.numero_asignado,
  b.estatus, b.fecha_apartado, b.nombre_participante,
  p.nombre_completo, p.telefono_whatsapp, p.email, p.grupo_id,
  g.nombre, g.color,
  r.precio_boleto, r.nombre_premio, r.campana_id, r.fecha_sorteo, r.cantidad_boletos;

-- ── BITÁCORA DE MOVIMIENTOS DE BOLETOS ──────────────────────────────────────
-- Registra cada cambio de estatus en un boleto (trigger automático).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bitacora_boletos (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  boleto_id           uuid        NOT NULL REFERENCES boletos(id)   ON DELETE CASCADE,
  rifa_id             uuid        NOT NULL  REFERENCES rifas(id)    ON DELETE CASCADE,
  campana_id          uuid        NOT NULL  REFERENCES campanas(id) ON DELETE CASCADE,
  numero_asignado     int         NOT NULL,
  estatus_anterior    text,                       -- NULL en la primera asignación
  estatus_nuevo       text        NOT NULL,
  nombre_participante text,                       -- snapshot del momento
  participante_id     uuid        REFERENCES participantes(id) ON DELETE SET NULL,
  grupo_id            uuid        REFERENCES grupos(id) ON DELETE SET NULL,
  tipo_movimiento     text        NOT NULL DEFAULT 'estatus',  -- 'estatus' | 'reasignacion'
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bitacora_boleto    ON bitacora_boletos(boleto_id);
CREATE INDEX IF NOT EXISTS idx_bitacora_rifa      ON bitacora_boletos(rifa_id);
CREATE INDEX IF NOT EXISTS idx_bitacora_campana   ON bitacora_boletos(campana_id);
CREATE INDEX IF NOT EXISTS idx_bitacora_estatus   ON bitacora_boletos(estatus_nuevo);
CREATE INDEX IF NOT EXISTS idx_bitacora_created   ON bitacora_boletos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_grupo     ON bitacora_boletos(grupo_id);

-- Función de trigger: se ejecuta en cada UPDATE de estatus en boletos
CREATE OR REPLACE FUNCTION fn_bitacora_boletos()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_campana_id uuid;
  v_tipo       text;
BEGIN
  -- Solo registrar si cambia el estatus, o si cambia el participante asignado
  IF (TG_OP = 'INSERT' AND NEW.participante_id IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND OLD.estatus IS DISTINCT FROM NEW.estatus)
     OR (TG_OP = 'UPDATE' AND OLD.participante_id IS DISTINCT FROM NEW.participante_id
         AND NEW.participante_id IS NOT NULL) THEN

    -- Determinar tipo de movimiento
    IF TG_OP = 'UPDATE'
       AND OLD.participante_id IS DISTINCT FROM NEW.participante_id
       AND OLD.estatus = NEW.estatus THEN
      v_tipo := 'reasignacion';
    ELSE
      v_tipo := 'estatus';
    END IF;

    -- Obtener campana_id desde rifas
    SELECT campana_id INTO v_campana_id FROM rifas WHERE id = NEW.rifa_id;

    INSERT INTO bitacora_boletos (
      boleto_id, rifa_id, campana_id, numero_asignado,
      estatus_anterior, estatus_nuevo,
      nombre_participante, participante_id, grupo_id,
      tipo_movimiento
    )
    SELECT
      NEW.id,
      NEW.rifa_id,
      v_campana_id,
      NEW.numero_asignado,
      -- Para reasignaciones el estatus no cambió; guardamos NULL en estatus_anterior
      CASE WHEN v_tipo = 'estatus' AND TG_OP = 'UPDATE' THEN OLD.estatus ELSE NULL END,
      NEW.estatus,
      COALESCE(NEW.nombre_participante, p.nombre_completo),
      NEW.participante_id,
      p.grupo_id,
      v_tipo
    FROM (SELECT NULL::uuid AS grupo_id, NULL::text AS nombre_completo) AS _default
    LEFT JOIN participantes p ON p.id = NEW.participante_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger sobre la tabla boletos
DROP TRIGGER IF EXISTS trg_bitacora_boletos ON boletos;
CREATE TRIGGER trg_bitacora_boletos
  AFTER INSERT OR UPDATE ON boletos
  FOR EACH ROW EXECUTE FUNCTION fn_bitacora_boletos();

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE campanas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE rifas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE grupos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE participantes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE boletos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_pagos_rifa ENABLE ROW LEVEL SECURITY;
ALTER TABLE bitacora_boletos     ENABLE ROW LEVEL SECURITY;

-- Usuarios autenticados: acceso total
CREATE POLICY "rifas_auth_all" ON campanas             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "rifas_auth_all" ON rifas                FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "rifas_auth_all" ON grupos               FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "rifas_auth_all" ON participantes        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "rifas_auth_all" ON boletos              FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "rifas_auth_all" ON historial_pagos_rifa FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "rifas_auth_all" ON bitacora_boletos     FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Usuarios anónimos: solo lectura (para la página pública /mis-boletos)
CREATE POLICY "rifas_anon_read" ON grupos               FOR SELECT TO anon USING (true);
CREATE POLICY "rifas_anon_read" ON participantes        FOR SELECT TO anon USING (true);
CREATE POLICY "rifas_anon_read" ON boletos              FOR SELECT TO anon USING (true);
CREATE POLICY "rifas_anon_read" ON rifas                FOR SELECT TO anon USING (true);
CREATE POLICY "rifas_anon_read" ON historial_pagos_rifa FOR SELECT TO anon USING (true);
