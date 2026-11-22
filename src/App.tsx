import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Conexion } from './components/Conexion';
import { Taller } from './components/Taller';
import { Icono } from './components/Icono';
import aula from './config/aula.json';
import programa from './config/programa.json';
import { ENDPOINT } from './solana/conexion';

export default function App() {
  const [vista, setVista] = useState<'conexion' | 'taller'>(aula.pantallaInicial === 'conexion' ? 'conexion' : 'taller');
  const [revision, setRevision] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const { publicKey } = useWallet();
  const soloDia3 = aula.modo === 'dia3';
  return <div className="app-layout">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={(e) => e.preventDefault()}><img className="brand-mark" src="/favicon.svg" alt="" width={37} height={37} /><span>FixChain<span className="brand-caption">SERVICE LEDGER · SOLANA</span></span></a>
      <p className="sidebar-label">OPERACIONES</p>
      <nav aria-label="Secciones de la aplicación">
        <button className={vista === 'conexion' ? 'nav-item selected' : 'nav-item'} disabled={ocupado} onClick={() => setVista('conexion')}><Icono tipo="conexion" /> Conexión</button>
        <button className={vista === 'taller' ? 'nav-item selected' : 'nav-item'} disabled={ocupado || soloDia3} onClick={() => setVista('taller')}><Icono tipo="taller" /> Taller de servicio{soloDia3 && <small>Día 4</small>}</button>
      </nav>
      <div className="sidebar-bottom"><p>FixChain Devnet</p><span>Trazabilidad de reparaciones on-chain</span><a href="https://github.com/ema28pro/Taller-Servicio-Solana-App" target="_blank" rel="noreferrer">Repositorio en GitHub</a></div>
    </aside>
    <div className="main-area">
      <header className="hero-topbar">
        <img className="hero-topbar-img" src="/banner-fixchain.jpg" alt="FixChain — Taller de Servicio Técnico en Solana" />
        <div className="hero-topbar-content">
          <div className="hero-topbar-left">
            <p className="hero-tagline">Gestión de talleres, equipos y órdenes de reparación</p>
          </div>
          <div className="hero-wallet-wrap">
            <WalletMultiButton>{publicKey ? publicKey.toBase58().slice(0, 4) + '…' + publicKey.toBase58().slice(-4) : 'Conectar wallet'}</WalletMultiButton>
          </div>
        </div>
      </header>
      <main>
        {vista === 'conexion' ? <Conexion revision={revision} /> : <Taller onCambio={() => setRevision((valor) => valor + 1)} onOcupado={setOcupado} />}
        <footer className="app-footer"><span>RPC: {new URL(ENDPOINT).hostname}</span><details><summary>{programa.esReferencia ? 'Programa de referencia' : 'Programa configurado'}</summary><code className="address">{programa.programId}</code></details></footer>
      </main>
    </div>
  </div>;
}
