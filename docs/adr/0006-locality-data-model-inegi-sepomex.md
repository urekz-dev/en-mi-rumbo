# ADR 0006: Locality-aware data model with the INEGI and SEPOMEX catalogues

- Status: accepted
- Date: 2026-10-11
- Owner: Alexis Zazueta

## Context

Mexico has many towns with the same name, so a locality needs state and municipality to be unambiguous. INEGI publishes a stable catalogue: a two-digit state code and a three-digit municipality code (Tizayuca is 13069). The SEPOMEX postal catalogue lists every settlement (colonia, fraccionamiento, pueblo, unidad habitacional) with its type and the same state and municipality keys. The prototype hard-codes Tizayuca and keeps a hand-maintained list of colonias.

## Decision

The locality is a first-class record from the first migration: INEGI code as identity, slug, name, state, IANA time zone, admin WhatsApp, active flag (the admin WhatsApp became the locality's contact WhatsApp, and its admins come from role assignments: ADR 0021). The full catalogue of states and municipalities is loaded as reference data with precomputed slugs (amended on 2026-10-15: only the states and municipalities of the served localities are kept); only active localities are served and every other state or municipality answers 404. Zones hang from the locality and are seeded from SEPOMEX for each active municipality; the admin can hide or rename a zone and the prototype's list is used to cross-check Tizayuca. Categories and trades are global. Businesses, revisions, reports and the audit log reference the locality. There is one admin panel with a locality filter, hidden while there is one locality. Slugs are unique per locality.

Amended on 2026-10-15 (EMR-68), by decision of the product owner:

- The directory works only in Tizayuca, and cities are added one at a time, on purpose. The database keeps only the reference data of the localities it serves: today the state of Hidalgo (INEGI `13`), the municipality of Tizayuca (`13069`), its locality, the coordinates of its municipal seat and its 105 zones. A data migration removes the rest of INEGI's catalogue, which an earlier migration loaded and which stays as it was; every other state or municipality still answers 404.
- Each new city ships its reference data (its state when it is new, its municipality, its locality, its seat and its zones) in its own data migration. The repository keeps no script for INEGI's or SEPOMEX's catalogues: how a new city's data is prepared is decided when one is needed. Once its data is in the database, activating it is still data work: set its contact WhatsApp, assign its admins and turn its flag on.

## Consequences

Activating a new city is data work: seed its zones, set its admin WhatsApp and flip the flag. SEPOMEX data has duplicates and odd spellings that need a cleanup pass. Texts that name the locality are parametrised; a test guards that none is hard-coded.
