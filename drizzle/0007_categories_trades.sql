-- Custom migration (ADR 0006): the global catalogues of categories and trades,
-- which every locality shares. The names are copy: the 8 categories of the
-- registration form (prototype PRD §6.1) and the 49 trades of its Appendix B,
-- spelled as the PRD writes them, each starting with a capital. The slugs
-- follow the rule of scripts/catalogues/slug.ts. Rows go in the PRD's order,
-- so the identifiers keep it; the comments keep the PRD's grouping of the
-- trades, but a trade belongs to no category. test/worker/catalogues.test.ts
-- checks every name and slug, and test/worker/root-urls.test.ts that no URL of
-- a locality reads in two ways. A slug never changes: a new category or trade
-- ships in a new data migration.
INSERT INTO "categories" ("name", "slug") VALUES
  ('Restaurantes y fondas', 'restaurantes-y-fondas'),
  ('Servicios del hogar', 'servicios-del-hogar'),
  ('Belleza', 'belleza'),
  ('Salud', 'salud'),
  ('Abarrotes y comercio', 'abarrotes-y-comercio'),
  ('Talleres', 'talleres'),
  ('Clubes y escuelas deportivas', 'clubes-y-escuelas-deportivas'),
  ('Otro', 'otro');
--> statement-breakpoint
INSERT INTO "trades" ("name", "slug") VALUES
  -- Servicios del hogar
  ('Plomería', 'plomeria'),
  ('Electricidad', 'electricidad'),
  ('Albañilería', 'albanileria'),
  ('Herrería', 'herreria'),
  ('Carpintería', 'carpinteria'),
  ('Pintura', 'pintura'),
  ('Jardinería', 'jardineria'),
  ('Fumigación', 'fumigacion'),
  ('Reparación de lavadoras y refrigeradores', 'reparacion-de-lavadoras-y-refrigeradores'),
  ('Cerrajería', 'cerrajeria'),
  ('Mudanzas', 'mudanzas'),
  -- Restaurantes y fondas
  ('Fonda / comida corrida', 'fonda-comida-corrida'),
  ('Antojitos', 'antojitos'),
  ('Tacos', 'tacos'),
  ('Pizzas', 'pizzas'),
  ('Pollos', 'pollos'),
  ('Mariscos', 'mariscos'),
  ('Panadería', 'panaderia'),
  ('Pastelería', 'pasteleria'),
  -- Belleza
  ('Estética', 'estetica'),
  ('Barbería', 'barberia'),
  ('Uñas', 'unas'),
  ('Maquillaje', 'maquillaje'),
  -- Salud
  ('Consultorio médico', 'consultorio-medico'),
  ('Dentista', 'dentista'),
  ('Farmacia', 'farmacia'),
  ('Veterinaria', 'veterinaria'),
  ('Psicología', 'psicologia'),
  -- Abarrotes y comercio
  ('Abarrotes', 'abarrotes'),
  ('Papelería', 'papeleria'),
  ('Ferretería', 'ferreteria'),
  ('Ropa', 'ropa'),
  ('Celulares y accesorios', 'celulares-y-accesorios'),
  ('Florería', 'floreria'),
  -- Talleres
  ('Taller mecánico', 'taller-mecanico'),
  ('Hojalatería y pintura', 'hojalateria-y-pintura'),
  ('Vulcanizadora', 'vulcanizadora'),
  ('Bicicletas', 'bicicletas'),
  ('Motos', 'motos'),
  ('Electrónica', 'electronica'),
  -- Clubes y escuelas deportivas
  ('Futbol', 'futbol'),
  ('Box', 'box'),
  ('Taekwondo / artes marciales', 'taekwondo-artes-marciales'),
  ('Gimnasio', 'gimnasio'),
  ('Danza / zumba', 'danza-zumba'),
  ('Natación', 'natacion'),
  ('Basquetbol', 'basquetbol'),
  ('Atletismo / corredores', 'atletismo-corredores'),
  ('Ciclismo', 'ciclismo');
