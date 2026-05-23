-- ═══════════════════════════════════════════════════════════════════════════════
-- MÓDULO: TIENDITA GESTION — Inventario y Ventas Locales
-- Ejecuta este script DESPUÉS de rifas-schema.sql en Supabase > SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 0. EXTENDER PARTICIPANTES ────────────────────────────────────────────────
-- Los participantes de rifas y los clientes de la tiendita son la misma entidad.
-- Solo se añaden dos columnas opcionales; el código existente no se ve afectado.
ALTER TABLE participantes ADD COLUMN IF NOT EXISTS direccion text;
ALTER TABLE participantes ADD COLUMN IF NOT EXISTS notas     text;

-- ── 1. CATEGORÍAS DE PRODUCTO ────────────────────────────────────────────────
-- Equivalente a "grupos" del módulo de rifas: etiquetas de color para clasificar.
CREATE TABLE IF NOT EXISTS categorias_producto (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text        NOT NULL UNIQUE,
  color      text        NOT NULL DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 2. PRODUCTOS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS productos (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre              text          NOT NULL,
  descripcion         text,
  precio_costo        numeric(10,2),               -- referencia; puede venir calculado de un pedido
  precio_venta        numeric(10,2) NOT NULL DEFAULT 0,
  categoria_id        uuid          REFERENCES categorias_producto(id) ON DELETE SET NULL,
  url_compra_original text,
  notas               text,
  activo              boolean       NOT NULL DEFAULT true,
  created_at          timestamptz   NOT NULL DEFAULT now()
);

-- ── 3. PEDIDOS DE COMPRA ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pedidos_compra (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor       text,
  plataforma      text          NOT NULL DEFAULT 'Otro'
                                CHECK (plataforma IN (
                                  'Aliexpress','Amazon','Temu',
                                  'Mercado Libre','Shein','Otro'
                                )),
  fecha_compra    date          NOT NULL DEFAULT current_date,
  numero_guia     text,                            -- rastreo manual
  url_seguimiento text,                            -- link al carrier
  estado          text          NOT NULL DEFAULT 'en_transito'
                                CHECK (estado IN ('en_transito','recibido')),
  monto_total     numeric(10,2) NOT NULL DEFAULT 0,
  monto_envio     numeric(10,2) NOT NULL DEFAULT 0,
  notas           text,
  fecha_recibido  date,
  created_at      timestamptz   NOT NULL DEFAULT now()
);

-- ── 4. PEDIDO ITEMS ──────────────────────────────────────────────────────────
-- Líneas de productos dentro de un pedido.
-- El costo_real = costo_unitario_base + costo_envio_prorrateado (calculado en JS).
CREATE TABLE IF NOT EXISTS pedido_items (
  id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id               uuid          NOT NULL REFERENCES pedidos_compra(id) ON DELETE CASCADE,
  producto_id             uuid          NOT NULL REFERENCES productos(id)       ON DELETE RESTRICT,
  cantidad                int           NOT NULL CHECK (cantidad > 0),
  costo_unitario_base     numeric(10,2) NOT NULL DEFAULT 0,
  costo_envio_prorrateado numeric(10,2) NOT NULL DEFAULT 0,
  costo_real              numeric(10,2) NOT NULL DEFAULT 0,  -- persiste el cálculo al momento del registro
  created_at              timestamptz   NOT NULL DEFAULT now()
);

-- ── 5. VENTAS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ventas (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id  uuid          REFERENCES participantes(id) ON DELETE SET NULL,
  nombre_cliente   text,                           -- desnormalizado: persiste si se elimina el participante
  tipo             text          NOT NULL DEFAULT 'directa'
                                 CHECK (tipo IN ('directa','apartado')),
  precio_total     numeric(10,2) NOT NULL DEFAULT 0,
  anticipo_pagado  numeric(10,2) NOT NULL DEFAULT 0,
  metodo_pago      text          NOT NULL DEFAULT 'Efectivo',
  estado_entrega   text          NOT NULL DEFAULT 'pendiente'
                                 CHECK (estado_entrega IN ('pendiente','entregado')),
  notas            text,
  fecha_venta      date          NOT NULL DEFAULT current_date,
  created_at       timestamptz   NOT NULL DEFAULT now()
);

-- ── 6. VENTA ITEMS ───────────────────────────────────────────────────────────
-- Líneas del carrito: N productos distintos por venta.
-- precio_unitario_acordado puede diferir del precio_venta del producto al momento.
CREATE TABLE IF NOT EXISTS venta_items (
  id                       uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id                 uuid          NOT NULL REFERENCES ventas(id)    ON DELETE CASCADE,
  producto_id              uuid          NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad                 int           NOT NULL CHECK (cantidad > 0),
  precio_unitario_acordado numeric(10,2) NOT NULL DEFAULT 0,
  created_at               timestamptz   NOT NULL DEFAULT now()
);

-- ── 7. HISTORIAL DE ABONOS POR VENTA ────────────────────────────────────────
-- Pagos parciales sobre apartados. El saldo se recalcula en runtime.
CREATE TABLE IF NOT EXISTS historial_abonos_venta (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id    uuid          NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  monto       numeric(10,2) NOT NULL CHECK (monto > 0),
  fecha       date          NOT NULL DEFAULT current_date,
  metodo_pago text          NOT NULL DEFAULT 'Efectivo',
  notas       text,
  created_at  timestamptz   NOT NULL DEFAULT now()
);

-- ── 8. AJUSTES DE STOCK ──────────────────────────────────────────────────────
-- Movimientos manuales de inventario (mermas, regalos, devoluciones, correcciones).
-- cantidad positiva = entrada, negativa = salida.
CREATE TABLE IF NOT EXISTS ajustes_stock (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid        NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  cantidad    int         NOT NULL,
  motivo      text        NOT NULL DEFAULT 'correccion'
                          CHECK (motivo IN (
                            'merma','regalo','perdida',
                            'devolucion','correccion','otro'
                          )),
  notas       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── ÍNDICES DE RENDIMIENTO ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_productos_categoria     ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_productos_activo        ON productos(activo);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado          ON pedidos_compra(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha           ON pedidos_compra(fecha_compra DESC);
CREATE INDEX IF NOT EXISTS idx_pedido_items_pedido     ON pedido_items(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedido_items_producto   ON pedido_items(producto_id);
CREATE INDEX IF NOT EXISTS idx_ventas_participante     ON ventas(participante_id);
CREATE INDEX IF NOT EXISTS idx_ventas_tipo             ON ventas(tipo);
CREATE INDEX IF NOT EXISTS idx_ventas_estado_entrega   ON ventas(estado_entrega);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha            ON ventas(fecha_venta DESC);
CREATE INDEX IF NOT EXISTS idx_venta_items_venta       ON venta_items(venta_id);
CREATE INDEX IF NOT EXISTS idx_venta_items_producto    ON venta_items(producto_id);
CREATE INDEX IF NOT EXISTS idx_abonos_venta            ON historial_abonos_venta(venta_id);
CREATE INDEX IF NOT EXISTS idx_ajustes_producto        ON ajustes_stock(producto_id);
CREATE INDEX IF NOT EXISTS idx_ajustes_created         ON ajustes_stock(created_at DESC);

-- ── VISTA: stock calculado por producto ─────────────────────────────────────
-- Stock = unidades recibidas en pedidos - unidades vendidas + ajustes manuales
CREATE OR REPLACE VIEW vista_stock_productos AS
SELECT
  p.id,
  p.nombre,
  p.descripcion,
  p.precio_costo,
  p.precio_venta,
  p.categoria_id,
  c.nombre AS categoria_nombre,
  c.color  AS categoria_color,
  p.url_compra_original,
  p.notas,
  p.activo,
  p.created_at,
  COALESCE(compras.total_comprado,  0)  AS total_comprado,
  COALESCE(vendido.total_vendido,   0)  AS total_vendido,
  COALESCE(ajustes.total_ajustado,  0)  AS total_ajustado,
  COALESCE(compras.total_comprado,  0)
    - COALESCE(vendido.total_vendido,  0)
    + COALESCE(ajustes.total_ajustado, 0) AS stock_actual
FROM productos p
LEFT JOIN categorias_producto c ON c.id = p.categoria_id
LEFT JOIN (
  SELECT pi.producto_id, SUM(pi.cantidad) AS total_comprado
  FROM   pedido_items pi
  JOIN   pedidos_compra pc ON pc.id = pi.pedido_id AND pc.estado = 'recibido'
  GROUP  BY pi.producto_id
) compras ON compras.producto_id = p.id
LEFT JOIN (
  SELECT vi.producto_id, SUM(vi.cantidad) AS total_vendido
  FROM   venta_items vi
  GROUP  BY vi.producto_id
) vendido ON vendido.producto_id = p.id
LEFT JOIN (
  SELECT aj.producto_id, SUM(aj.cantidad) AS total_ajustado
  FROM   ajustes_stock aj
  GROUP  BY aj.producto_id
) ajustes ON ajustes.producto_id = p.id;

-- ── VISTA: ventas completas con cliente y saldo ──────────────────────────────
CREATE OR REPLACE VIEW vista_ventas_completa AS
SELECT
  v.id,
  v.tipo,
  v.precio_total,
  v.anticipo_pagado,
  v.precio_total
    - v.anticipo_pagado
    - COALESCE(abonos.total_abonado, 0) AS saldo_pendiente,
  v.metodo_pago,
  v.estado_entrega,
  v.notas,
  v.fecha_venta,
  v.created_at,
  v.participante_id,
  COALESCE(v.nombre_cliente, p.nombre_completo) AS nombre_cliente,
  p.telefono_whatsapp,
  COALESCE(abonos.total_abonado, 0) AS total_abonado
FROM ventas v
LEFT JOIN participantes p ON p.id = v.participante_id
LEFT JOIN (
  SELECT venta_id, SUM(monto) AS total_abonado
  FROM   historial_abonos_venta
  GROUP  BY venta_id
) abonos ON abonos.venta_id = v.id;

-- ── VISTA: apartados pendientes de cobro ────────────────────────────────────
CREATE OR REPLACE VIEW vista_apartados_pendientes AS
SELECT * FROM vista_ventas_completa
WHERE tipo = 'apartado'
  AND saldo_pendiente > 0;

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
-- Solo usuarios autenticados pueden acceder a los datos del módulo tiendita.

ALTER TABLE categorias_producto    ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_compra          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_abonos_venta  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ajustes_stock           ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tiendita_auth_categorias"   ON categorias_producto
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tiendita_auth_productos"    ON productos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tiendita_auth_pedidos"      ON pedidos_compra
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tiendita_auth_pedido_items" ON pedido_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tiendita_auth_ventas"       ON ventas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tiendita_auth_venta_items"  ON venta_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tiendita_auth_abonos"       ON historial_abonos_venta
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tiendita_auth_ajustes"      ON ajustes_stock
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
