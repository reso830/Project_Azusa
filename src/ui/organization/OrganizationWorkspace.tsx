'use client';

import { useRef, useState } from 'react';
import { useOrganizationContext } from '../shell/OrganizationContext';
import { TrainsAndCadencePanel } from './TrainsAndCadencePanel';
import { TeamsAndMembersPanel } from './TeamsAndMembersPanel';
import { LocationsPanel } from './LocationsPanel';
import styles from './organization.module.css';

const tabs = [
  { id: 'cadence', name: 'ARTs & PI Cadence', Panel: TrainsAndCadencePanel },
  { id: 'members', name: 'Teams & Members', Panel: TeamsAndMembersPanel },
  { id: 'locations', name: 'Locations', Panel: LocationsPanel },
];

export function OrganizationWorkspace() {
  const [active, setActive] = useState(0);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const { refresh } = useOrganizationContext();
  return (
    <div className={styles.workspace}>
      <h1>Organization</h1>
      <div
        role="tablist"
        aria-label="Organization sections"
        className={styles.tabs}
      >
        {tabs.map(({ id, name }, index) => (
          <button
            key={id}
            id={`org-tab-${id}`}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="tab"
            aria-selected={active === index}
            aria-controls={`org-panel-${id}`}
            tabIndex={active === index ? 0 : -1}
            onClick={() => setActive(index)}
            onKeyDown={(event) => {
              const targets: Record<string, number> = {
                ArrowRight: (index + 1) % tabs.length,
                ArrowLeft: (index + tabs.length - 1) % tabs.length,
                Home: 0,
                End: tabs.length - 1,
              };
              const next = targets[event.key];
              if (next === undefined) return;
              event.preventDefault();
              setActive(next);
              buttons.current[next]?.focus();
            }}
          >
            {name}
          </button>
        ))}
      </div>
      {tabs.map(({ id, Panel }, index) => (
        <section
          key={id}
          id={`org-panel-${id}`}
          role="tabpanel"
          aria-labelledby={`org-tab-${id}`}
          hidden={active !== index}
        >
          {active === index && <Panel onMutated={refresh} />}
        </section>
      ))}
    </div>
  );
}
