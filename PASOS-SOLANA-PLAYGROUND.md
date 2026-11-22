# Pasos posteriores en Solana Playground e integración del IDL

Este repositorio (`Taller-Servicio-Solana-App`) ya tiene adaptado el frontend (`src/`) y los scripts de contrato (`scripts/contrato-idl.mjs`, `scripts/verificar-contrato.mjs`) al programa **`taller`** definido en `../Taller-Servicio-Solana-PDA/src/lib.rs`.

Como aún no se ha compilado ni exportado el `idl.json` desde Solana Playground, el directorio conserva temporalmente el `idl.json` y el cliente `clients/js/src/generated/` de referencia (`registro`) hasta que ejecutes `configurar:idl`.

---

## 1. Compilar, desplegar y exportar el IDL en Solana Playground

1. Abre **Solana Playground**: [https://beta.solpg.io/](https://beta.solpg.io/).
2. Crea un proyecto Anchor nuevo o abre uno existente y reemplaza `src/lib.rs` por el archivo `../Taller-Servicio-Solana-PDA/src/lib.rs`.
3. En la pestaña **Build & Deploy**, haz clic en **Build**.
   - Solana Playground compilará el programa y rellenará el Program ID dentro de `declare_id!("...")`.
4. Conecta una wallet de Playground con saldo de **Devnet** (por ejemplo, ejecutando `solana airdrop 2` o usando el faucet de Devnet) y haz clic en **Deploy** en **Devnet**.
5. Copia el **Program ID** desplegado (el valor dentro de `declare_id!("...")`) y guárdalo en `../entrega.txt` (*Dirección en Devnet*).
6. En la misma pestaña **Build & Deploy**, ve a la sección **IDL** y haz clic en **Export** para descargar tu archivo `idl.json`.

---

## 2. Instalar dependencias y generar el cliente en este frontend

> **Nota sobre la versión de Node.js:** `package.json` declara `"engines": { "node": ">=22.12.0 <25" }` (y `.nvmrc` especifica `22`), mientras que este entorno tiene instalada la versión **`v26.13.1`**. Si encuentras incompatibilidades al instalar o compilar paquetes nativos/dependencias, cambia a Node 22 LTS (por ejemplo con `nvm use 22`) antes de ejecutar `npm install`.

Ejecuta estos comandos dentro de `Taller-Servicio-Solana-App/`:

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Importar tu `idl.json` exportado y regenerar el cliente Codama (`clients/js/src/generated/`):
   ```bash
   npm run configurar:idl -- ./ruta/al/idl.json --program-id <PROGRAM_ID>
   ```
   *(Nota: `--program-id <PROGRAM_ID>` es obligatorio si el IDL exportado no incluye `address` ni `metadata.address`.)*
3. Verificar tipos TypeScript y contrato IDL:
   ```bash
   npm run typecheck
   ```
4. Verificar compilación de producción:
   ```bash
   npm run build
   ```
5. Iniciar el servidor de desarrollo y probar en **Devnet**:
   ```bash
   npm run dev
   ```
   - Verifica primero la derivación de PDA creando un `Taller` desde Solana Playground o desde la UI y comprobando que la dirección mostrada en **"Dirección del taller"** coincide exactamente con la cuenta creada en Explorer.
   - Ejecuta al menos una operación de cada instrucción (`crear_taller`, `registrar_equipo`, `crear_orden`, `cambiar_costo`, `cerrar_orden`).

---

## 3. Advertencias importantes

- **`npm run verificar` fallará** incluso después de configurar el IDL, porque la carpeta `tests/` (`tests/integracion-cliente.test.ts`) se mantuvo intacta y sigue probando el programa original de ventas (`registro`). Utiliza `npm run typecheck` y `npm run build` para validar tu proyecto.
- **Nunca ejecutes `npm run clase:*`** (`clase:dia3`, `clase:dia4`, `clase:resuelto`), porque `scripts/preparar-clase.mjs` sobrescribe `src/solana/acciones.ts` con la versión original de ventas.
- Si deseas personalizar el nombre visible de la aplicación o el nombre sugerido por defecto, edita **`src/config/interfaz.ts`** (`TITULO_APP`, `TALLER_INICIAL`, `UNIDAD_COSTO`).
- No edites manualmente `clients/js/src/generated/`: siempre se regenera automáticamente mediante `npm run configurar:idl` o `npm run cliente`.
