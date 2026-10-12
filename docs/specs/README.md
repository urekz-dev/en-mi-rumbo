# Specifications

These seven files are the functional contract of enmirumbo. The code is tested against them: every scenario maps to a test, and a story is not done while a scenario of its requirements has no test. When behaviour changes, the specification changes in the same pull request. They were inherited from the prototype (168 requirements, 751 scenarios), translated to English, and amended for version 2.

## Files

- [`public-directory.md`](public-directory.md): home, listings, cards, photos, search, SEO, reports, "Perdí mi enlace" (prototype: `directorio-publico`).
- [`business-registration.md`](business-registration.md): registration form, photo upload, consent, abuse controls, editing with the management link (prototype: `registro-negocio`).
- [`admin-review.md`](admin-review.md): admin panel, review queue, approve, reject, unpublish, delete, reports, pending edits (prototype: `revision-admin`).
- [`data-model.md`](data-model.md): entities, catalogues, lifecycle, retention, seeds (prototype: `modelo-datos`).
- [`base-layout.md`](base-layout.md): layout, tokens, accessibility, metadata, robots, sitemap, analytics (prototype: `layout-base`).
- [`legal-pages.md`](legal-pages.md): privacy notice and terms (prototype: `paginas-legales`).
- [`deployment.md`](deployment.md): environments, configuration, photos, scheduled jobs, security headers (prototype: `despliegue`).

## Conventions

- Format: `### Requirement:` with `#### Scenario:` and `WHEN` / `THEN` / `AND` bullets. Normative words: MUST, MUST NOT, SHOULD, MAY.
- UI copy is quoted in Spanish exactly as the user sees it. Everything else is English. URL paths that users see (`/registro`, `/aviso-de-privacidad`) stay in Spanish.
- References such as "PRD §6.1", "ADR-004" and "T-005" point to the prototype's documents. File paths, variable names and tool names in the translated text (Prisma, Vercel, Supabase, `SITIO_URL`) are the prototype's; the v2 architecture decisions are in `docs/adr/`.
- A requirement whose heading ends with ` (v2)` is a v2 amendment. Its body starts with `Added in v2 — source: <PRD section or ADR>.`
- A prototype requirement that v2 replaces is kept in full. The line `Superseded in v2 by <requirement> — source: <ADR or PRD section>.` follows its heading. A superseded requirement is not part of the contract any more; the requirement named in that line is.
- Where a v2 amendment and an unmarked prototype requirement seem to disagree, the amendment wins.

## Glossary

Spanish prototype term to the English term used in these files and in the code.

