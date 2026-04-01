import { useState, useEffect } from 'react';
import { Globe, Trash2, RefreshCw, Check, AlertCircle, Copy, ExternalLink, Loader2, Plus, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { getDomains, addDomain, removeDomain, verifyDomain, syncDomainDns, getServerInfo } from '../hooks/useQuizStore';

export default function DomainSettings({ quizId }) {
    const [domains, setDomains] = useState([]);
    const [newDomain, setNewDomain] = useState('');
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [serverHostname, setServerHostname] = useState('');
    const [copied, setCopied] = useState('');
    const [searchDomain, setSearchDomain] = useState('');
    const [showBuySection, setShowBuySection] = useState(true);
    const [expandedDomain, setExpandedDomain] = useState(null);

    // Affiliate registrar links
    const REGISTRARS = [
        { name: 'Namecheap', emoji: '🟠', color: '#FF5722', searchUrl: (d) => `https://www.namecheap.com/domains/registration/results/?domain=${d}`, desc: 'Preços baixos, SSL grátis', popular: true },
        { name: 'GoDaddy', emoji: '🟢', color: '#00A4A6', searchUrl: (d) => `https://www.godaddy.com/domainsearch/find?domainToCheck=${d}`, desc: 'Mais popular do mundo' },
        { name: 'Registro.br', emoji: '🇧🇷', color: '#009c3b', searchUrl: (d) => `https://registro.br/busca-dominio/?fqdn=${d}`, desc: 'Domínios .com.br', popular: true },
        { name: 'Hostinger', emoji: '🟣', color: '#673DE6', searchUrl: (d) => `https://www.hostinger.com.br/verificador-de-dominio?domain=${d}`, desc: 'Barato + hospedagem' },
        { name: 'Cloudflare', emoji: '🟡', color: '#F48120', searchUrl: (d) => `https://www.cloudflare.com/products/registrar/`, desc: 'Preço de custo, sem markup' },
    ];

    useEffect(() => {
        getServerInfo().then(info => setServerHostname(info.hostname || 'quizflw.com'));
    }, []);

    useEffect(() => {
        if (quizId) loadDomains();
    }, [quizId]);

    const loadDomains = async () => {
        const data = await getDomains(quizId);
        setDomains(data);
        // Auto-sync DNS records from Railway for domains that don't have them yet
        for (const d of data) {
            if (!d.dnsRecords && d.status !== 'verified') {
                const result = await syncDomainDns(d.id);
                if (result.dnsRecords) {
                    // Refresh to show the new records
                    const updated = await getDomains(quizId);
                    setDomains(updated);
                    break; // Refresh once is enough
                }
            }
        }
    };

    const handleAdd = async () => {
        if (!newDomain.trim()) return;
        setLoading(true); setError(''); setSuccess('');
        const result = await addDomain(quizId, newDomain.trim());
        setLoading(false);
        if (result.error) { setError(result.error); }
        else {
            if (result.dnsRecords) {
                setSuccess('Domínio registrado! Configure os registros DNS abaixo e clique em "Verificar".');
            } else {
                setSuccess('Domínio adicionado! Configure o CNAME e depois clique em "Verificar DNS".');
            }
            setNewDomain('');
            setExpandedDomain(result.id);
            await loadDomains();
        }
    };

    const handleRemove = async (id) => { if (!confirm('Remover este domínio?')) return; await removeDomain(id); await loadDomains(); };

    const handleVerify = async (id) => {
        setVerifying(id); setError(''); setSuccess('');
        const result = await verifyDomain(id);
        setVerifying(null);
        if (result.status === 'verified') {
            setSuccess(result.message);
        } else {
            setError(result.message);
            // Show DNS records panel if not verified
            setExpandedDomain(id);
        }
        await loadDomains();
    };

    const copyText = (text, key) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 2000); };

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

    // Render DNS records table for a domain
    const renderDnsRecords = (domain) => {
        const records = domain.dnsRecords || [];
        // Find TXT record from Railway (if available)
        const txtRecord = records.find(r => !r.requiredValue?.includes('.railway.app') && !r.requiredValue?.includes('.up.'));
        const cnameVerified = records.some(r => (r.requiredValue?.includes('.railway.app') || r.requiredValue?.includes('.up.')) && (r.status === 'VERIFIED' || r.status === 'verified' || r.status === 'VALID'));
        const txtVerified = txtRecord && (txtRecord.status === 'VERIFIED' || txtRecord.status === 'verified' || txtRecord.status === 'VALID');

        return (
            <div style={{ padding: '12px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid var(--border)', fontSize: '0.82rem' }}>
                <div style={{ fontWeight: 600, marginBottom: 10, fontSize: '0.78rem', color: 'var(--text-muted)' }}>📋 Configure no painel DNS do seu registrador:</div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '60px minmax(80px, auto) 1fr 36px', gap: '8px 10px', alignItems: 'center' }}>
                    {/* Header */}
                    <span style={{ fontWeight: 700, fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tipo</span>
                    <span style={{ fontWeight: 700, fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nome</span>
                    <span style={{ fontWeight: 700, fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Valor</span>
                    <span></span>

                    {/* Step 1: CNAME always pointing to quizflw.com */}
                    <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 600, color: cnameVerified ? '#059669' : '#d97706' }}>CNAME</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>@</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', wordBreak: 'break-all', color: 'var(--text-primary)' }}>{serverHostname}</span>
                        <span style={{ fontSize: '0.7rem', flexShrink: 0 }}>{cnameVerified ? '✅' : '⏳'}</span>
                    </div>
                    <button onClick={() => copyText(serverHostname, `cname-${domain.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: 4, display: 'flex', alignItems: 'center' }}>
                        {copied === `cname-${domain.id}` ? <Check size={14} /> : <Copy size={14} />}
                    </button>

                    {/* Step 2: TXT record from Railway (if available) */}
                    {txtRecord && (
                        <>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 600, color: txtVerified ? '#059669' : '#d97706' }}>TXT</span>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{txtRecord.hostlabel || '@'}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', wordBreak: 'break-all', color: 'var(--text-primary)' }}>{txtRecord.requiredValue}</span>
                                <span style={{ fontSize: '0.7rem', flexShrink: 0 }}>{txtVerified ? '✅' : '⏳'}</span>
                            </div>
                            <button onClick={() => copyText(txtRecord.requiredValue, `txt-${domain.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: 4, display: 'flex', alignItems: 'center' }}>
                                {copied === `txt-${domain.id}` ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                        </>
                    )}
                </div>

                {/* Hint about TXT appearing after CNAME */}
                {!txtRecord && (
                    <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)', fontSize: '0.72rem', color: '#4338ca' }}>
                        💡 Configure o CNAME acima e clique em <strong>"Verificar"</strong>. O registro TXT de verificação aparecerá automaticamente.
                    </div>
                )}

                <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Info size={12} /> Copie os valores e cole no painel DNS do seu registrador
                </div>
            </div>
        );
    };

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
                            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Ainda não tem domínio? Compre em um registrador</p>
                        </div>
                    </div>
                    <button onClick={() => setShowBuySection(!showBuySection)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--primary)' }}>
                        {showBuySection ? 'Ocultar ▲' : 'Mostrar ▼'}
                    </button>
                </div>

                {showBuySection && (
                    <>
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

                {/* How it works - simple */}
                <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.12)', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Como funciona:</strong> Adicione seu domínio abaixo → Copie os registros DNS → Cole no painel do seu registrador → Clique em "Verificar"
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

                {/* Domain list */}
                {domains.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {domains.map(d => {
                            const isExpanded = expandedDomain === d.id;
                            const hasDnsRecords = d.dnsRecords && d.dnsRecords.length > 0;

                            return (
                                <div key={d.id} style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                                    {/* Domain header */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#f9fafb' }}>
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
                                            {d.status !== 'verified' && (
                                                <button onClick={() => setExpandedDomain(isExpanded ? null : d.id)} title="Ver registros DNS"
                                                    style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(99,102,241,0.08)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', transition: 'var(--transition)' }}>
                                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                </button>
                                            )}
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

                                    {/* Expanded DNS records */}
                                    {isExpanded && d.status !== 'verified' && (
                                        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', background: '#fff' }}>
                                            {renderDnsRecords(d)}
                                            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', fontSize: '0.72rem', color: '#92400e' }}>
                                                ⏱️ Após configurar o DNS, aguarde a propagação (pode levar até 24h) e clique em <strong>"Verificar"</strong>
                                            </div>
                                        </div>
                                    )}

                                    {/* Auto-expand pending domains without DNS records show a hint */}
                                    {!isExpanded && d.status === 'pending' && (
                                        <div 
                                            onClick={() => setExpandedDomain(d.id)}
                                            style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', background: '#fffbeb', fontSize: '0.72rem', color: '#92400e', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <AlertCircle size={12} /> Clique para ver os registros DNS que você precisa configurar
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {domains.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        Nenhum domínio configurado. Adicione um acima para começar.
                    </div>
                )}
            </div>
        </div>
    );
}
