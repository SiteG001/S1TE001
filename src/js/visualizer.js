/**
 * Membership coverage visualiser island.
 *
 * The artwork is an authored architectural section of the house; selecting a
 * tier just flips `data-covered` on the zone groups and CSS does the rest. The
 * controls are wired first and the section is fully usable with this module
 * absent — the markup ships in its Home Watch state.
 *
 * Zone ids are the contract between this file, the SVG in memberships.html and
 * (later) the 3D scene graph. Adding a zone means adding it in all three.
 */
import { track } from './analytics.js';

const section = document.querySelector('[data-visualizer]');

if (section) {
  const zones = Array.from(section.querySelectorAll('[data-zone]'));
  const radios = Array.from(section.querySelectorAll('input[name="tier"]'));
  const readout = section.querySelector('[data-viz-readout]');
  const table = document.querySelector('[data-compare-table]');

  /**
   * Which areas of the cutaway each membership reaches. Zones absent from a
   * list are scrimmed. Home Watch is also authored into the markup, so these
   * two have to agree for the no-JS render to be correct.
   */
  const TIER_ZONES = {
    'home-watch': ['master-suite', 'ensuite', 'great-room', 'mechanical'],
    concierge: ['master-suite', 'ensuite', 'great-room', 'mechanical', 'kitchen', 'dining', 'deck'],
    stewardship: [
      'master-suite',
      'ensuite',
      'great-room',
      'mechanical',
      'kitchen',
      'dining',
      'deck',
      'grounds',
    ],
  };

  /* --- Coverage copy. Duplicated from TIER_ZONES intentionally: this is the
     accessible version of the same table and must not drift from it. --- */
  const COVERAGE = {
    'home-watch': [
      'Roof, siding and perimeter walk',
      'Interior walk-through with video report',
      'Water heater, HVAC and plumbing check',
    ],
    concierge: [
      'Everything in Home Watch',
      'Kitchen restock and grocery stocking',
      'Arrival preparation and linens',
      'Deck, drive and vendor verification',
    ],
    stewardship: [
      'Everything in Concierge',
      'Event, holiday and seasonal preparation',
      'Priority scheduling and advanced vendor management',
    ],
  };

  const NAMES = {
    'home-watch': 'Home Watch',
    concierge: 'Concierge',
    stewardship: 'Private Stewardship',
  };

  function paintZones(tierId) {
    const covered = TIER_ZONES[tierId];
    if (!covered) return;
    zones.forEach((zone) => {
      zone.dataset.covered = String(covered.includes(zone.dataset.zone));
    });
  }

  function renderReadout(tierId) {
    if (!readout) return;
    const items = COVERAGE[tierId] || [];
    readout.innerHTML = `<strong>${NAMES[tierId]} covers:</strong> ${items.join(' · ')}`;
  }

  function highlightTable(tierId) {
    if (!table) return;
    table.querySelectorAll('[data-tier-col]').forEach((cell) => {
      cell.classList.toggle('is-active', cell.dataset.tierCol === tierId);
    });
  }

  function select(tierId, { fromUser = false } = {}) {
    section.dataset.activeTier = tierId;
    paintZones(tierId);
    renderReadout(tierId);
    highlightTable(tierId);
    if (fromUser) {
      // §1.2 KPI: this is the event this whole section is judged on.
      track('membership_tier_toggle', { tier: tierId, surface: 'coverage_visualizer' });
    }
  }

  radios.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) select(radio.value, { fromUser: true });
    });
  });

  const initial = radios.find((r) => r.checked)?.value || 'home-watch';
  select(initial);
}
