# En Mi Rumbo

Directorio de negocios y servicios locales con contacto directo por WhatsApp. Sitio: https://enmirumbo.com (prototipo anterior a Urekz, en Vercel).

Estado: **esqueleto en este repo; prototipo operativo fuera** · Apuesta activa: "EMR v1: del prototipo al primer usuario real" (Plane → EMR) · Brief: `docs/product-brief.md`

## Cómo correr en local
Hasta que el código del prototipo entre en este repo (story "Inventariar el prototipo"), no hay nada que correr aquí. Después:
```bash
infisical login
infisical run --projectId e545592e-6df7-4561-9e6d-f555bea672fb --env dev -- <comando>
```

## Cómo se trabaja aquí
- Work item en Plane (EMR) antes de la rama. Rama `<type>/EMR-<n>-<descripcion>` desde `main`.
- PR con la plantilla de la organización; revisión de otra persona; squash merge. `main-guard` avisa si alguien hace push directo.
- Decisiones técnicas: `docs/adr/` (0001 reservado a "conservar o reescribir el prototipo").
- Secretos: Infisical → proyecto "En Mi Rumbo". Nunca en el repo.
- Handbook: https://handbook.urekz.com

## Cuentas relacionadas
Vercel (hosting), Namecheap (dominio; DNS migra a Cloudflare en EMR v1). Custodios en Notion → Tools & Vendors.
