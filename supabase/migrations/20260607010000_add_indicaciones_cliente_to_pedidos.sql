-- Fix: el formulario de pedido tiene un campo "Indicaciones (opcional)" y el
-- código (pedidos.service.js -> pedidoToRow) siempre envía `indicaciones_cliente`,
-- pero ninguna migración creaba esa columna. Sin ella, PostgREST rechaza el
-- INSERT completo ("column does not exist") y la web muestra
-- "No se pudo guardar el pedido".

alter table pedidos add column if not exists indicaciones_cliente text;

-- Forzar a PostgREST a recargar el cache de schema para que reconozca la columna ya.
notify pgrst, 'reload schema';