| Prototype term (Spanish)                                                    | English term                                                                                         |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `directorio-publico`                                                        | `public-directory`                                                                                   |
| `registro-negocio`                                                          | `business-registration`                                                                              |
| `revision-admin`                                                            | `admin-review`                                                                                       |
| `modelo-datos`                                                              | `data-model`                                                                                         |
| `layout-base`                                                               | `base-layout`                                                                                        |
| `paginas-legales`                                                           | `legal-pages`                                                                                        |
| `despliegue`                                                                | `deployment`                                                                                         |
| `Negocio` (entity), negocio                                                 | `Business`, business                                                                                 |
| `Reporte` (entity), reporte                                                 | `Report`, report                                                                                     |
| `EdicionPendiente` (entity), edición pendiente                              | `PendingEdit`, pending edit                                                                          |
| categoría / `Categoria`                                                     | category / `Category`                                                                                |
| colonia / `Colonia` ("Otra" colonia)                                        | zone / `Zone` (the "Otra" option keeps its Spanish label; the internal value `otra` becomes `other`) |
| giro / `Giro`                                                               | trade / `Trade`                                                                                      |
| ficha                                                                       | card (the business's public page: "public card"); tarjeta del listado = listing card                 |
| ficha publicada / registro                                                  | published card / registration (a business waiting for or going through review)                       |
| vecino                                                                      | resident                                                                                             |
| dueño / titular del negocio                                                 | owner; titular in legal context = data subject                                                       |
| admin, panel                                                                | admin, admin panel (panel)                                                                           |
| cola de revisión                                                            | review queue                                                                                         |
| estado `en_revision`                                                        | `in_review`                                                                                          |
| estado `publicado`                                                          | `published`                                                                                          |
| estado `rechazado`                                                          | `rejected`                                                                                           |
| origen `siembra` / `organico`                                               | origin `seeded` / `organic` (field `origen` -> `origin`)                                             |
| reporte `pendiente` / `atendido`                                            | `pending` / `attended`                                                                               |
| motivos de reporte `cerrado`, `no_real`, `datos_incorrectos`, `inapropiado` | `closed`, `not_real`, `incorrect_data`, `inappropriate`                                              |
| edición `pendiente` / `aplicada` / `descartada`                             | `pending` / `applied` / `discarded`                                                                  |
| aprobar / rechazar / despublicar                                            | approve / reject / unpublish                                                                         |
| borrado definitivo                                                          | permanent deletion                                                                                   |
| purga, purgar                                                               | purge                                                                                                |
| barrido de fotos huérfanas                                                  | orphan-photo sweep                                                                                   |
| enlace de gestión                                                           | management link                                                                                      |
| token                                                                       | token                                                                                                |
| huella (de enlace, de aviso)                                                | fingerprint                                                                                          |
| `fotoClave`                                                                 | `photoKey`                                                                                           |
| `consintioAvisoEn`                                                          | `consentedToNoticeAt`                                                                                |
| `consintioAvisoVersion`                                                     | `consentedToNoticeVersion`                                                                           |
| `reconsintioAvisoEn`                                                        | `reconsentedToNoticeAt`                                                                              |
| `reconsintioAvisoVersion`                                                   | `reconsentedToNoticeVersion`                                                                         |
| `registradoEn`                                                              | `registeredAt`                                                                                       |
| `rechazadoEn`                                                               | `rejectedAt`                                                                                         |
| `construirEnlaceComoLlegar`                                                 | `buildDirectionsLink`                                                                                |
| `como-llegar` (link id)                                                     | `directions`                                                                                         |
| `llamar` (link id)                                                          | `call`                                                                                               |
| `whatsapp-ficha`, `whatsapp-tarjeta` (ids)                                  | `whatsapp-card`, `whatsapp-listing`                                                                  |
| aviso de privacidad (integral / simplificado)                               | privacy notice (full / simplified)                                                                   |
| términos y condiciones                                                      | terms and conditions                                                                                 |
| constancia del consentimiento                                               | consent record                                                                                       |
| responsable (LFPDPPP)                                                       | responsible party                                                                                    |
| derechos ARCO                                                               | ARCO rights (access, rectification, cancellation, opposition)                                        |
| cupo (por IP)                                                               | quota (per IP)                                                                                       |
| honeypot                                                                    | honeypot                                                                                             |
| sello "Negocio verificado"                                                  | "Negocio verificado" seal                                                                            |
| medición (cookieless)                                                       | analytics measurement                                                                                |
| entorno                                                                     | environment                                                                                          |
| almacenamiento de fotos                                                     | photo storage                                                                                        |
| pin (latitud/longitud)                                                      | map pin (latitude/longitude)                                                                         |
| modo edición                                                                | edit mode                                                                                            |
| pantalla de gracias                                                         | thank-you screen                                                                                     |
| alta (de un negocio)                                                        | registration / creation                                                                              |
| reenvío                                                                     | resubmission                                                                                         |
| a domicilio                                                                 | home delivery (the tag text "A domicilio" stays Spanish)                                             |
| marca de borrador                                                           | draft mark                                                                                           |
| placeholder                                                                 | placeholder                                                                                          |
| pendientes operativos                                                       | operational pending items                                                                            |
| guardián (test que vigila)                                                  | guard                                                                                                |
| tarea programada                                                            | scheduled task                                                                                       |
| cupo, marca de cupo                                                         | quota, quota mark                                                                                    |
| almacén / almacenamiento                                                    | store / storage                                                                                      |
| puerto (hexagonal)                                                          | port                                                                                                 |
| barrido                                                                     | sweep                                                                                                |
| techo de filas                                                              | row ceiling                                                                                          |
| cabeceras de seguridad                                                      | security headers                                                                                     |
| campo trampa                                                                | honeypot field                                                                                       |
| rastro de despublicación                                                    | unpublishing trace                                                                                   |
| reaceptación                                                                | reacceptance (reconsent)                                                                             |
| bitácora (v2)                                                               | audit log (`AuditLogEntry`)                                                                          |
| localidad (v2)                                                              | locality (`Locality`)                                                                                |
| estado (geográfico, v2)                                                     | state (URL segment `{estado}`)                                                                       |
| municipio (v2)                                                              | municipality (URL segment `{municipio}`)                                                             |
| `?colonia=` (query parameter)                                               | stays `?colonia=` (user-visible URL)                                                                 |
| event properties `categoria`, `colonia`                                     | `category`, `zone`                                                                                   |
