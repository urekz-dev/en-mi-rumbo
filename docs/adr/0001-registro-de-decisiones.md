# ADR 0001: Registrar decisiones técnicas como ADR en este repositorio

- Estado: accepted
- Fecha: 2026-09-16
- Dueño: Engineering
- RFD relacionado: 0010

## Contexto
Las decisiones técnicas de un producto se pierden si viven lejos del código. Un agente que trabaja en este repo solo ve este repo. El handbook de Urekz (RFD 0010) fija que la documentación técnica vive con el código.

## Decisión
Registramos cada decisión técnica significativa (estructura, dependencias, interfaces, técnica de construcción, hosting, datos) como un archivo `docs/adr/NNNN-titulo.md` con el formato de `template.md`, numerado de forma correlativa y nunca reutilizado. Una decisión se cambia con un ADR nuevo que la supersede; el anterior no se edita.

## Consecuencias
Cada PR que cambie una decisión incluye o actualiza un ADR. El siguiente número disponible es 0002 (en `en-mi-rumbo`, reservado a "conservar o reescribir el prototipo"; en `urekzcode`, a "lenguaje y arquitectura del harness").
