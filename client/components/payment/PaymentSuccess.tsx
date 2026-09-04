import styles from '../../styles/payment.module.css';

interface PaymentSuccessProps {
  userId: string;
}

export default function PaymentSuccess({ userId }: PaymentSuccessProps) {
  return (
    <div className={styles.successContainer}>
      <h2>🎉 Payment Successful!</h2>
      <p>Your AI Trading account is now active.</p>
      <div className={styles.actions}>
        <a href="/ai-trading" className={styles.button}>
          Go to AI Trading Dashboard
        </a>
      </div>
    </div>
  );
}
