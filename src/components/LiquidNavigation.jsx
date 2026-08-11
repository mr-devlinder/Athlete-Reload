import appLogo from '../assets/athlete-reload-logo-transparent.png'
import { AppIcon } from './AppIcon'

export function LiquidNavigation({
  activeView,
  athleteName = 'Athlete',
  className = '',
  lockedView = null,
  onOpenLegal,
  onSelect,
  onSignOut,
  views,
}) {
  return (
    <nav aria-label="Primary views" className={`liquid-navigation ${className}`.trim()}>
      <button className="sidebar-brand" onClick={() => onSelect('Home')} type="button">
        <img alt="" src={appLogo} />
        <span><strong>Athlete</strong><strong>Reload</strong></span>
      </button>

      <div className="sidebar-primary">
        {views.map((view) => {
          const disabled = Boolean(lockedView && lockedView !== view.label)
          return (
            <button
              aria-current={activeView === view.label ? 'page' : undefined}
              className={activeView === view.label ? 'active' : ''}
              data-view={view.label}
              disabled={disabled}
              key={view.label}
              onClick={() => onSelect(view.label)}
              type="button"
            >
              <AppIcon name={view.icon} size={20} />
              <span>{view.label}</span>
            </button>
          )
        })}
      </div>

      <div className="sidebar-account">
        <div className="sidebar-athlete"><strong>{athleteName}</strong></div>
        <button className="sidebar-utility" onClick={() => onSelect('Settings')} type="button">Settings</button>
        <button className="sidebar-utility" onClick={() => onOpenLegal?.('privacy')} type="button">Privacy</button>
        <button className="sidebar-utility" onClick={onSignOut} type="button">Sign out</button>
      </div>
    </nav>
  )
}
