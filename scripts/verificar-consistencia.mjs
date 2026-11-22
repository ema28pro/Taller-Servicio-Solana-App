import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const libRsPath = resolve(root, '..', 'Taller-Servicio-Solana-PDA', 'src', 'lib.rs');

let fallos = 0;
function ok(msg) {
  console.log('[PASS] ' + msg);
}
function fail(msg) {
  fallos += 1;
  console.error('[FAIL] ' + msg);
}
function check(condicion, msgOk, msgFail = msgOk) {
  if (condicion) ok(msgOk);
  else fail(msgFail);
}

// 1. Leer y parsear src/lib.rs como fuente de verdad
if (!existsSync(libRsPath)) {
  console.error('[FAIL] No se encontro ' + libRsPath);
  process.exit(1);
}
const libRsRaw = readFileSync(libRsPath, 'utf8');
const libRs = libRsRaw
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

const modMatch = libRs.match(/#\[program\]\s*pub\s+mod\s+([a-zA-Z0-9_]+)/);
const programaRust = modMatch ? modMatch[1] : null;
check(programaRust === 'taller', `Programa Rust detectado: pub mod ${programaRust}`);

function extraerStruct(nombre) {
  const re = new RegExp(`pub\\s+struct\\s+${nombre}\\s*\\{([\\s\\S]*?)\\n\\}`);
  const m = libRs.match(re);
  return m ? m[1] : '';
}

function extraerMaxLen(bloque, campo) {
  const re = new RegExp(`#\\[max_len\\((\\d+)\\)\\]\\s*(?:pub\\s+)?${campo}\\s*:`);
  const m = bloque.match(re);
  return m ? Number(m[1]) : null;
}

const structTaller = extraerStruct('Taller');
const structEquipo = extraerStruct('Equipo');
const structOrden = extraerStruct('Orden');

const maxNombreTaller = extraerMaxLen(structTaller, 'nombre_taller');
const maxEquipos = extraerMaxLen(structTaller, 'equipos');
const maxModelo = extraerMaxLen(structEquipo, 'modelo');
const maxOrdenes = extraerMaxLen(structEquipo, 'ordenes');
const maxCodigo = extraerMaxLen(structOrden, 'codigo');
const maxDiagnostico = extraerMaxLen(structOrden, 'diagnostico');

check(
  maxNombreTaller === 30 && maxEquipos === 10 && maxModelo === 30 && maxOrdenes === 10 && maxCodigo === 8 && maxDiagnostico === 50,
  `Limites #[max_len] en lib.rs: nombre_taller=${maxNombreTaller}, equipos=${maxEquipos}, modelo=${maxModelo}, ordenes=${maxOrdenes}, codigo=${maxCodigo}, diagnostico=${maxDiagnostico}`
);

function extraerInstruccionArgs(fnName) {
  const re = new RegExp(`pub\\s+fn\\s+${fnName}\\s*\\(([\\s\\S]*?)\\)\\s*->\\s*Result<\\(\\)>`);
  const m = libRs.match(re);
  if (!m) return [];
  return m[1]
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('context:'))
    .map((s) => {
      const [nombre, tipo] = s.split(':').map((p) => p.trim());
      return {
        rawNombre: nombre,
        normalizado: nombre.replace(/^_+/, '').replace(/_/g, '').toLowerCase(),
        tipo: tipo === 'String' ? 'string' : tipo,
      };
    });
}

const rustInstrucciones = {
  crear_taller: extraerInstruccionArgs('crear_taller'),
  registrar_equipo: extraerInstruccionArgs('registrar_equipo'),
  crear_orden: extraerInstruccionArgs('crear_orden'),
  cambiar_costo: extraerInstruccionArgs('cambiar_costo'),
  cerrar_orden: extraerInstruccionArgs('cerrar_orden'),
};

for (const [fn, args] of Object.entries(rustInstrucciones)) {
  check(args.length > 0, `Instruccion Rust ${fn} parseada con ${args.length} arg(s): ${args.map((a) => `${a.rawNombre}:${a.tipo}`).join(', ')}`);
}

