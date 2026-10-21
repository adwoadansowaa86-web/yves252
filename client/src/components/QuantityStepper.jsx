import Icon from './Icon.jsx';

export default function QuantityStepper({ value, max, onChange, size = 'md' }) {
  return (
    <div className={`stepper stepper-${size}`}>
      <button type="button" onClick={() => onChange(value - 1)} aria-label="Decrease quantity">
        <Icon name={value <= 1 ? 'trash' : 'minus'} size={16} />
      </button>
      <span aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Increase quantity">
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}
