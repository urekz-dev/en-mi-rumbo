-- Custom migration (ADR 0021): the permission catalogue, the base roles and the
-- protection of system roles. The catalogue is the same as PERMISSIONS in
-- src/core/access/permissions.ts; test/worker/access.test.ts compares them.
-- The first super admin is created by hand in the database (README, Operations).
INSERT INTO "permissions" ("key", "description") VALUES
  ('businesses.review', 'Revisar registros: ver la cola y el detalle, aprobar y rechazar'),
  ('businesses.edit', 'Editar cualquier ficha, asignar giros y normalizar la colonia'),
  ('businesses.unpublish', 'Despublicar fichas'),
  ('businesses.delete', 'Borrar fichas de forma definitiva'),
  ('edits.review', 'Aplicar o descartar los cambios que mandan los dueños'),
  ('reports.manage', 'Atender los reportes de los vecinos'),
  ('links.manage', 'Generar enlaces de gestión'),
  ('zones.manage', 'Ocultar y renombrar colonias'),
  ('audit_log.view', 'Ver la bitácora'),
  ('localities.manage', 'Configurar ciudades: WhatsApp de contacto, umbral y activación'),
  ('users.manage', 'Invitar, crear y desactivar usuarios del panel y asignarles roles'),
  ('roles.manage', 'Crear y editar roles');
--> statement-breakpoint
INSERT INTO "roles" ("key", "name", "description", "scope", "system", "all_permissions") VALUES
  ('super_admin', 'Super admin', 'Todo, en todas las ciudades. Crea usuarios y roles.', 'global', true, true),
  ('locality_admin', 'Admin de ciudad', 'Revisa y administra las fichas de las ciudades que tiene asignadas.', 'locality', false, false);
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_key")
SELECT r."id", p."key"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."key" = 'locality_admin'
  AND p."key" IN (
    'businesses.review', 'businesses.edit', 'businesses.unpublish', 'businesses.delete',
    'edits.review', 'reports.manage', 'links.manage', 'zones.manage', 'audit_log.view'
  );
--> statement-breakpoint
-- A system role is fixed: it cannot be updated or deleted, and its permissions
-- come from `all_permissions`, never from rows of `role_permissions`.
CREATE FUNCTION "protect_system_role"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'role % is a system role and cannot be changed', OLD."key"
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "roles_protect_system"
  BEFORE UPDATE OR DELETE ON "roles"
  FOR EACH ROW WHEN (OLD."system")
  EXECUTE FUNCTION "protect_system_role"();
--> statement-breakpoint
CREATE FUNCTION "reject_system_role_permissions"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "roles" WHERE "id" = NEW."role_id" AND "system") THEN
    RAISE EXCEPTION 'a system role holds every permission through all_permissions'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "role_permissions_reject_system"
  BEFORE INSERT OR UPDATE ON "role_permissions"
  FOR EACH ROW
  EXECUTE FUNCTION "reject_system_role_permissions"();
