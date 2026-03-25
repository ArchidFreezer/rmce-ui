type PillProps = {
  label: string;
};

/**
 * A simple pill component to display a label in a compact form.
 * @prop label The text to display inside the pill.
 * The pill has a border, background color, and rounded corners. It also has a tooltip that shows the full label when hovered.
 */
export function Pill({ label }: PillProps) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        marginRight: 6,
        marginBottom: 4,
        borderRadius: 999,
        fontSize: 12,
        border: '1px solid var(--border)',
        background: 'var(--panel)',
        whiteSpace: 'nowrap',
      }}
      title={label}
    >
      {label}
    </span>
  );
}

type PillListProps<T extends string> = {
  values: T[];
  getLabel?: (value: T) => string;
  emptyLabel?: string;
};

/**
 * A component to display a list of values as pills. If the list is empty, it displays an optional empty label.
 * @param values The list of values to display as pills.
 * @param getLabel A function to get the label for each value. Defaults to the value itself.
 * @param emptyLabel The label to display when the list is empty. Defaults to '—'.
 */
export function PillList<T extends string>({
  values,
  getLabel = v => v,
  emptyLabel = '—',
}: PillListProps<T>) {
  if (values.length === 0) {
    return <span style={{ color: 'var(--muted)' }}>{emptyLabel}</span>;
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
      {values.map(value => (
        <Pill key={value} label={getLabel(value)} />
      ))}
    </div>
  );
}