# Instrucciones para agentes Copilot

## Principios

- Sigue las convenciones del proyecto y prioriza la estructura actual.
- Usa los comandos de build/test definidos en `package.json`.
- Aplica buenas prácticas de TypeScript, Express y Sequelize.
- Evita duplicar lógica y mantén el código DRY.
- Si el workspace crece, segmenta instrucciones por área (backend, tests, migraciones).

## Comandos clave

- **Desarrollo:** `npm run dev` (inicia el backend en modo desarrollo)
- **Build:** `npm run build` (compila TypeScript)
- **Start:** `npm start` (ejecuta el backend compilado)
- **Migraciones:**
  - Generar: `npm run generate:migration -- <nombre>`
  - Ejecutar: `npm run migrate`
  - Revertir: `npm run migrate:undo`
- **Seeders:**
  - Generar: `npm run generate:seeder -- <nombre>`
  - Ejecutar: `npm run seed:all`
  - Revertir: `npm run seed:undo:all`

## Convenciones

- El backend está en `src/`.
- Configuración en `config/`.
- Migraciones y seeders en `migrations/` y `seeders/`.
- Usa `sequelize` para ORM y conexión a PostgreSQL.
- El archivo principal es `src/index.ts`.
- El router principal está en `src/routes.ts`.

## Arquitectura

El proyecto sigue una arquitectura modular.

Cada módulo dentro de `src/modules` contiene:

- controller.ts → maneja requests HTTP
- service.ts → lógica de negocio
- model.ts → modelo Sequelize
- routes.ts → endpoints del módulo

Los controllers deben ser delgados y delegar lógica a los services.
Los services manejan operaciones de base de datos usando Sequelize.

## Flujo de request

1. Request entra por `src/routes.ts`
2. Se dirige al router del módulo correspondiente
3. El controller valida el request
4. El controller llama al service
5. El service interactúa con el modelo Sequelize
6. El controller retorna la respuesta JSON

## Pitfalls

- Verifica variables de entorno en `config/env.ts`.
- Si la base de datos falla, revisa logs de conexión en `src/config/database.ts`.
- Para nuevos módulos, sigue el patrón de subcarpetas en `src/modules/`.

## Ejemplo de prompts

- "Agrega un endpoint en el router principal para `/api/v1/status`."
- "Crea una migración para añadir una columna a la tabla `shop`."
- "Corrige un error de conexión a la base de datos."

## Sugerencias de personalización

- Crear instrucciones específicas para migraciones (`applyTo: migrations/`).
- Definir hooks para validación de modelos antes de guardar.
- Agente especializado en seeders para datos iniciales.

## Reglas para generación de código

Cuando generes código:

- Prioriza reutilizar servicios existentes.
- No crear dependencias nuevas sin necesidad.
- Mantener coherencia con módulos existentes.
- Seguir estructura del proyecto.

---

Este archivo guía a Copilot para seguir las mejores prácticas y convenciones del backend de Manuarte App. Actualiza este archivo si el proyecto evoluciona o se agregan nuevas áreas.