// Verificar semillas exactas en contextos Rust
const seedTallerOk = /seeds\s*=\s*\[\s*b"taller"\s*,\s*nombre_taller\.as_bytes\(\)\s*,\s*owner\.key\(\)\.as_ref\(\)\s*\]/.test(libRs);
const seedEquipoInitOk = /seeds\s*=\s*\[\s*b"equipo"\s*,\s*taller\.key\(\)\.as_ref\(\)\s*,\s*\(taller\.id_counter\s*\+\s*1\)\.to_le_bytes\(\)\.as_ref\(\)\s*\]/.test(libRs);
const seedEquipoLookupOk = /seeds\s*=\s*\[\s*b"equipo"\s*,\s*taller\.key\(\)\.as_ref\(\)\s*,\s*id_equipo\.to_le_bytes\(\)\.as_ref\(\)\s*\]/.test(libRs);
const seedOrdenOk = /seeds\s*=\s*\[\s*b"orden"\s*,\s*equipo\.key\(\)\.as_ref\(\)\s*,\s*codigo\.as_bytes\(\)\s*\]/.test(libRs);
check(seedTallerOk && seedEquipoInitOk && seedEquipoLookupOk && seedOrdenOk, 'Semillas PDA extraidas de lib.rs (Taller, Equipo init/lookup, Orden)');

// 2. Validar scripts/contrato-idl.mjs y scripts/verificar-contrato.mjs
const contratoSrc = readFileSync(resolve(root, 'scripts/contrato-idl.mjs'), 'utf8');
const verificarSrc = readFileSync(resolve(root, 'scripts/verificar-contrato.mjs'), 'utf8');

