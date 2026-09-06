'use client';

/**
 * Selection state for one case investigation — the evidence path.
 *
 * Every interactive section on a case page (role map, narrative lanes,
 * relationship flows, timeline, evidence ledger, inspector) reads the same
 * selection and lights up what is tied to it. The provider owns that state;
 * the sections are islands inside server-rendered `SectionBlock`s, which is
 * what keeps the prose, the sources and the unknowns server-rendered.
 *
 * URL state: the selection is mirrored into the query string
 * (`?entity=…&narrative=…&edge=…&claim=…&range=YYYY-MM-DD..YYYY-MM-DD`) with
 * `history.replaceState`, so a reader can hand someone a link to an account
 * or a claim. It is read once after hydration rather than through
 * `useSearchParams`, which would force the whole prerendered page into
 * client rendering for a query string that is empty on first paint.
 *
 * With no JavaScript every section renders in full and unselected; the
 * controls that would do nothing take themselves out of the tab order.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type {
  InvestigationClaim,
  InvestigationEdge,
  InvestigationEntity,
  InvestigationEvent,
  InvestigationModel,
  InvestigationNarrative,
} from '@/lib/content/investigation-model';

export type Selection = {
  entity?: string;
  narrative?: string;
  edge?: string;
  claim?: string;
  /** `YYYY-MM-DD` inclusive bounds; either may be absent. */
  from?: string;
  to?: string;
};

export type Related = {
  entities: Set<string>;
  edges: Set<string>;
  narratives: Set<string>;
  events: Set<string>;
  claims: Set<string>;
};

type ContextValue = {
  model: InvestigationModel;
  selection: Selection;
  /** Anything is selected — the page is "following" something. */
  active: boolean;
  interactive: boolean;
  related: Related;
  entityById: Map<string, InvestigationEntity>;
  edgeById: Map<string, InvestigationEdge>;
  narrativeById: Map<string, InvestigationNarrative>;
  claimById: Map<string, InvestigationClaim>;
  eventById: Map<string, InvestigationEvent>;
  select: (next: Partial<Selection>) => void;
  toggle: (key: 'entity' | 'narrative' | 'edge' | 'claim', id: string) => void;
  setRange: (from?: string, to?: string) => void;
  clear: () => void;
  /** Whether a dated thing falls inside the selected range (true when no range). */
  inRange: (date?: string) => boolean;
};

const InvestigationContext = createContext<ContextValue | null>(null);

const subscribeToNothing = () => () => {};

