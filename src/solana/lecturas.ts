import type { Address } from "@solana/kit";

import {
  fetchAllEquipo,
  fetchAllOrden,
  fetchMaybeEquipo,
  fetchMaybeTaller,
} from "../../clients/js/src/generated";
import { rpc } from "./conexion";
import { pdaEquipo, pdaTaller } from "./pdas";

/*
LECTURAS

Leer no necesita wallet ni firma: solo el rpc.
fetchX devuelve { address, data, lamports... } y los campos de la cuenta
estan dentro de .data, nunca sueltos en la raiz.
*/

export const MAX_EQUIPOS = 10;
export const MAX_ORDENES = 10;

export type OrdenUI = {
  direccion: Address;
  codigo: string;
  diagnostico: string;
  costo: number;
};

export type EquipoUI = {
  direccion: Address;
  idEquipo: number;
  modelo: string;
  ordenesActivas: number;
  ordenes: OrdenUI[];
};

export type TallerUI = {
  direccion: Address;
  nombreTaller: string;
  idCounter: number;
  equipos: EquipoUI[];
};

/*
Tres niveles de cuentas, tres niveles de lectura: el taller guarda las
direcciones de sus equipos, y cada equipo las de sus ordenes.
fetchMaybe... no lanza si la cuenta no existe: devuelve exists: false.
*/
export async function leerTaller(
  nombreTaller: string,
  owner: Address
): Promise<TallerUI | null> {
  const direccion = pdaTaller(nombreTaller, owner);
  const cuenta = await fetchMaybeTaller(rpc, direccion);

  if (!cuenta.exists) return null;

  const equipos = await fetchAllEquipo(rpc, cuenta.data.equipos);

  const conOrdenes = await Promise.all(
    equipos.map(async (e) => {
      const ordenes = await fetchAllOrden(rpc, e.data.ordenes);
      return {
        direccion: e.address,
        idEquipo: e.data.idEquipo,
        modelo: e.data.modelo,
        ordenesActivas: e.data.ordenesActivas,
        ordenes: ordenes.map((o) => ({
          direccion: o.address,
          codigo: o.data.codigo,
          diagnostico: o.data.diagnostico,
          costo: o.data.costo,
        })),
      };
    })
  );

  return {
    direccion,
    nombreTaller: cuenta.data.nombreTaller,
    idCounter: cuenta.data.idCounter,
    equipos: conOrdenes,
  };
}

/*
El id del equipo nuevo sale del contador del taller.

El programa es quien lo asigna; esta lectura no se lo manda. Hace falta porque
el id entra en las semillas, y una transaccion de Solana declara por adelantado
todas las cuentas que va a tocar: hay que saber la direccion ANTES de firmar.
*/
export async function siguienteId(
  nombreTaller: string,
  owner: Address
): Promise<number> {
  const cuenta = await fetchMaybeTaller(rpc, pdaTaller(nombreTaller, owner));
  if (!cuenta.exists) throw new Error("Ese taller no existe todavía.");
  if (cuenta.data.equipos.length >= MAX_EQUIPOS) {
    throw new Error("El taller alcanzó el límite máximo de 10 equipos registrados.");
  }
  if (cuenta.data.idCounter >= 65_535) {
    throw new Error("Se agotaron los identificadores u16 del taller.");
  }
  return cuenta.data.idCounter + 1;
}

/*
Comprueba el cupo de ordenes antes de firmar para evitar fallos en runtime o 3004.
*/
export async function comprobarCupoOrdenes(
  nombreTaller: string,
  owner: Address,
  idEquipo: number
): Promise<void> {
  const taller = pdaTaller(nombreTaller, owner);
  const equipo = pdaEquipo(taller, idEquipo);
  const cuenta = await fetchMaybeEquipo(rpc, equipo);
  if (!cuenta.exists) throw new Error("Ese equipo no existe todavía en este taller.");
  if (cuenta.data.ordenes.length >= MAX_ORDENES) {
    throw new Error("El equipo alcanzó el límite máximo de 10 órdenes activas.");
  }
}
