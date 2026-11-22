import { useEffect, useRef, useState } from 'react';
import { address } from '@solana/kit';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import programa from '../config/programa.json';
import { TALLER_INICIAL, UNIDAD_COSTO } from '../config/interfaz';
import { leerTaller, type TallerUI } from '../solana/lecturas';
import { tallerValido } from '../solana/validaciones';
import { ErrorTransaccion, ErrorConfirmacionPendiente, enlaceTransaccion, traducir, type OpcionesEnvio } from '../solana/tx';
import { crearTaller, registrarEquipo, crearOrden, cambiarCosto, cerrarOrden } from '../solana/acciones';

type Operacion = 'taller' | 'equipo' | 'orden' | 'costo' | 'cerrar';
const operaciones: { id: Operacion; texto: string }[] = [
  { id: 'taller', texto: 'Crear taller' },
  { id: 'equipo', texto: 'Registrar equipo' },
  { id: 'orden', texto: 'Crear orden' },
  { id: 'costo', texto: 'Cambiar costo' },
  { id: 'cerrar', texto: 'Cerrar orden' },
];

export function Taller({ onCambio, onOcupado }: { onCambio: () => void; onOcupado: (valor: boolean) => void }) {
  const wallet = useWallet();
  const { connection } = useConnection();
  const walletDireccion = wallet.publicKey?.toBase58() ?? '';
  const [nombreTaller, setNombreTaller] = useState(TALLER_INICIAL);
  const [autoridad, setAutoridad] = useState(walletDireccion);
  const [taller, setTaller] = useState<TallerUI | null>(null);
  const [consultado, setConsultado] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [errorLectura, setErrorLectura] = useState('');
  const [op, setOp] = useState<Operacion>('taller');
  const [modelo, setModelo] = useState('Laptop Dell XPS');
  const [idEquipo, setIdEquipo] = useState('1');
  const [codigo, setCodigo] = useState('ORD01');
  const [diagnostico, setDiagnostico] = useState('Cambio de pasta termica');
  const [costo, setCosto] = useState('150');
  const [ocupado, setOcupado] = useState(false);
  const [fase, setFase] = useState('');
  const [firma, setFirma] = useState('');
  const [firmaFallida, setFirmaFallida] = useState('');
  const [errorOperacion, setErrorOperacion] = useState('');
  const [aviso, setAviso] = useState('');
  const contexto = useRef('');
  const secuencia = useRef(0);
  contexto.current = nombreTaller + '|' + autoridad;

  useEffect(() => { setAutoridad(walletDireccion); }, [walletDireccion]);
  useEffect(() => {
    secuencia.current += 1; setTaller(null); setConsultado(false); setErrorLectura('');
    setLeyendo(false); setFirma(''); setFirmaFallida(''); setErrorOperacion(''); setAviso('');
  }, [nombreTaller, autoridad]);
  useEffect(() => { onOcupado(ocupado); return () => onOcupado(false); }, [ocupado, onOcupado]);

  async function cargar(nombre = nombreTaller, owner = autoridad) {
    const clave = nombre + '|' + owner;
    const turno = ++secuencia.current;
    setLeyendo(true); setErrorLectura('');
    try {
      const datos = await leerTaller(tallerValido(nombre), address(owner.trim()));
      if (turno === secuencia.current && contexto.current === clave) { setTaller(datos); setConsultado(true); }
    } catch (error) {
      if (turno === secuencia.current) setErrorLectura(traducir(error));
      throw error;
    } finally { if (turno === secuencia.current) setLeyendo(false); }
  }

  async function ejecutar(evento: React.FormEvent) {
    evento.preventDefault();
    setOcupado(true); setFase('Preparando operación…'); setFirma(''); setFirmaFallida(''); setErrorOperacion(''); setAviso('');
    const nombre = nombreTaller.trim();
    const direccionWallet = walletDireccion;
    const opciones: OpcionesEnvio = { onEstado: (estado) => setFase(estado === 'firma' ? 'Revisa la solicitud en tu wallet…' : 'Esperando confirmación de la red…') };
    try {
      const id = Number(idEquipo), importe = Number(costo);
      let resultado: string;
      switch (op) {
        case 'taller': resultado = await crearTaller(wallet, connection, nombre, opciones); break;
        case 'equipo': resultado = await registrarEquipo(wallet, connection, nombre, modelo, opciones); break;
        case 'orden': resultado = await crearOrden(wallet, connection, nombre, id, codigo, diagnostico, importe, opciones); break;
        case 'costo': resultado = await cambiarCosto(wallet, connection, nombre, id, codigo, importe, opciones); break;
        case 'cerrar': resultado = await cerrarOrden(wallet, connection, nombre, id, codigo, opciones); break;
      }
      setFirma(resultado); setFase('Operación confirmada correctamente.'); onCambio();
      try { await cargar(nombre, direccionWallet); }
      catch { setAviso('La operación se confirmó, pero no pudimos actualizar los datos. Pulsa Consultar taller para volver a leerlos.'); }
    } catch (error) {
      setFase(''); setErrorOperacion(traducir(error));
      if (error instanceof ErrorTransaccion || error instanceof ErrorConfirmacionPendiente) setFirmaFallida(error.firma);
    } finally { setOcupado(false); }
  }

  const esOtraAutoridad = !!autoridad.trim() && autoridad.trim() !== walletDireccion;
  const permiteEscribir = !programa.esReferencia && !!wallet.publicKey && !esOtraAutoridad;
  return <>
    <div className="section-heading"><div><p className="eyebrow">TALLER · EQUIPOS · ÓRDENES</p><h2>Tu taller de servicio</h2></div><span className="tag">Cuentas independientes</span></div>
    {programa.esReferencia && <aside className="notice information"><strong>Configura tu programa para comenzar.</strong><p>La aplicación incluye un IDL de referencia. Importa el exportado de tu despliegue para consultar el taller y realizar operaciones. Las lecturas de saldo ya están disponibles en Conexión.</p></aside>}
    <section className="panel lookup-panel">
      <div className="panel-heading"><h3>Localizar el taller</h3><span className="small-note">Lectura sin firma</span></div>
      <div className="lookup-fields"><label>Nombre exacto del taller<input value={nombreTaller} disabled={ocupado} onChange={(e) => setNombreTaller(e.target.value)} placeholder={TALLER_INICIAL} /></label>
      <label>Dirección de la autoridad<input value={autoridad} disabled={ocupado} onChange={(e) => setAutoridad(e.target.value)} placeholder="Conecta tu wallet o pega una dirección pública" spellCheck={false} autoComplete="off" /></label>
      <button className="button secondary" disabled={leyendo || ocupado || programa.esReferencia || !nombreTaller.trim() || !autoridad.trim()} onClick={() => void cargar().catch(() => {})}>{leyendo ? 'Consultando…' : 'Consultar taller'}</button></div>
      <p className="help">El nombre y la autoridad determinan la dirección del taller. Puedes consultar otra autoridad en modo lectura.</p>
      {errorLectura && <p className="notice error" role="alert">{errorLectura}</p>}
    </section>
    <div className="workspace-grid">
      <section className="panel customers-panel"><div className="panel-heading"><h3>Equipos y órdenes</h3>{taller && <span className="count">{taller.equipos.length} equipos</span>}</div>
        {!taller ? <div className="empty-state"><span className="empty-symbol">◎</span><h4>{consultado ? 'El taller todavía no existe' : 'El taller aparecerá aquí'}</h4><p>{consultado ? 'Comprueba el nombre y la autoridad, o crea un taller con tu wallet conectada.' : 'Consulta el taller para ver sus equipos y las órdenes activas de cada uno.'}</p></div> : <>
          <div className="registry-summary"><div><span className="label">Taller</span><strong>{taller.nombreTaller}</strong></div><div><span className="label">Último ID asignado</span><strong>{taller.idCounter}</strong></div></div>
          <details className="technical-details"><summary>Dirección del taller</summary><code className="address">{taller.direccion}</code></details>
          {taller.equipos.length === 0 ? <p className="empty-line">Todavía no hay equipos. Puedes registrar el primero desde Operaciones.</p> : taller.equipos.map((equipo) => <article className="customer" key={equipo.direccion}>
            <header><div><strong>{equipo.modelo}</strong><span className="small-note">Equipo #{equipo.idEquipo} · {equipo.ordenesActivas} órdenes activas</span></div><button className="text-button" disabled={ocupado} onClick={() => { setIdEquipo(String(equipo.idEquipo)); setOp('orden'); }}>Seleccionar</button></header>
            {equipo.ordenes.length === 0 ? <p className="empty-line">Sin órdenes activas.</p> : <div className="table-wrap"><table><thead><tr><th>Código</th><th>Diagnóstico</th><th className="numeric">Costo</th></tr></thead><tbody>{equipo.ordenes.map((orden) => <tr key={orden.direccion} onClick={() => { if (!ocupado) { setIdEquipo(String(equipo.idEquipo)); setCodigo(orden.codigo); setCosto(String(orden.costo)); setOp('costo'); } }}><td><code>{orden.codigo}</code></td><td>{orden.diagnostico}</td><td className="numeric">{orden.costo.toLocaleString('es-MX')} <small>{UNIDAD_COSTO}</small></td></tr>)}</tbody></table></div>}
          </article>)}
        </>}
      </section>
      <section className="panel operations-panel"><div className="panel-heading"><h3>Operaciones</h3><span className="small-note">Con firma</span></div>
        <div className="operation-tabs">{operaciones.map((item) => <button key={item.id} className={op === item.id ? 'active' : ''} disabled={ocupado} onClick={() => { setOp(item.id); setFirma(''); setErrorOperacion(''); setFirmaFallida(''); setFase(''); }}>{item.texto}</button>)}</div>
        <form onSubmit={ejecutar}>
          <fieldset disabled={ocupado || !permiteEscribir}>
            {op === 'taller' && <p className="help">Crearás un taller llamado <strong>{nombreTaller || 'tu taller'}</strong> con la wallet conectada como autoridad.</p>}
            {op === 'equipo' && <label>Modelo del equipo<input value={modelo} onChange={(e) => setModelo(e.target.value)} required /></label>}
            {(op === 'orden' || op === 'costo' || op === 'cerrar') && <div className="two-fields"><label>ID del equipo<input type="number" min="1" max="65535" step="1" value={idEquipo} onChange={(e) => setIdEquipo(e.target.value)} required /></label><label>Código de orden<input value={codigo} onChange={(e) => setCodigo(e.target.value)} required /></label></div>}
            {op === 'orden' && <label>Diagnóstico<input value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} required /></label>}
            {(op === 'orden' || op === 'costo') && <label>{op === 'costo' ? 'Nuevo costo' : 'Costo'}<input type="number" min="1" max="4294967295" step="1" value={costo} onChange={(e) => setCosto(e.target.value)} required /><span className="help">Unidades enteras sin decimales. No representa una transferencia de SOL.</span></label>}
            {op === 'cerrar' && <p className="notice subtle">Esta operación quita la orden del equipo, cierra su cuenta devolviendo el rent al owner y libera el código para poder reutilizarlo.</p>}
            <button className="button primary" type="submit" disabled={!nombreTaller.trim()}>{ocupado ? 'Operación en curso…' : operaciones.find((item) => item.id === op)!.texto}</button>
          </fieldset>
        </form>
        {!wallet.publicKey && <p className="help">Conecta tu wallet de práctica para realizar operaciones.</p>}
        {esOtraAutoridad && wallet.publicKey && <p className="notice subtle">Estás consultando otra autoridad. Para escribir, utiliza el taller de la wallet conectada.</p>}
        {ocupado && <p className="notice information" role="status">{fase}</p>}
        {firma && <p className="notice success" role="status"><strong>Operación confirmada.</strong><br/><a href={enlaceTransaccion(firma)} target="_blank" rel="noreferrer">Ver transacción en Explorer</a></p>}
        {errorOperacion && <p className="notice error" role="alert">{errorOperacion}{firmaFallida && <><br/><a href={enlaceTransaccion(firmaFallida)} target="_blank" rel="noreferrer">Revisar transacción en Explorer</a></>}</p>}
        {aviso && <p className="notice subtle">{aviso}</p>}
      </section>
    </div>
  </>;
}
