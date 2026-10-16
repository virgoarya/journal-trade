import styles from '../../styles/payment.module.css';

interface PaymentStatusProps {
  status: any;
}

export default function PaymentStatus({ status }: PaymentStatusProps) {
  if (!status) {
    return <div className={styles.status}>No payment information available</div>;
  }

  return (
    <div className={styles.statusContainer}>
      <h3>Payment Status</h3>
      <div className={styles.statusDetails}>
        <p>
          <strong>Registration:</strong> {status.isRegistered ? '✅ Active' : '❌ Pending'}
        </p>
        <p>
          <strong>Token Balance:</strong> {status.tokenBalance}
        </p>
        <p>
          <strong>Booster Status:</strong> {status.isBooster ? '✅ Yes' : '❌ No'}
        </p>
        {status.hasInsufficientToken && (
          <p className={styles.warning}>
            ⚠️ Insufficient tokens. Please top up to continue using AI Trading.
          </p>
        )}
      </div>
    </div>
  );
}
