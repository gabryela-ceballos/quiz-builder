import { useState, useEffect } from 'react';
import { Globe, Trash2, RefreshCw, Check, AlertCircle, Copy, ExternalLink, Loader2, Plus, Info } from 'lucide-react';
import { getDomains, addDomain, removeDomain, verifyDomain, getServerInfo } from '../hooks/useQuizStore';

export default function DomainSettings({ quizId }) {
    const [domains, setDomains] = useState([]);
    const [newDomain, setNewDomain] = useState('');
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [serverHostname, setServerHostname] = useState('');
    const [showInstructions, setShowInstructions] = useState(false);
    const [copied, setCopied] = useState(false);
    const [searchDomain, setSearchDomain] = useState('');
    const [showBuySection, setShowBuySection] = useState(true);

    // Affiliate registrar links (replace URLs with your affiliate links)
    const REGISTRARS = [
        { name: 'Namecheap', emoji: '🟠', color: '#FF5722', searchUrl: (d) => `https://www.namecheap.com/domains/registration/results/?domain=${d}`, desc: 'Preços baixos, SSL grátis', popular: true },
        { name: 'GoDaddy', emoji: '🟢', color: '#00A4A6', searchUrl: (d) => `https://www.godaddy.com/domainsearch/find?domainToCheck=${d}`, desc: 'Mais popular do mundo' },
        { name: 'Registro.br', emoji: '🇧🇷', color: '#009c3b', searchUrl: (d) => `https://registro.br/busca-dominio/?fqdn=${d}`, desc: 'Domínios .com.br', popular: true },
        { name: 'Hostinger', emoji: '🟣', color: '#673DE6', searchUrl: (d) => `https://www.hostinger.com.br/verificador-de-dominio?domain=${d}`, desc: 'Barato + hospedagem' },
        { name: 'Cloudflare', emoji: '🟡', color: '#F48120', searchUrl: (d) => `https://www.cloudflare.com/products/registrar/`, desc: 'Preço de custo, sem markup' },
    ];

    useEffect(() => {
        if (quizId) {
            loadDomains();
            getServerInfo().then(info => setServerHostname(info.hostname || 'seu-servidor.com'));
        }
    }, [quizId]);

    const loadDomains = async () => { const data = await getDomains(quizId); setDomains(data); };

    const handleAdd = async () => {
        if (!newDomain.trim()) return;
        setLoading(true); setError(''); setSuccess('');
        const result = await addDomain(quizId, newDomain.trim());
        setLoading(false);
        if (result.error) { setError(result.error); }
        else { setSuccess('Domínio adicionado! Configure o CNAME e depois clique em "Verificar DNS".'); setNewDomain(''); setShowInstructions(true); await loadDomains(); }
    };

    const handleRemove = async (id) => { if (!confirm('Remover este domínio?')) return; await removeDomain(id); await loadDomains(); };

    const handleVerify = async (id) => {
        setVerifying(id); setError(''); setSuccess('');
        const result = await verifyDomain(id);
        setVerifying(null);
        if (result.status === 'verified') setSuccess(result.message);
        else setError(result.message);
        await loadDomains();
    };

    const copyHostname = () => { navigator.clipboard.writeText(serverHostname); setCopied(true); setTimeout(() => setCopied(false), 2000); };

    const statusBadge = (status) => {
        const styles = {
            verified: { bg: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.2)', icon: '🟢', label: 'Verificado' },
            pending: { bg: 'rgba(245,158,11,0.1)', color: '#d97706', border: '1px solid rgba(245,158,11,0.2)', icon: '🟡', label: 'Pendente' },
            error: { bg: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)', icon: '🔴', label: 'Erro DNS' },
        };
        const s = styles[status] || styles.pending;
        return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, border: s.border, fontSize: '0.72rem', fontWeight: 600 }}>{s.icon} {s.label}</span>;
    };

    const cleanDomain = searchDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '') || 'meuquiz.com.br';

    return (
        <div>
            {/* ═══ SECTION 1: BUY DOMAIN ═══ */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #f59e0b, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: 18 }}>🛒</span>
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1rem' }}>Comprar Domínio</h3>
                            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Ainda não tem domínio? Compre em um registrador parceiro</p>
                        </div>
                    </div>
                    <button onClick={() => setShowBuySection(!showBuySection)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--primary)' }}>
                        {showBuySection ? 'Ocultar ▲' : 'Mostrar ▼'}
                    </button>
                </div>

                {showBuySection && (
                    <>
                        {/* Domain search */}
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input className="input" placeholder="Digite o domínio que deseja... ex: meuquiz.com.br" value={searchDomain} onChange={e => setSearchDomain(e.target.value)} style={{ flex: 1, fontSize: '0.9rem' }} />
                            </div>
                            {searchDomain && (
                                <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                    🔍 Buscando: <strong style={{ color: 'var(--text-primary)' }}>{cleanDomain}</strong>
                                </div>
                            )}
                        </div>

                        {/* Registrar cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
                            {REGISTRARS.map(r => (
                                <a key={r.name} href={r.searchUrl(cleanDomain)} target="_blank" rel="noopener noreferrer"
                                    style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                        padding: '16px 12px', borderRadius: 12,
                                        background: '#f9fafb', border: '1px solid var(--border)',
                                        cursor: 'pointer', textDecoration: 'none', color: 'inherit',
                                        transition: 'all 0.15s', position: 'relative',
                                    }}
                                    onMouseOver={e => { e.currentTarget.style.borderColor = r.color; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 12px ${r.color}20`; }}
                                    onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                                >
                                    {r.popular && <span style={{ position: 'absolute', top: 6, right: 8, fontSize: '0.55rem', background: r.color + '15', color: r.color, padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>POPULAR</span>}
                                    <span style={{ fontSize: 24 }}>{r.emoji}</span>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{r.name}</span>
                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center' }}>{r.desc}</span>
                                    <span style={{ fontSize: '0.7rem', color: r.color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                        Buscar domínio <ExternalLink size={10} />
                                    </span>
                                </a>
                            ))}
                        </div>

                        <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', fontSize: '0.75rem', color: '#92400e' }}>
                            💡 Após comprar o domínio, volte aqui e configure-o na seção <strong>"Configurar Domínio"</strong> abaixo
                        </div>
                    </>
                )}
            </div>

            {/* ═══ SECTION 2: CONFIGURE DOMAIN ═══ */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Globe size={18} color="#fff" />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1rem' }}>Configurar Domínio</h3>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Conecte um domínio que você já possui ao quiz</p>
                    </div>
                </div>

                {/* Add domain form */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <input className="input" placeholder="meuquiz.com.br" value={newDomain} onChange={e => setNewDomain(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} style={{ flex: 1, fontSize: '0.9rem' }} />
                    <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={loading || !newDomain.trim()} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                        {loading ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Adicionar
                    </button>
                </div>

                {/* Messages */}
                {error && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, marginBottom: 12, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#dc2626', fontSize: '0.82rem' }}>
                        <AlertCircle size={14} /> {error}
                    </div>
                )}
                {success && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, marginBottom: 12, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', color: '#059669', fontSize: '0.82rem' }}>
                        <Check size={14} /> {success}
                    </div>
                )}

                {/* Instructions */}
                <button onClick={() => setShowInstructions(!showInstructions)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '0.82rem', fontWeight: 500, padding: '4px 0', marginBottom: 12 }}>
                    <Info size={14} /> {showInstructions ? 'Ocultar instruções' : 'Como configurar meu domínio?'}
                </button>

                {showInstructions && (
                    <div style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12, padding: 16, marginBottom: 16, fontSize: '0.82rem', lineHeight: 1.7 }}>
                        <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>📋 Passo a passo:</div>
                        <ol style={{ margin: 0, paddingLeft: 18 }}>
                            <li>Compre seu domínio (use a seção acima)</li>
                            <li>Acesse o painel DNS do seu domínio no registrador (Hostinger, Namecheap, GoDaddy, etc.)</li>
                            <li>
                                <strong style={{ color: '#dc2626' }}>⚠️ IMPORTANTE:</strong> Verifique se os <strong>Nameservers</strong> do domínio estão configurados corretamente.
                                <div style={{ marginTop: 6, marginBottom: 6, padding: '10px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', fontSize: '0.78rem', color: '#991b1b' }}>
                                    🚨 Se o domínio estiver usando nameservers de <strong>"parking"</strong> (ex: <code style={{ background: '#fef2f2', padding: '1px 4px', borderRadius: 3 }}>ns1.dns-parking.com</code>), suas configurações DNS <strong>não funcionarão</strong>. Troque para os nameservers reais do seu registrador.
                                </div>
                            </li>
                            <li>
                                Crie um registro <strong>CNAME</strong> (ou <strong>ALIAS</strong> para domínio raiz) apontando para:
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 6, background: '#f1f5f9', borderRadius: 8, padding: '8px 12px', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                    <span style={{ flex: 1, wordBreak: 'break-all' }}>{serverHostname}</span>
                                    <button onClick={copyHostname} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center', padding: 4 }}>
                                        {copied ? <Check size={14} /> : <Copy size={14} />}
                                    </button>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                                    📌 Para domínio raiz (ex: meusite.com) use <strong>ALIAS</strong> ou <strong>ANAME</strong>. Para subdomínio (ex: quiz.meusite.com) use <strong>CNAME</strong>.
                                </div>
                            </li>
                            <li>Aguarde a propagação DNS (pode levar até 24h)</li>
                            <li>Clique em <strong>"Verificar DNS"</strong> ao lado do seu domínio</li>
                        </ol>

                        {/* Provider-specific tips */}
                        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--text-primary)' }}>💡 Dicas por registrador:</div>

                            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(103,61,230,0.06)', border: '1px solid rgba(103,61,230,0.15)', fontSize: '0.75rem', color: '#4c1d95' }}>
                                🟣 <strong>Hostinger:</strong> Vá em <em>Domínios → DNS/Nameservers</em>. Certifique-se de que os nameservers são <code style={{ background: '#f5f3ff', padding: '1px 4px', borderRadius: 3 }}>ns1.hostinger.com</code> e <code style={{ background: '#f5f3ff', padding: '1px 4px', borderRadius: 3 }}>ns2.hostinger.com</code> (e <strong>NÃO</strong> <code style={{ background: '#fef2f2', padding: '1px 4px', borderRadius: 3 }}>dns-parking.com</code>). Depois, crie um registro <strong>ALIAS</strong> com nome <strong>@</strong> apontando para <strong>{serverHostname}</strong>.
                            </div>

                            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(244,129,32,0.06)', border: '1px solid rgba(244,129,32,0.15)', fontSize: '0.75rem', color: '#7c2d12' }}>
                                🟡 <strong>Cloudflare:</strong> Desative o proxy (🔶 → ☁️ cinza) no registro CNAME para que a verificação funcione corretamente.
                            </div>

                            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(0,156,59,0.06)', border: '1px solid rgba(0,156,59,0.15)', fontSize: '0.75rem', color: '#14532d' }}>
                                🇧🇷 <strong>Registro.br:</strong> Vá em <em>DNS → Configurar zona</em> e adicione um registro CNAME para o subdomínio desejado apontando para <strong>{serverHostname}</strong>.
                            </div>
                        </div>
                    </div>
                )}

                {/* Domain list */}
                {domains.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {domains.map(d => (
                            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, background: '#f9fafb', border: '1px solid var(--border)' }}>
                                <Globe size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.domain}</div>
                                    {d.status === 'verified' && (
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                            Acesse: <a href={`https://${d.domain}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                                                https://{d.domain} <ExternalLink size={10} style={{ verticalAlign: 'middle' }} />
                                            </a>
                                        </div>
                                    )}
                                </div>
                                {statusBadge(d.status)}
                                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                    <button onClick={() => handleVerify(d.id)} disabled={verifying === d.id} title="Verificar DNS"
                                        style={{ width: 30, height: 30, borderRadius: 8, background: verifying === d.id ? '#f3f4f6' : 'rgba(37,99,235,0.08)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', transition: 'var(--transition)' }}>
                                        {verifying === d.id ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                                    </button>
                                    <button onClick={() => handleRemove(d.id)} title="Remover domínio"
                                        style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', transition: 'var(--transition)' }}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {domains.length === 0 && !showInstructions && (
                    <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        Nenhum domínio configurado. Adicione um acima para começar.
                    </div>
                )}
            </div>
        </div>
    );
}
