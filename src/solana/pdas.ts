import { address, type Address } from "@solana/kit";
import { PublicKey } from "@solana/web3.js";

import { TALLER_PROGRAM_ADDRESS } from "../../clients/js/src/generated";
import { s } from "./seeds";

/*
DERIVACION DE PDAs

El Program ID sale del cliente generado, que a su vez lo saco de TU idl.json.
No hay ninguna direccion escrita a mano en el proyecto.

findProgramAddressSync devuelve un PublicKey (web3.js) y el cliente de Codama
espera un Address (@solana/kit). derivar() hace esa conversion en un solo lugar,
para que el resto del codigo trabaje con un solo tipo.
*/
const PROGRAM_ID = new PublicKey(TALLER_PROGRAM_ADDRESS);

function derivar(semillas: Buffer[]): Address {
  const [pda] = PublicKey.findProgramAddressSync(semillas, PROGRAM_ID);
  return address(pda.toBase58());
}

// Rust: seeds = [b"taller", nombre_taller.as_bytes(), owner.key().as_ref()]
export function pdaTaller(nombreTaller: string, owner: Address) {
  return derivar([s.texto("taller"), s.texto(nombreTaller), s.cuenta(owner)]);
}

// Rust: seeds = [b"equipo", taller.key().as_ref(), id_equipo.to_le_bytes().as_ref()]
export function pdaEquipo(taller: Address, idEquipo: number) {
  return derivar([s.texto("equipo"), s.cuenta(taller), s.u16(idEquipo)]);
}

// Rust: seeds = [b"orden", equipo.key().as_ref(), codigo.as_bytes()]
export function pdaOrden(equipo: Address, codigo: string) {
  return derivar([s.texto("orden"), s.cuenta(equipo), s.texto(codigo)]);
}

/*
Las tres instrucciones de orden necesitan las tres cuentas, porque el programa
valida la cadena completa en el contexto. Derivarlas de una vez evita repetir
el mismo bloque.
*/
export function cadena(
  nombreTaller: string,
  owner: Address,
  idEquipo: number,
  codigo: string
) {
  const taller = pdaTaller(nombreTaller, owner);
  const equipo = pdaEquipo(taller, idEquipo);
  const orden = pdaOrden(equipo, codigo);
  return { taller, equipo, orden };
}
