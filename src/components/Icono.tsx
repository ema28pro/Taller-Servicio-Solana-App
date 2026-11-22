export function Icono({ tipo }: { tipo: 'conexion' | 'taller' | 'vacio' }) {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {tipo === 'conexion' ? <><path d="M7 17 17 7M7 7h10v10" /><path d="M5 12v7h7" /></> : tipo === 'taller' ? <><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" /></> : <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>}
  </svg>;
}
