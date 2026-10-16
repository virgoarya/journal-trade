import styles from '../../styles/payment.module.css';

interface PaymentErrorProps {
  message: string;
}

export default function PaymentError({ message }: PaymentErrorProps) {
  return (
    <div className={styles.errorContainer}>
      <h2>❌ Error</h2>
      <p>{message}</p>
      <button onClick={() => window.location.reload()} className={styles.button}>
        Try Again
      </button>
    </div>
  );
}
