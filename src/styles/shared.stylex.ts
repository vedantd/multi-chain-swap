import * as stylex from '@stylexjs/stylex';

export const container = stylex.create({
  section: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '1.5rem',
    background: 'var(--background)',
    marginBottom: '1rem',
  },
  card: {
    padding: '1rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    background: 'var(--input-bg)',
    marginBottom: '0.5rem',
  },
  inputContainer: {
    padding: '1rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    background: 'var(--input-bg)',
    marginBottom: '0.75rem',
  },
});

export const typography = stylex.create({
  h1: {
    fontSize: '1.25rem',
    fontWeight: 700,
    letterSpacing: '-0.02em',
  },
  h2: {
    fontSize: '1.125rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
  },
  body: {
    fontSize: '0.875rem',
    color: 'var(--foreground)',
  },
  bodySmall: {
    fontSize: '0.8125rem',
    color: 'var(--muted-foreground)',
  },
  muted: {
    fontSize: '0.875rem',
    color: 'var(--muted-foreground)',
  },
  mutedSmall: {
    fontSize: '0.75rem',
    color: 'var(--muted-foreground)',
  },
  label: {
    fontSize: '0.75rem',
    color: 'var(--muted-foreground)',
    fontWeight: 500,
  },
  error: {
    fontSize: '0.875rem',
    color: 'var(--destructive)',
  },
  success: {
    fontSize: '0.875rem',
    color: 'var(--success, green)',
  },
});

export const layout = stylex.create({
  flexRow: {
    display: 'flex',
    alignItems: 'center',
  },
  flexRowBetween: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flexCol: {
    display: 'flex',
    flexDirection: 'column',
  },
  flexColGap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  flexWrap: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    paddingBottom: '1rem',
    borderBottom: '1px solid var(--border)',
  },
  pageContainer: {
    padding: '1.5rem 1rem 2rem',
    maxWidth: '28rem',
    margin: '0 auto',
  },
});

export const buttons = stylex.create({
  primary: {
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
  },
  primaryEnabled: {
    opacity: 1,
  },
  primaryDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  secondary: {
    padding: '0.4rem 0.75rem',
    borderRadius: '6px',
    fontSize: '0.875rem',
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
  },
  textLink: {
    background: 'transparent',
    border: 'none',
    padding: 0,
    margin: 0,
    font: 'inherit',
    color: 'var(--primary)',
    textDecoration: 'underline',
    cursor: 'pointer',
    outline: 'none',
    boxShadow: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    appearance: 'none',
    borderRadius: 0,
    borderWidth: 0,
    borderStyle: 'none',
    borderColor: 'transparent',
  },
  textLinkDisabled: {
    cursor: 'not-allowed',
    background: 'transparent',
  },
  small: {
    padding: '0.15rem 0.4rem',
    fontSize: '0.75rem',
    cursor: 'pointer',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    background: 'transparent',
  },
  dismiss: {
    padding: '0.25rem 0.5rem',
    border: 'none',
    borderRadius: '4px',
    background: 'rgba(0,0,0,0.1)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    color: 'inherit',
  },
});

export const form = stylex.create({
  input: {
    width: '100%',
    padding: '0.625rem 0.75rem',
    fontSize: '0.9375rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--input-bg)',
    color: 'var(--foreground)',
  },
  inputDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  label: {
    display: 'block',
    fontSize: '0.75rem',
    color: 'var(--muted-foreground)',
    marginBottom: '0.35rem',
    fontWeight: 500,
  },
  hint: {
    fontSize: '0.7rem',
    color: 'var(--muted-foreground)',
    marginTop: '0.35rem',
  },
});

export const badge = stylex.create({
  base: {
    padding: '0.2rem 0.5rem',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: 500,
    marginRight: '0.5rem',
  },
  gasless: {
    backgroundColor: '#e0f2fe',
    color: '#0369a1',
  },
  requiresGas: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  muted: {
    background: 'var(--muted)',
    color: 'var(--muted-foreground)',
  },
});

export const dropdown = stylex.create({
  container: {
    position: 'relative',
  },
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 0.75rem',
    fontSize: '0.9375rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--input-bg, #0f172a)',
    color: 'var(--foreground)',
    cursor: 'pointer',
    width: '100%',
  },
  triggerDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  menu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '0.25rem',
    padding: '0.25rem',
    listStyle: 'none',
    background: '#0f172a',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    zIndex: 1000,
    maxHeight: '14rem',
    overflowY: 'auto',
  },
  searchInput: {
    width: '100%',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    border: 'none',
    borderBottom: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--foreground)',
  },
  item: {
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9375rem',
    fontWeight: 500,
    background: '#0f172a',
    color: 'var(--foreground)',
    border: '1px solid var(--border)',
    marginBottom: '0.25rem',
  },
  itemHighlighted: {
    background: '#1e293b',
  },
  itemSelected: {
    fontWeight: 600,
  },
  itemLabel: {
    display: 'block',
  },
  itemSublabel: {
    display: 'block',
    fontSize: '0.75rem',
    color: 'var(--muted-foreground)',
    marginTop: '0.1rem',
  },
  emptyState: {
    padding: '1rem 0.75rem',
    fontSize: '0.875rem',
    color: 'var(--muted-foreground)',
    textAlign: 'center',
    background: '#0f172a',
  },
});

export const banner = stylex.create({
  error: {
    padding: '0.75rem 1rem',
    marginBottom: '1rem',
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    border: '1px solid rgba(220, 38, 38, 0.3)',
    borderRadius: '6px',
    color: 'var(--foreground)',
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
  },
});

export const quote = stylex.create({
  itemizedRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.5rem',
    fontSize: '0.875rem',
  },
  itemizedLabel: {
    color: 'var(--muted-foreground, #666)',
  },
  itemizedValue: {
    color: 'var(--foreground)',
  },
  itemizedValueRed: {
    color: 'var(--destructive, #ef4444)',
  },
  itemizedValueBold: {
    fontWeight: 600,
  },
  itemizedSection: {
    fontSize: '0.875rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  timeoutMessage: {
    fontSize: '0.875rem',
    color: 'var(--muted-foreground, #666)',
    marginBottom: '0.75rem',
  },
  otherOptions: {
    fontSize: '0.75rem',
    color: 'var(--muted-foreground, #666)',
    marginTop: '0.35rem',
  },
});

export const spacing = stylex.create({
  mb1: { marginBottom: '1rem' },
  mb05: { marginBottom: '0.5rem' },
  mb025: { marginBottom: '0.25rem' },
  mt05: { marginTop: '0.5rem' },
  mt025: { marginTop: '0.25rem' },
  gap05: { gap: '0.5rem' },
});