const KEYS: (keyof Selection)[] = ['entity', 'narrative', 'edge', 'claim'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function readSelection(search: string, model: InvestigationModel): Selection {
  const params = new URLSearchParams(search);
  const next: Selection = {};
  for (const key of KEYS) {
    const value = params.get(key);
    if (value && /^[\w.-]+$/.test(value)) next[key] = value;
  }
  /* `?handle=` is the cross-file address: entity ids differ between case
     files and the network, a handle does not. It resolves to this file's
     entity and is rewritten as `entity` on the next write. */
  const handle = params.get('handle')?.replace(/^@/, '').toLowerCase();
  if (handle && !next.entity) {
    const match = model.entities.find((entity) => entity.handle?.toLowerCase() === handle);
    if (match) next.entity = match.id;
  }
  const range = params.get('range');
  if (range) {
    const [from, to] = range.split('..');
    if (from && DAY.test(from)) next.from = from;
    if (to && DAY.test(to)) next.to = to;
  }
  return next;
}

function writeSelection(selection: Selection) {
  const url = new URL(window.location.href);
  for (const key of KEYS) {
    if (selection[key]) url.searchParams.set(key, selection[key] as string);
    else url.searchParams.delete(key);
  }
  if (selection.from || selection.to) {
    url.searchParams.set('range', `${selection.from ?? ''}..${selection.to ?? ''}`);
  } else {
    url.searchParams.delete('range');
  }
  url.searchParams.delete('handle');
  history.replaceState(history.state, '', url);
}

export function InvestigationProvider({
  model,
  children,
}: {
  model: InvestigationModel;
  children: ReactNode;
}) {
  const [selection, setSelection] = useState<Selection>({});
  /* Set once the URL has been read, and the gate on writing it back: before
     that, writing would wipe the query string the reader arrived with. */
  const [ready, setReady] = useState(false);
  const interactive = useSyncExternalStore(subscribeToNothing, () => true, () => false);

  /* The URL is an external input read once after hydration: the server
     snapshot is an empty selection (the prerendered HTML), and the client
     replaces it with whatever the link carried. Deferred a frame so
     hydration settles before state diverges from the server snapshot. The
     effect is idempotent on purpose — under StrictMode it runs twice, and a
     ref guard here lost the selection to the cancelled first frame. */
  useEffect(() => {
    const initial = readSelection(window.location.search, model);
    const frame = requestAnimationFrame(() => {
      setSelection(initial);
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [model]);

  useEffect(() => {
    if (!ready) return;
    writeSelection(selection);
  }, [ready, selection]);

  const entityById = useMemo(() => new Map(model.entities.map((e) => [e.id, e])), [model]);
  const edgeById = useMemo(() => new Map(model.edges.map((e) => [e.id, e])), [model]);
  const narrativeById = useMemo(() => new Map(model.narratives.map((n) => [n.id, n])), [model]);
  const claimById = useMemo(() => new Map(model.claims.map((c) => [c.id, c])), [model]);
  const eventById = useMemo(() => new Map(model.events.map((e) => [e.id, e])), [model]);

  /**
   * Everything the current selection touches. An entity lights its edges,
   * narratives, events and findings; a narrative lights its carriers and
   * findings; an edge lights its two ends; a finding lights the accounts it
   * names. The sets are unions, so selecting an entity *and* a narrative
   * shows both — the filters decide what is hidden, the path decides what
   * is lit.
   */
  const related = useMemo<Related>(() => {
    const out: Related = {
      entities: new Set(),
      edges: new Set(),
      narratives: new Set(),
      events: new Set(),
      claims: new Set(),
    };
    const entity = selection.entity ? entityById.get(selection.entity) : undefined;
    if (entity) {
      out.entities.add(entity.id);
      for (const id of entity.edgeIds) {
        out.edges.add(id);
        const edge = edgeById.get(id);
        if (edge) {
          out.entities.add(edge.fromId);
          out.entities.add(edge.toId);
        }
      }
      for (const id of entity.narrativeIds) out.narratives.add(id);
      for (const id of entity.eventIds) out.events.add(id);
      for (const id of entity.claimIds) out.claims.add(id);
    }
    const narrative = selection.narrative ? narrativeById.get(selection.narrative) : undefined;
    if (narrative) {
      out.narratives.add(narrative.id);
      for (const id of narrative.carrierIds) out.entities.add(id);
      for (const id of narrative.claimIds) out.claims.add(id);
    }
    const edge = selection.edge ? edgeById.get(selection.edge) : undefined;
    if (edge) {
      out.edges.add(edge.id);
      out.entities.add(edge.fromId);
      out.entities.add(edge.toId);
    }
    const claim = selection.claim ? claimById.get(selection.claim) : undefined;
    if (claim) {
      out.claims.add(claim.id);
      for (const id of claim.entityIds) out.entities.add(id);
    }
    return out;
  }, [selection, entityById, edgeById, narrativeById, claimById]);

  const select = useCallback((next: Partial<Selection>) => {
    setSelection((current) => ({ ...current, ...next }));
  }, []);

  const toggle = useCallback((key: 'entity' | 'narrative' | 'edge' | 'claim', id: string) => {
    setSelection((current) => ({ ...current, [key]: current[key] === id ? undefined : id }));
  }, []);

  const setRange = useCallback((from?: string, to?: string) => {
    setSelection((current) => ({ ...current, from, to }));
  }, []);

  const clear = useCallback(() => setSelection({}), []);

  const inRange = useCallback(
    (date?: string) => {
      if (!selection.from && !selection.to) return true;
      if (!date) return false;
      const day = date.slice(0, 10);
      if (selection.from && day < selection.from) return false;
      if (selection.to && day > selection.to) return false;
      return true;
    },
    [selection.from, selection.to],
  );

  const active = Boolean(
    selection.entity || selection.narrative || selection.edge || selection.claim,
  );

  const value = useMemo<ContextValue>(
    () => ({
      model,
      selection,
      active,
      interactive,
      related,
      entityById,
      edgeById,
      narrativeById,
      claimById,
      eventById,
      select,
      toggle,
      setRange,
      clear,
      inRange,
    }),
    [
      model,
      selection,
      active,
      interactive,
      related,
      entityById,
      edgeById,
      narrativeById,
      claimById,
      eventById,
      select,
      toggle,
      setRange,
      clear,
      inRange,
    ],
  );

  return (
    <InvestigationContext.Provider value={value}>{children}</InvestigationContext.Provider>
  );
}

export function useInvestigation(): ContextValue {
  const value = useContext(InvestigationContext);
  if (!value) throw new Error('useInvestigation: no InvestigationProvider above this component');
  return value;
}

/** Three-way state a lit-up list item carries: untouched, on the path, or off it. */
export function pathState(active: boolean, related: boolean): 'on' | 'off' | undefined {
  if (!active) return undefined;
  return related ? 'on' : 'off';
}
