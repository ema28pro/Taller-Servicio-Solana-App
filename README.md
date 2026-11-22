# FixChain — Taller de Servicio Técnico On-Chain

![FixChain — Taller de Servicio Técnico en Solana](./public/banner-fixchain.jpg)

**Ruta elegida:** **Proyecto propio** (Solana Engineering Track: Advanced — WayLearn)

**FixChain** es una aplicación descentralizada (dApp) en **Solana Devnet** para administrar un taller de servicio técnico mediante cuentas PDA jerárquicas de tres niveles (`Taller` → `Equipo` → `Orden`). Permite crear talleres, registrar dispositivos con identificador automático, abrir órdenes de reparación, actualizar su costo y cerrar órdenes recuperando la renta en SOL.

---

## 1. Despliegue en Solana Devnet

- **Red:** Solana Devnet
- **Program ID:** `6uZx9cK4nttnnUZjzT5GpcjZ1zZsv7CtDjmYDSiCbnQ`
- **Solana Explorer (Devnet):** [Ver programa en Devnet](https://explorer.solana.com/address/6uZx9cK4nttnnUZjzT5GpcjZ1zZsv7CtDjmYDSiCbnQ?cluster=devnet)
- **Repositorio del programa Anchor (standalone):** [ema28pro/Taller-Servicio-Solana-PDA](https://github.com/ema28pro/Taller-Servicio-Solana-PDA)

---

## 2. Arquitectura y aporte propio

Partiendo de la arquitectura de referencia de WayLearn (`Registro-Ventas-Solana-PDA` y `Registro-Ventas-Solana-App`), se diseñó e implementó un caso de uso completo desde cero:

### Programa Anchor (`programa/src/lib.rs`)
- **Jerarquía de PDAs:**
  - `Taller`: `[b"taller", nombre_taller.as_bytes(), owner.key().as_ref()]` (`nombre_taller` máx. 30 bytes, hasta 10 equipos, `id_counter: u16`, `owner: Pubkey`).
  - `Equipo`: `[b"equipo", taller.key().as_ref(), id_equipo.to_le_bytes().as_ref()]` (ID automático incremental asignado por el programa, `modelo` máx. 30 bytes, hasta 10 órdenes).
  - `Orden`: `[b"orden", equipo.key().as_ref(), codigo.as_bytes()]` (`codigo` máx. 8 bytes, `diagnostico` máx. 50 bytes, `costo: u32` en unidades enteras/centavos).
- **Instrucciones:** `crear_taller`, `registrar_equipo`, `crear_orden`, `cambiar_costo` y `cerrar_orden` (`close = owner`).
- **Reglas de seguridad y validaciones:**
  - Autoridad validada desde la raíz con `has_one = owner @ Errores::NoOwner`.
  - Validación de capacidad máxima de 10 elementos por vector (`require!(..., Errores::LimiteAlcanzado)`).
  - Validación de existencia en el índice al cerrar órdenes (`require!(equipo.ordenes.contains(&orden_key), Errores::NoOrden)`).

### Frontend y Cliente Tipado (`src/` y `clients/js/`)
- **IDL y Cliente Codama:** `idl.json` exportado desde Solana Playground y cliente regenerado automáticamente en `clients/js/src/generated/`.
- **Capa Solana (`src/solana/`):** derivación exacta de PDAs en `pdas.ts` (incluyendo `u16` little-endian), lecturas encadenadas en `lecturas.ts`, validaciones de longitud/cupo en `validaciones.ts` y transacciones firmadas en `acciones.ts`.
- **Interfaz FixChain (`src/components/Taller.tsx`, `src/App.tsx`):** identidad visual propia (favicon, banner integrado y paleta carbón/ámbar) con flujo completo de creación, consulta, edición y cierre de órdenes.

---

## 3. Cómo configurar y ejecutar localmente

### Requisitos
- **Node.js** `>= 22.12.0`
- Una wallet compatible con Solana (**Phantom** o **Solflare**) configurada en **Devnet** con SOL de prueba ([faucet.solana.com](https://faucet.solana.com)).

### Pasos
```bash
# 1. Instalar dependencias
npm install

# 2. Verificar tipos y coherencia entre IDL, Program ID y cliente Codama
npm run typecheck
npm run comprobar:idl

# 3. Compilar versión de producción
npm run build

# 4. Iniciar la aplicación en modo desarrollo
npm run dev
```

Abre la URL local que muestre Vite (por defecto `http://localhost:5173`), conecta tu wallet en **Devnet** y prueba el flujo completo desde la pestaña **Taller de servicio**.

---

## 4. Pruebas y evidencias

### Tabla de equivalencia y casos probados (Proyecto propio)

| Caso | Estado inicial / Datos | Operación realizada | Resultado esperado y observado | Evidencia / Error |
|---|---|---|---|---|
| **Crear Taller y Registrar Equipo** | Wallet `owner` con SOL en Devnet | `crear_taller` + `registrar_equipo` | Se crean las PDAs `Taller` y `Equipo` (`id_equipo = 1`, `id_counter = 1`) y pueden leerse desde la app. | [Tx en Devnet](https://explorer.solana.com/tx/PPF75y6SLrbNFLuTubfSDvyggdRnFiR5xGuYLrLkekaU35V9x9uZQJ6Zc4LRZxg4MzzUK4JSzP1aVoZpiXU5io2?cluster=devnet) |
| **Crear Orden válida** | `Taller` y `Equipo #1` existentes | `crear_orden` (`codigo`, `diagnostico`, `costo`) | Se crea PDA `Orden`, se guarda en `equipo.ordenes` y `ordenes_activas` sube a `1`. | [Tx en Devnet](https://explorer.solana.com/tx/2rMqXoesU9aevgLmAShxHZs8PGt5AT1gaJ3i2U8uwNuaAPt7ydiQsHm1FTw9n2K934RVNDdKzQHruzxE2n7qM68T?cluster=devnet) |
| **Cambiar costo de orden** | `Orden` activa en `Equipo #1` | `cambiar_costo` (`nuevo_costo`) | Se actualiza `orden.costo` conservando la relación con `Equipo`. | [Tx en Devnet](https://explorer.solana.com/tx/22Nkxf3eXAE8ubxdDsGyi5gvw1ztDKRwapmZf4EpYk5skyrtxEqWY4hYe9F3VZ6YDqtcvc56EPPhsqB8UrZ6koHb?cluster=devnet) |
| **Cerrar orden válida** | `Orden` activa en `equipo.ordenes` | `cerrar_orden` (`close = owner`) | Se retira la PDA de `equipo.ordenes`, `ordenes_activas` baja a `0`, la cuenta se cierra (`null`) y el rent vuelve al `owner`. | [Tx en Devnet](https://explorer.solana.com/tx/VbPGuS2pT9TCe3jnDbtAysXcdFS4wcDeQ6LoC9V17WDe2uhMe1HCBn7YGTZeBn2XGpGA8wWtubmGFhce32zckL3?cluster=devnet) |
| **Wallet no autorizada** | `Taller` cuyo `owner` es otra wallet | Invocar instrucción con signer distinto | El programa rechaza con `NoOwner` (`6000`) por `has_one = owner` y conserva el estado. | Validado en contrato (`has_one = owner @ Errores::NoOwner`) |
| **Orden ajena al equipo** | `Equipo` y `Orden` de otro padre | Enviar PDA de orden que no deriva de `equipo` | El programa rechaza con `ConstraintSeeds` (`2006`) y conserva los datos. | Validado por seeds en contexto Anchor |
| **Límite de 10 elementos (aporte propio)** | `Taller` o `Equipo` con 10 elementos | Intentar `registrar_equipo` o `crear_orden` #11 | El frontend bloquea antes de firmar y el programa rechaza explícitamente con `LimiteAlcanzado` (`6002`). | `require!(...len() < 10, Errores::LimiteAlcanzado)` |

### Prueba integral on-chain en Solana Devnet (`programa/tests/anchor.test.ts`)
Ejecutada en Solana Playground contra el programa desplegado `6uZx9cK4nttnnUZjzT5GpcjZ1zZsv7CtDjmYDSiCbnQ`:

```text
  Taller de Servicio (taller -> equipo -> orden)
    ✔  flujo completo: crear taller, registrar equipo, crear orden, cambiar costo y cerrar orden (5076ms)
  1 passing (5s)
```

### Verificaciones técnicas del repositorio
- `npm run comprobar:idl`: `Contrato coherente: IDL, Program ID y cliente generado.`
- `npm run typecheck` (`tsc -b`): **0 errores**.
- `npm run build` (`vite build`): **326 módulos transformados**, build de producción exitoso.
- Pruebas funcionales en vivo desde la interfaz web conectada con wallet en **Solana Devnet** (transacciones reales enlazadas arriba).