check(/export\s+const\s+PROGRAMA\s*=\s*['"]taller['"]/.test(contratoSrc), "contrato-idl.mjs exporta PROGRAMA = 'taller'");
check(/export\s+const\s+REFERENCIA_ID\s*=\s*['"]38oTMyvUTmqkBQeMiuok5F2mPjp9dVadWdBeQTDNmTUY['"]/.test(contratoSrc), 'contrato-idl.mjs conserva REFERENCIA_ID original');
check(
  /export\s+function\s+prepararIdl/.test(contratoSrc) && /export\s+function\s+huellaIdl/.test(contratoSrc),
  'contrato-idl.mjs conserva prepararIdl y huellaIdl'
);
check(
  contratoSrc.includes("valor === 'publicKey' ? 'pubkey'") &&
    contratoSrc.includes("'vec:'") &&
    contratoSrc.includes("'option:'") &&
    contratoSrc.includes('array:') &&
    contratoSrc.includes("'defined:'"),
  'contrato-idl.mjs incluye tipo() ampliado para Anchor Legacy y 0.30+'
);

for (const [fn, args] of Object.entries(rustInstrucciones)) {
  const normFn = fn.replace(/_/g, '');
  const expectedNames = args.map((a) => `'${a.normalizado}'`).join(', ');
  const expectedTypes = args.map((a) => `'${a.tipo}'`).join(', ');
  check(
    contratoSrc.includes(`${normFn}: [${expectedNames}]`) && contratoSrc.includes(`${normFn}: [${expectedTypes}]`),
    `contrato-idl.mjs coincide en argumentos y tipos con ${fn}`
  );
}

check(
  contratoSrc.includes("['owner', 'pubkey']") &&
    contratoSrc.includes("['nombretaller', 'string']") &&
    contratoSrc.includes("['equipos', 'vec:pubkey']") &&
    contratoSrc.includes("['idcounter', 'u16']") &&
    contratoSrc.includes("['idequipo', 'u16']") &&
    contratoSrc.includes("['modelo', 'string']") &&
    contratoSrc.includes("['ordenesactivas', 'u16']") &&
    contratoSrc.includes("['ordenes', 'vec:pubkey']") &&
    contratoSrc.includes("['codigo', 'string']") &&
    contratoSrc.includes("['diagnostico', 'string']") &&
    contratoSrc.includes("['costo', 'u32']"),
  'contrato-idl.mjs camposEsperados coincide campo a campo con Taller, Equipo y Orden en lib.rs'
);

check(
  /import\s*\{\s*PROGRAMA\b/.test(verificarSrc) &&
    verificarSrc.includes("'clients/js/src/generated/programs/' + PROGRAMA + '.ts'") &&
    !verificarSrc.includes('registro.ts'),
  "verificar-contrato.mjs usa PROGRAMA + '.ts' sin referencia hardcoded a registro.ts"
);

// 3. Parsear todos los archivos .ts adaptados con node:module stripTypeScriptTypes
const tsFiles = [
  'src/config/interfaz.ts',
  'src/solana/pdas.ts',
  'src/solana/lecturas.ts',
  'src/solana/validaciones.ts',
  'src/solana/acciones.ts',
  'src/solana/seguridad.ts',
  'src/solana/tx.ts',
];

const contenidos = {};
for (const rel of tsFiles) {
  const abs = resolve(root, rel);
  if (!existsSync(abs)) {
    fail('Falta el archivo ' + rel);
    continue;
  }
  const src = readFileSync(abs, 'utf8');
  contenidos[rel] = src;
  try {
    const stripped = stripTypeScriptTypes(src, { mode: 'strip' });
    check(typeof stripped === 'string' && stripped.length > 0, `stripTypeScriptTypes OK: ${rel}`);
  } catch (err) {
    fail(`stripTypeScriptTypes fallo en ${rel}: ${err instanceof Error ? err.message : err}`);
  }
}

// 4. Verificacion byte-a-byte de src/solana/* y src/config/interfaz.ts contra lib.rs
const interfazSrc = contenidos['src/config/interfaz.ts'] ?? '';
check(
  interfazSrc.includes('TITULO_APP') && interfazSrc.includes('TALLER_INICIAL') && interfazSrc.includes('UNIDAD_COSTO'),
  'interfaz.ts exporta TITULO_APP, TALLER_INICIAL y UNIDAD_COSTO'
);

const pdasSrc = contenidos['src/solana/pdas.ts'] ?? '';
check(
  pdasSrc.includes('TALLER_PROGRAM_ADDRESS') &&
    !pdasSrc.includes('REGISTRO_PROGRAM_ADDRESS') &&
    /derivar\(\[\s*s\.texto\("taller"\)\s*,\s*s\.texto\(nombreTaller\)\s*,\s*s\.cuenta\(owner\)\s*\]\)/.test(pdasSrc) &&
    /derivar\(\[\s*s\.texto\("equipo"\)\s*,\s*s\.cuenta\(taller\)\s*,\s*s\.u16\(idEquipo\)\s*\]\)/.test(pdasSrc) &&
    /derivar\(\[\s*s\.texto\("orden"\)\s*,\s*s\.cuenta\(equipo\)\s*,\s*s\.texto\(codigo\)\s*\]\)/.test(pdasSrc) &&
    /export\s+function\s+cadena\(/.test(pdasSrc),
  'pdas.ts coincide byte a byte con las semillas PDA de lib.rs y usa TALLER_PROGRAM_ADDRESS'
);

const valSrc = contenidos['src/solana/validaciones.ts'] ?? '';
check(
  valSrc.includes('new TextEncoder().encode(limpio).length > maxBytes') &&
    valSrc.includes(`tallerValido = (valor: string) => texto(valor, 'El nombre del taller', ${maxNombreTaller})`) &&
    valSrc.includes(`modeloValido = (valor: string) => texto(valor, 'El modelo del equipo', ${maxModelo})`) &&
    valSrc.includes(`codigoValido = (valor: string) => texto(valor, 'El código de la orden', ${maxCodigo})`) &&
    valSrc.includes(`diagnosticoValido = (valor: string) => texto(valor, 'El diagnóstico', ${maxDiagnostico})`) &&
    valSrc.includes('idEquipoValido = (valor: number) => entero(valor, \'El identificador del equipo\', 65_535)') &&
    valSrc.includes('costoValido = (valor: number) => entero(valor, \'El costo\', 4_294_967_295)'),
  'validaciones.ts coincide con los limites UTF-8 #[max_len] y enteros u16/u32 de lib.rs'
);

const lectSrc = contenidos['src/solana/lecturas.ts'] ?? '';
check(
  lectSrc.includes(`MAX_EQUIPOS = ${maxEquipos}`) &&
    lectSrc.includes(`MAX_ORDENES = ${maxOrdenes}`) &&
    lectSrc.includes('fetchMaybeTaller') &&
    lectSrc.includes('fetchAllEquipo') &&
    lectSrc.includes('fetchAllOrden') &&
    lectSrc.includes('fetchMaybeEquipo') &&
    lectSrc.includes('export async function leerTaller(') &&
    lectSrc.includes('export async function siguienteId(') &&
    lectSrc.includes('export async function comprobarCupoOrdenes('),
  'lecturas.ts exporta MAX_EQUIPOS=10, MAX_ORDENES=10, leerTaller, siguienteId y comprobarCupoOrdenes'
);

const accSrc = contenidos['src/solana/acciones.ts'] ?? '';
check(
  accSrc.includes('getCrearTallerInstruction({ owner, taller, nombreTaller })') &&
    accSrc.includes('getRegistrarEquipoInstruction({ owner, taller, equipo, modelo })') &&
    /getCrearOrdenInstruction\(\{\s*owner,\s*taller,\s*equipo,\s*orden,\s*idEquipo,\s*codigo,\s*diagnostico,\s*costo,?\s*\}\)/.test(accSrc) &&
    /getCambiarCostoInstruction\(\{\s*owner,\s*taller,\s*equipo,\s*orden,\s*idEquipo,\s*codigo,\s*nuevoCosto,?\s*\}\)/.test(accSrc) &&
    /getCerrarOrdenInstruction\(\{\s*owner,\s*taller,\s*equipo,\s*orden,\s*idEquipo,\s*codigo,?\s*\}\)/.test(accSrc) &&
    accSrc.includes('await siguienteId(') &&
    accSrc.includes('await comprobarCupoOrdenes('),
  'acciones.ts invoca los 5 builders de Codama con cuentas explicitas, orden exacto y cupos previos'
);

const segSrc = contenidos['src/solana/seguridad.ts'] ?? '';
const txSrc = contenidos['src/solana/tx.ts'] ?? '';
check(
  segSrc.includes('TALLER_PROGRAM_ADDRESS') && !segSrc.includes('REGISTRO_PROGRAM_ADDRESS'),
  'seguridad.ts usa TALLER_PROGRAM_ADDRESS sin REGISTRO_PROGRAM_ADDRESS'
);
check(
  txSrc.includes('TALLER_PROGRAM_ADDRESS') &&
    !txSrc.includes('REGISTRO_PROGRAM_ADDRESS') &&
    txSrc.includes('codigo === 2006') &&
    txSrc.includes('codigo === 2001') &&
    txSrc.includes('codigo === 3004') &&
    txSrc.includes('ConstraintSeeds') &&
    txSrc.includes('AccountNotInitialized') &&
    txSrc.includes('already in use'),
  'tx.ts usa TALLER_PROGRAM_ADDRESS y traduce errores de dominio incluyendo 2006, 2001 y 3004'
);

// 5. Verificar componentes UI, Registro.tsx eliminado, CSS y archivos intocables
check(!existsSync(resolve(root, 'src/components/Registro.tsx')), 'src/components/Registro.tsx eliminado');

const cssSrc = readFileSync(resolve(root, 'src/index.css'), 'utf8');
const cssClassesDefined = new Set(Array.from(cssSrc.matchAll(/\.([a-zA-Z0-9_-]+)/g), (m) => m[1]));
// Clase estructural presente en el template original Registro.tsx aunque no tenga regla CSS propia en index.css
cssClassesDefined.add('customers-panel');

const uiFiles = [
  'src/components/Taller.tsx',
  'src/components/Icono.tsx',
  'src/components/Conexion.tsx',
  'src/App.tsx',
];

for (const rel of uiFiles) {
  const abs = resolve(root, rel);
  if (!existsSync(abs)) {
    fail('Falta el archivo UI ' + rel);
    continue;
  }
  const src = readFileSync(abs, 'utf8');
  check(!/REGISTRO_PROGRAM_ADDRESS|from\s+['"]\.\/components\/Registro['"]|leerRegistro|negocioValido/.test(src), `${rel} libre de imports o simbolos residuales de Registro`);
  const classMatches = Array.from(src.matchAll(/className\s*=\s*"([^"]+)"/g), (m) => m[1].split(/\s+/)).flat();
  const desconocidas = classMatches.filter((c) => c && !cssClassesDefined.has(c));
  check(desconocidas.length === 0, `${rel} usa solo clases CSS validas de src/index.css`, `${rel} contiene clases CSS no definidas en index.css: ${desconocidas.join(', ')}`);
}

const tallerTsx = readFileSync(resolve(root, 'src/components/Taller.tsx'), 'utf8');
const appTsx = readFileSync(resolve(root, 'src/App.tsx'), 'utf8');
const iconoTsx = readFileSync(resolve(root, 'src/components/Icono.tsx'), 'utf8');
const conexionTsx = readFileSync(resolve(root, 'src/components/Conexion.tsx'), 'utf8');

check(
  tallerTsx.includes('secuencia') &&
    tallerTsx.includes('contexto') &&
    tallerTsx.includes('permiteEscribir') &&
    tallerTsx.includes('crearTaller') &&
    tallerTsx.includes('registrarEquipo') &&
    tallerTsx.includes('crearOrden') &&
    tallerTsx.includes('cambiarCosto') &&
    tallerTsx.includes('cerrarOrden'),
  'Taller.tsx conserva guardas secuencia/contexto/permiteEscribir e integra las 5 acciones'
);
check(
  appTsx.includes("from './components/Taller'") &&
    appTsx.includes("'conexion' | 'taller'") &&
    appTsx.includes('TITULO_APP') &&
    iconoTsx.includes("'conexion' | 'taller' | 'vacio'") &&
    conexionTsx.includes('modificar el taller'),
  'App.tsx, Icono.tsx y Conexion.tsx adaptados al dominio taller'
);

// 6. Verificar archivos prohibidos de tocar mediante git diff --name-only
const intocables = new Set([
  'idl.json',
  'src/config/programa.json',
  'src/config/aula.json',
  'src/solana/seeds.ts',
  'src/solana/conexion.ts',
  'src/solana/saldo.ts',
  'src/main.tsx',
  'src/polyfills.ts',
  'src/index.css',
  'index.html',
  'scripts/generar-cliente.mjs',
  'scripts/configurar-idl.mjs',
  'scripts/preparar-clase.mjs',
  'vite.config.ts',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  'package.json',
  'package-lock.json',
]);
const prefijosIntocables = ['clients/js/', 'tests/', 'materiales/', 'programa/'];

const gitChanged = execFileSync('git', ['diff', '--name-only'], {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
})
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);

const violaciones = gitChanged.filter(
  (f) => intocables.has(f) || prefijosIntocables.some((pref) => f.startsWith(pref))
);
check(
  violaciones.length === 0,
  'Ningun archivo intocable del template fue modificado',
  'Archivos intocables modificados: ' + violaciones.join(', ')
);

check(!existsSync(resolve(root, 'node_modules')), 'node_modules no existe (R3 respetada)');

if (fallos > 0) {
  console.error(`\nResumen: ${fallos} verificacion(es) fallaron.`);
  process.exit(1);
}
console.log('\nResumen: Todas las verificaciones de consistencia pasaron correctamente.');
