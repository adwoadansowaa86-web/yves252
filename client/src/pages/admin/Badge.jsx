import { ORDER_STATUS, PAYMENT_STATUS, statusLabel } from '../../lib/format.js';

export const OrderBadge = ({ status, method }) => (
  <span className={`badge tone-${ORDER_STATUS[status]?.tone ?? 'gray'}`}>{statusLabel(status, method)}</span>
);

export const PaymentBadge = ({ order }) => {
  if (order.paymentMethod === 'cod' && order.paymentStatus !== 'paid') return <span className="badge tone-gray">Pay on receipt</span>;
  const s = PAYMENT_STATUS[order.paymentStatus];
  return <span className={`badge tone-${s?.tone ?? 'gray'}`}>{s?.label ?? order.paymentStatus}</span>;
};
