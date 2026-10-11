# ADR 0006: Locality-aware data model with the INEGI and SEPOMEX catalogues

- Status: accepted
- Date: 2026-10-11
- Owner: Alexis Zazueta

## Context
Mexico has many towns with the same name, so a locality needs state and municipality to be unambiguous. INEGI publishes a stable catalogue: a two-digit state code and a three-digit municipality code (Tizayuca is 13069). The SEPOMEX postal catalogue lists every settlement (colonia, fraccionamiento, pueblo, unidad habitacional) with its type and the same state and municipality keys. The prototype hard-codes Tizayuca and keeps a hand-maintained list of colonias.

## Decision
The locality is a first-class record from the first migration: INEGI code as identity, slug, name, state, IANA time zone, admin WhatsApp, active flag. The full catalogue of states and municipalities is loaded as reference data with precomputed slugs; only active localities are served and every other state or municipality answers 404. Zones hang from the locality and are seeded from SEPOMEX for each active municipality; the admin can hide or rename a zone and the prototype's list is used to cross-check Tizayuca. Categories and trades are global. Businesses, revisions, reports and the audit log reference the locality. There is one admin panel with a locality filter, hidden while there is one locality. Slugs are unique per locality.

## Consequences
Activating a new city is data work: seed its zones, set its admin WhatsApp and flip the flag. SEPOMEX data has duplicates and odd spellings that need a cleanup pass. Texts that name the locality are parametrised; a test guards that none is hard-coded.
