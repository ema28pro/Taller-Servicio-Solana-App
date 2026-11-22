export function texto(valor: string, etiqueta: string, maxBytes: number): string {
  const limpio = valor.trim();
  if (!limpio) throw new Error(etiqueta + ' es obligatorio.');
  if (new TextEncoder().encode(limpio).length > maxBytes) {
    throw new Error(etiqueta + ' admite hasta ' + maxBytes + ' bytes UTF-8.');
  }
  return limpio;
}

export function entero(valor: number, etiqueta: string, maximo: number): number {
  if (!Number.isSafeInteger(valor) || valor < 1 || valor > maximo) {
    throw new Error(etiqueta + ' debe ser un entero entre 1 y ' + maximo + '.');
  }
  return valor;
}

export const tallerValido = (valor: string) => texto(valor, 'El nombre del taller', 30);
export const modeloValido = (valor: string) => texto(valor, 'El modelo del equipo', 30);
export const codigoValido = (valor: string) => texto(valor, 'El código de la orden', 8);
export const diagnosticoValido = (valor: string) => texto(valor, 'El diagnóstico', 50);
export const idEquipoValido = (valor: number) => entero(valor, 'El identificador del equipo', 65_535);
export const costoValido = (valor: number) => entero(valor, 'El costo', 4_294_967_295);
