import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: '#F7F2EB' }}>

      {/* NAVBAR */}
      <nav className="flex items-center justify-between px-12 py-5">
        <div>
          <img src="/logo-kavio.png" alt="Kavio" style={{ height: '56px', objectFit: 'contain' }} />
        </div>
        <Link
          href="/inscription"
          style={{
            backgroundColor: '#C4673A',
            color: 'white',
            borderRadius: '24px',
            padding: '9px 22px',
            fontSize: '14px',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Rejoindre la liste →
        </Link>
      </nav>

      {/* HERO */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-32">
        <div
          style={{
            backgroundColor: 'white',
            border: '1px solid #E8D5B7',
            borderRadius: '24px',
            padding: '6px 16px',
            fontSize: '13px',
            color: '#6B6B6B',
            marginBottom: '32px',
          }}
        >
          🟠 Bientôt disponible en France · Rejoignez la liste d'attente
        </div>

        <h1
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(44px, 7vw, 80px)',
            lineHeight: '1.1',
            color: '#1A1A1A',
            maxWidth: '760px',
            marginBottom: '24px',
          }}
        >
          Le recrutement qui vous voit{' '}
          <em style={{ color: '#C4673A' }}>vraiment.</em>
        </h1>

        <p
          style={{
            fontSize: '19px',
            color: '#6B6B6B',
            maxWidth: '520px',
            lineHeight: '1.7',
            fontWeight: '300',
            marginBottom: '48px',
          }}
        >
          Fini les CV formatés et les lettres de motivation. Kavio vous connecte
          à votre prochaine opportunité à travers qui vous êtes — pas ce que
          vous avez listé sur une feuille.
        </p>

        <div className="flex gap-4 flex-wrap justify-center">
          <Link
            href="/inscription"
            style={{
              backgroundColor: '#C4673A',
              color: 'white',
              borderRadius: '14px',
              padding: '14px 28px',
              fontSize: '15px',
              fontWeight: '500',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Je suis candidat(e) →
          </Link>
          <Link
            href="/inscription"
            style={{
              backgroundColor: '#2C4A3E',
              color: 'white',
              borderRadius: '14px',
              padding: '14px 28px',
              fontSize: '15px',
              fontWeight: '500',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Je recrute →
          </Link>
        </div>
      </section>

      {/* PROBLÈME */}
      <section
        style={{ backgroundColor: '#2C4A3E', padding: '80px 48px' }}
        className="text-center"
      >
        <h2
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(32px, 4vw, 52px)',
            color: 'white',
            marginBottom: '16px',
          }}
        >
          Le CV date des années 50.
        </h2>
        <p
          style={{
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
            fontSize: '22px',
            color: '#E8D5B7',
            marginBottom: '48px',
          }}
        >
          Le recrutement, lui, n'a pas changé.
        </p>

        <div className="flex flex-wrap justify-center gap-6 max-w-3xl mx-auto">
          {[
            { val: '12 sem.', label: 'délai moyen de recrutement', src: 'APEC 2025' },
            { val: '57%', label: 'des recrutements difficiles', src: 'BMO France Travail 2024' },
            { val: '10,1 M', label: "offres publiées chaque année", src: 'France 2025' },
          ].map((stat) => (
            <div
              key={stat.val}
              style={{
                backgroundColor: 'rgba(255,255,255,0.07)',
                borderRadius: '16px',
                padding: '24px 32px',
                minWidth: '180px',
              }}
            >
              <div
                style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: '36px',
                  color: '#C4673A',
                  fontWeight: '700',
                }}
              >
                {stat.val}
              </div>
              <div style={{ fontSize: '13px', color: 'white', fontWeight: '500', marginTop: '6px' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: '11px', color: '#E8D5B7', marginTop: '4px', opacity: 0.6 }}>
                {stat.src}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{ backgroundColor: '#1A1A1A', padding: '32px 48px' }}
        className="flex items-center justify-between flex-wrap gap-4"
      >
        <div>
          <img src="/logo-kavio.png" alt="Kavio" style={{ height: '32px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        </div>
        <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '13px', color: '#E8D5B7', opacity: 0.6 }}>
          « Trouvez votre cap. »
        </div>
      </footer>

    </main>
  )
}