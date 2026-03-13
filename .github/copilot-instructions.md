# Instrucciones para agentes Copilot

Este proyecto es un backend desarrollado con Node.js, Express, TypeScript y Sequelize conectado a PostgreSQL.

El objetivo de estas instrucciones es que los agentes de Copilot generen código consistente con la arquitectura y convenciones del proyecto.

---

## Principios

- Sigue siempre la arquitectura y convenciones existentes del proyecto.
- Prioriza reutilizar código existente antes de crear código nuevo.
- Mantén el código limpio, modular y DRY.
- No agregues dependencias nuevas a menos que sea estrictamente necesario.
- Sigue las convenciones de TypeScript del proyecto.

---

## Stack tecnológico

- Node.js
- Express
- TypeScript
- Sequelize ORM
- PostgreSQL

---

## Comandos del proyecto

### Desarrollo

npm run dev

Inicia el servidor en modo desarrollo.

### Build

npm run build

Compila el proyecto TypeScript.

### Start

npm start

Ejecuta el backend compilado.

### Migraciones

Generar migración:

npm run generate:migration -- <nombre>

Ejecutar migraciones:

npm run migrate

Revertir migración:

npm run migrate:undo

### Seeders

Generar seeder:

npm run generate:seeder -- <nombre>

Ejecutar seeders:

npm run seed:all

Revertir seeders:

npm run seed:undo:all

---

## Estructura del proyecto

El código principal del backend se encuentra en:

src/

Configuración:

src/config/

Migraciones:

migrations/

Seeders:

seeders/

Router principal:

src/routes.ts

Archivo de entrada:

src/index.ts

---

## Arquitectura del backend

El proyecto sigue una arquitectura modular basada en capas:

Route → Controller → Service → Model

### Responsabilidades

#### Routes

Las rutas:

- Definen endpoints de Express
- Instancian Services
- Instancian Controllers
- Registran los métodos del controller

Las rutas **no deben contener lógica de negocio**.

#### Controllers

Los controllers:

- Son **clases**
- Reciben el service mediante **inyección por constructor**
- Manejan requests y responses
- Delegan toda la lógica al service

Los controllers **no deben acceder directamente a Sequelize**.

#### Services

Los services:

- Son **clases**
- Contienen la lógica de negocio
- Acceden a la base de datos mediante Sequelize models
- Reciben los models por **inyección en el constructor**

#### Models

Los models:

- Son modelos de Sequelize
- Definen estructura de tablas y asociaciones
- No contienen lógica de negocio

---

## Estructura de módulos

Cada módulo dentro de:

src/modules/

debe tener la siguiente estructura:

module-name/
controller.ts
service.ts
model.ts
routes.ts

---

## Patrón obligatorio para Routes

Las rutas deben seguir este patrón:

1. Importar Router
2. Importar Service
3. Importar Model
4. Importar Controller
5. Instanciar Service con Model
6. Instanciar Controller con Service
7. Registrar métodos del Controller

Ejemplo:

import { Router } from 'express';
import { ShopService } from './service';
import { ShopModel } from './model';
import { ShopController } from './controller';

const router = Router();

const shopService = new ShopService(ShopModel);
const shopController = new ShopController(shopService);

router.get('/', shopController.getAll);

export default router;

---

## Patrón obligatorio para Controllers

Los controllers deben ser **clases**.

Los handlers deben definirse como propiedades usando Handler de Express.

Ejemplo:

export class ShopController {

    constructor(private shopService: ShopService) {}

    getAll: Handler = async (_req, res, next) => {
    	try {
    		const result = await this.shopService.getAll();
    		res.status(result.status).json(result.shops);
    	} catch (error) {
    		next(error);
    	}
    };

}

No crear handlers como funciones sueltas.

---

## Patrón obligatorio para Services

Los services deben ser clases que reciben el model en el constructor.

Ejemplo:

export class ShopService {

    constructor(private shopModel: typeof ShopModel) {}

    getAll = async () => {
    	return this.shopModel.findAll();
    };

}

---

## Flujo de una request

1. La request entra por src/routes.ts
2. Se dirige al router del módulo correspondiente
3. El router ejecuta el método del controller
4. El controller llama al service
5. El service interactúa con el Sequelize model
6. El controller devuelve la respuesta HTTP

---

## Reglas importantes

- No crear lógica de negocio en routes.
- No acceder a models desde controllers.
- No crear handlers como funciones sueltas.
- Controllers y Services deben ser clases.
- Seguir siempre la estructura existente de los módulos.
- Commits siempre en inglés

---

## Pitfalls

- Verificar variables de entorno en src/config/env.ts
- Si falla la base de datos revisar src/config/database.ts
- Mantener consistencia con módulos existentes en src/modules
- Respuestas hacia el cliente en español, logs en inglés

---

## Reglas para generación de código

Cuando generes código:

- Analiza módulos existentes dentro de src/modules para replicar su patrón.
- Mantén la misma arquitectura.
- Prioriza reutilizar services existentes.
- No agregues dependencias innecesarias.

---

## Ejemplos de prompts

- Crea un nuevo módulo siguiendo la arquitectura del proyecto.
- Agrega un endpoint al módulo shop siguiendo el patrón existente.
- Crea una migración para agregar una columna a la tabla shop.
- Refactoriza este módulo para seguir la arquitectura del proyecto.

---

Este archivo guía a Copilot para seguir la arquitectura y convenciones del backend de Manuarte App.  
Debe actualizarse si cambian las reglas del proyecto.
