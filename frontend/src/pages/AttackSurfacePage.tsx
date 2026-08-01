import { Link } from 'react-router'
import { Crosshair } from 'lucide-react'
import { Card, PageHeader, StatCard, Table } from '../components/ui'
import { ATTACKS, CATEGORY_ICON, CATEGORY_STYLES } from '../lib/attackSurface'

export default function AttackSurfacePage() {
  const keyRecoveryCount = ATTACKS.filter((a) => a.category === 'Key recovery').length

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Every attack on this site, in one place"
        title="Attack Surface Map"
        description="Eight real attacks against RSA, demonstrated live elsewhere on this site, mapped against what each one actually compromises, what an attacker needs to pull it off, and what stops it in real-world RSA. Not a wishlist -- every row links to a real, running demo."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Attacks demonstrated" value={ATTACKS.length} />
        <StatCard label="Break the key entirely" value={keyRecoveryCount} hint="p, q, or d recovered" />
        <StatCard label="Need the private key?" value="No" hint="not one row does" />
        <StatCard label="Mocked or hardcoded" value={0} hint="every row is real code" />
      </div>

      <div className="mb-8">
        <Table>
          <thead>
            <tr className="border-b border-line text-xs tracking-wide text-ink-muted uppercase">
              <th className="px-3 py-2">Attack</th>
              <th className="px-3 py-2">Compromises</th>
              <th className="px-3 py-2">Attacker needs</th>
              <th className="px-3 py-2">Real RSA's defense</th>
            </tr>
          </thead>
          <tbody>
            {ATTACKS.map((a) => (
              <tr key={a.name} className="border-b border-line/60 last:border-0 align-top">
                <td className="px-3 py-3">
                  <Link to={a.to} className="font-medium text-ink underline decoration-line underline-offset-2 hover:text-gold hover:decoration-gold">
                    {a.name}
                  </Link>
                  <div className={`mt-1 text-xs ${CATEGORY_STYLES[a.category]}`}>{a.category}</div>
                </td>
                <td className="px-3 py-3 text-xs text-ink-muted">{a.compromises}</td>
                <td className="px-3 py-3 text-xs text-ink-muted">{a.attackerNeeds}</td>
                <td className="px-3 py-3 text-xs text-ink-muted">{a.defense}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <h2 className="mb-3 font-mono text-sm font-semibold tracking-wide text-ink-muted uppercase">
        The full picture, one attack at a time
      </h2>
      <div className="flex flex-col gap-4">
        {ATTACKS.map((a) => {
          const Icon = CATEGORY_ICON[a.category]
          return (
            <Card key={a.name} interactive>
              <Link to={a.to} className="group flex items-start gap-3">
                <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${CATEGORY_STYLES[a.category]}`} />
                <div className="min-w-0">
                  <h3 className="font-medium text-ink group-hover:text-gold">
                    {a.name} <Crosshair className="ml-1 inline h-3.5 w-3.5 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100" />
                  </h3>
                  <p className="mt-1 text-sm text-ink-muted">{a.detail}</p>
                </div>
              </Link>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
