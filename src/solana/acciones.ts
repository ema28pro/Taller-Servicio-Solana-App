import { address, createNoopSigner, type Address } from '@solana/kit';
import type { Connection } from '@solana/web3.js';
import {
  getCrearTallerInstruction,
  getRegistrarEquipoInstruction,
  getCrearOrdenInstruction,
  getCambiarCostoInstruction,
  getCerrarOrdenInstruction,
} from '../../clients/js/src/generated';
import { cadena, pdaEquipo, pdaTaller } from './pdas';
import { comprobarCupoOrdenes, siguienteId } from './lecturas';
import { enviar, type WalletFirma, type OpcionesEnvio } from './tx';
import { comprobarConfiguracion } from './seguridad';
import {
  tallerValido,
  modeloValido,
  codigoValido,
  diagnosticoValido,
  idEquipoValido,
  costoValido,
} from './validaciones';

export function direccionDe(wallet: Pick<WalletFirma, 'publicKey'>): Address {
  if (!wallet.publicKey) throw new Error('Conecta tu wallet primero.');
  return address(wallet.publicKey.toBase58());
}

function firmante(wallet: WalletFirma) {
  comprobarConfiguracion();
  // Representa la identidad que la wallet firmará después; no contiene claves.
  // Los roles finales los establece el builder generado del cliente actual.
  return createNoopSigner(direccionDe(wallet));
}

export async function crearTaller(
  wallet: WalletFirma,
  connection: Connection,
  nombreTaller: string,
  opciones?: OpcionesEnvio
): Promise<string> {
  nombreTaller = tallerValido(nombreTaller);
  const owner = firmante(wallet);
  const taller = pdaTaller(nombreTaller, owner.address);
  const ix = getCrearTallerInstruction({ owner, taller, nombreTaller });
  return enviar(ix, wallet, connection, opciones);
}

export async function registrarEquipo(
  wallet: WalletFirma,
  connection: Connection,
  nombreTaller: string,
  modelo: string,
  opciones?: OpcionesEnvio
): Promise<string> {
  nombreTaller = tallerValido(nombreTaller);
  modelo = modeloValido(modelo);
  const owner = firmante(wallet);
  const taller = pdaTaller(nombreTaller, owner.address);
  const id = await siguienteId(nombreTaller, owner.address);
  const equipo = pdaEquipo(taller, id);
  const ix = getRegistrarEquipoInstruction({ owner, taller, equipo, modelo });
  return enviar(ix, wallet, connection, opciones);
}

export async function crearOrden(
  wallet: WalletFirma,
  connection: Connection,
  nombreTaller: string,
  idEquipo: number,
  codigo: string,
  diagnostico: string,
  costo: number,
  opciones?: OpcionesEnvio
): Promise<string> {
  nombreTaller = tallerValido(nombreTaller);
  idEquipo = idEquipoValido(idEquipo);
  codigo = codigoValido(codigo);
  diagnostico = diagnosticoValido(diagnostico);
  costo = costoValido(costo);
  const owner = firmante(wallet);
  await comprobarCupoOrdenes(nombreTaller, owner.address, idEquipo);
  const { taller, equipo, orden } = cadena(nombreTaller, owner.address, idEquipo, codigo);
  const ix = getCrearOrdenInstruction({
    owner,
    taller,
    equipo,
    orden,
    idEquipo,
    codigo,
    diagnostico,
    costo,
  });
  return enviar(ix, wallet, connection, opciones);
}

export async function cambiarCosto(
  wallet: WalletFirma,
  connection: Connection,
  nombreTaller: string,
  idEquipo: number,
  codigo: string,
  nuevoCosto: number,
  opciones?: OpcionesEnvio
): Promise<string> {
  nombreTaller = tallerValido(nombreTaller);
  idEquipo = idEquipoValido(idEquipo);
  codigo = codigoValido(codigo);
  nuevoCosto = costoValido(nuevoCosto);
  const owner = firmante(wallet);
  const { taller, equipo, orden } = cadena(nombreTaller, owner.address, idEquipo, codigo);
  const ix = getCambiarCostoInstruction({
    owner,
    taller,
    equipo,
    orden,
    idEquipo,
    codigo,
    nuevoCosto,
  });
  return enviar(ix, wallet, connection, opciones);
}

export async function cerrarOrden(
  wallet: WalletFirma,
  connection: Connection,
  nombreTaller: string,
  idEquipo: number,
  codigo: string,
  opciones?: OpcionesEnvio
): Promise<string> {
  nombreTaller = tallerValido(nombreTaller);
  idEquipo = idEquipoValido(idEquipo);
  codigo = codigoValido(codigo);
  const owner = firmante(wallet);
  const { taller, equipo, orden } = cadena(nombreTaller, owner.address, idEquipo, codigo);
  const ix = getCerrarOrdenInstruction({
    owner,
    taller,
    equipo,
    orden,
    idEquipo,
    codigo,
  });
  return enviar(ix, wallet, connection, opciones);
}
